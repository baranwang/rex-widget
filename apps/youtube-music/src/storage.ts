import { getQueryParam } from "./auth";
import {
  type AudioFormatPreference,
  LYRICS_CACHE_TTL_MS,
  type PlayerTypePreference,
  STREAM_CACHE_TTL_MS,
  STREAM_EXPIRY_SAFETY_MARGIN_SECONDS,
  VISITOR_DATA_TTL_MS,
} from "./constants";

const KEYS = {
  config: "ytm:config",
  visitor: "ytm:visitor",
  tokens: "ytm:tokens",
  searchSeen: "ytm:searchSeen",
  streams: "ytm:streams",
  lyrics: "ytm:lyrics",
  songMeta: "ytm:songMeta",
  lastPlayed: "ytm:lastPlayed",
  radioSeeds: "ytm:radioSeeds",
} as const;

const MAX_TOKEN_ENTRIES = 60;
const MAX_SEARCH_SEEN_ENTRIES = 20;
const MAX_STREAM_ENTRIES = 40;
const MAX_LYRICS_ENTRIES = 30;
const MAX_SONG_META_ENTRIES = 120;
const MAX_RADIO_SEEDS = 12;

export interface RuntimeConfig {
  cookie: string;
  language: string;
  audioFormat: AudioFormatPreference;
  playerType: PlayerTypePreference;
  reportHistory: boolean;
}

export interface CachedAudioStream {
  url: string;
  mimeType: string;
  bitrate: number;
  headers: Record<string, string>;
  duration?: number;
  title?: string;
  author?: string;
  channelId?: string;
  coverUrl?: string;
  cachedAt: number;
}

export interface CachedLyrics {
  syncedLrc?: string;
  plainText?: string;
  lang?: string;
  cachedAt: number;
}

export interface CachedSongMeta {
  id: string;
  title: string;
  subtitle?: string;
  posterPath?: string;
  coverUrl?: string;
  duration?: number;
  durationText?: string;
  peoples?: PersonItem[];
}

const DEFAULT_CONFIG: RuntimeConfig = {
  cookie: "",
  language: "zh-CN",
  audioFormat: "aac",
  playerType: "auto",
  reportHistory: false,
};

function readStorage<T>(key: string): T | null {
  try {
    const raw = Widget.storage.get<T | string>(key);
    if (raw === null || raw === undefined) {
      return null;
    }
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    return raw;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    Widget.storage.set(key, value);
  } catch {
    // Ignore storage write errors in restricted runtimes
  }
}

function removeStorage(key: string): void {
  try {
    Widget.storage.remove(key);
  } catch {
    // Ignore
  }
}

export function normalizeAudioFormat(value?: string): AudioFormatPreference {
  if (value === "opus" || value === "best" || value === "aac") {
    return value;
  }
  return "aac";
}

export function normalizePlayerType(value?: string): PlayerTypePreference {
  if (value === "system" || value === "app" || value === "auto") {
    return value;
  }
  return "auto";
}

export function getRuntimeConfig(): RuntimeConfig {
  const stored = readStorage<Partial<RuntimeConfig>>(KEYS.config);
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_CONFIG };
  }
  return {
    cookie: typeof stored.cookie === "string" ? stored.cookie : DEFAULT_CONFIG.cookie,
    language: typeof stored.language === "string" && stored.language ? stored.language : DEFAULT_CONFIG.language,
    audioFormat: normalizeAudioFormat(stored.audioFormat),
    playerType: normalizePlayerType(stored.playerType),
    reportHistory: Boolean(stored.reportHistory),
  };
}

export function syncRuntimeConfig(params?: {
  cookie?: string;
  language?: string;
  audioFormat?: string;
  playerType?: string;
  reportHistory?: string;
}): RuntimeConfig {
  const prev = getRuntimeConfig();
  if (!params) {
    return prev;
  }
  const next: RuntimeConfig = {
    cookie: typeof params.cookie === "string" ? params.cookie.trim() : prev.cookie,
    language: typeof params.language === "string" && params.language.trim() ? params.language.trim() : prev.language,
    audioFormat: params.audioFormat !== undefined ? normalizeAudioFormat(params.audioFormat) : prev.audioFormat,
    playerType: params.playerType !== undefined ? normalizePlayerType(params.playerType) : prev.playerType,
    reportHistory: params.reportHistory !== undefined ? params.reportHistory === "true" : prev.reportHistory,
  };
  writeStorage(KEYS.config, next);
  return next;
}

export function getCachedVisitorData(now = Date.now()): string {
  const entry = readStorage<{ value?: string; cachedAt?: number }>(KEYS.visitor);
  if (!entry?.value || typeof entry.cachedAt !== "number") {
    return "";
  }
  if (now - entry.cachedAt > VISITOR_DATA_TTL_MS) {
    return "";
  }
  return entry.value;
}

export function setCachedVisitorData(value: string, now = Date.now()): void {
  if (!value) {
    return;
  }
  writeStorage(KEYS.visitor, { value, cachedAt: now });
}

export function clearCachedVisitorData(): void {
  removeStorage(KEYS.visitor);
}

function makeTokenKey(scope: string, page: number): string {
  return `${scope}\u0000${page}`;
}

export function getContinuationToken(scope: string, page: number): string | null {
  if (page <= 1) {
    return null;
  }
  const map = readStorage<Record<string, string>>(KEYS.tokens);
  if (!map || typeof map !== "object") {
    return null;
  }
  const token = map[makeTokenKey(scope, page)];
  return typeof token === "string" && token ? token : null;
}

export function setContinuationToken(scope: string, nextPage: number, token: string): void {
  if (!token || nextPage <= 1) {
    return;
  }
  const existing = readStorage<Record<string, string>>(KEYS.tokens);
  const map: Record<string, string> = existing && typeof existing === "object" ? { ...existing } : {};
  const key = makeTokenKey(scope, nextPage);
  delete map[key];
  map[key] = token;

  const keys = Object.keys(map);
  if (keys.length > MAX_TOKEN_ENTRIES) {
    for (const staleKey of keys.slice(0, keys.length - MAX_TOKEN_ENTRIES)) {
      delete map[staleKey];
    }
  }
  writeStorage(KEYS.tokens, map);
}

export function clearContinuationTokens(scope: string): void {
  const existing = readStorage<Record<string, string>>(KEYS.tokens);
  if (!existing || typeof existing !== "object") {
    return;
  }
  const prefix = `${scope}\u0000`;
  let changed = false;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (key.startsWith(prefix)) {
      changed = true;
      continue;
    }
    next[key] = value;
  }
  if (changed) {
    writeStorage(KEYS.tokens, next);
  }
}

export function getSearchSeenIds(scope: string): Set<string> {
  const map = readStorage<Record<string, string[]>>(KEYS.searchSeen);
  const list = map && typeof map === "object" ? map[scope] : undefined;
  return new Set(Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []);
}

export function setSearchSeenIds(scope: string, ids: string[]): void {
  const existing = readStorage<Record<string, string[]>>(KEYS.searchSeen);
  const map: Record<string, string[]> = existing && typeof existing === "object" ? { ...existing } : {};
  delete map[scope];
  map[scope] = Array.from(new Set(ids.filter(Boolean))).slice(0, 60);

  const keys = Object.keys(map);
  if (keys.length > MAX_SEARCH_SEEN_ENTRIES) {
    for (const staleKey of keys.slice(0, keys.length - MAX_SEARCH_SEEN_ENTRIES)) {
      delete map[staleKey];
    }
  }
  writeStorage(KEYS.searchSeen, map);
}

function isStreamUrlStillFresh(url: string, nowMs: number): boolean {
  const expireRaw = getQueryParam(url, "expire");
  if (!expireRaw) {
    return true;
  }
  const expireSec = Number(expireRaw);
  if (!Number.isFinite(expireSec) || expireSec <= 0) {
    return true;
  }
  return expireSec - STREAM_EXPIRY_SAFETY_MARGIN_SECONDS > nowMs / 1000;
}

export function getCachedStream(
  videoId: string,
  audioFormat: AudioFormatPreference,
  now = Date.now(),
): CachedAudioStream | null {
  const map = readStorage<Record<string, CachedAudioStream>>(KEYS.streams);
  if (!map || typeof map !== "object") {
    return null;
  }
  const entry = map[`${videoId}:${audioFormat}`];
  if (!entry || typeof entry.url !== "string" || typeof entry.cachedAt !== "number") {
    return null;
  }
  if (now - entry.cachedAt > STREAM_CACHE_TTL_MS || !isStreamUrlStillFresh(entry.url, now)) {
    return null;
  }
  return entry;
}

export function setCachedStream(
  videoId: string,
  audioFormat: AudioFormatPreference,
  stream: Omit<CachedAudioStream, "cachedAt">,
  now = Date.now(),
): void {
  const existing = readStorage<Record<string, CachedAudioStream>>(KEYS.streams);
  const map: Record<string, CachedAudioStream> = existing && typeof existing === "object" ? { ...existing } : {};
  const key = `${videoId}:${audioFormat}`;
  delete map[key];
  map[key] = { ...stream, cachedAt: now };

  const keys = Object.keys(map);
  if (keys.length > MAX_STREAM_ENTRIES) {
    for (const staleKey of keys.slice(0, keys.length - MAX_STREAM_ENTRIES)) {
      delete map[staleKey];
    }
  }
  writeStorage(KEYS.streams, map);
}

export function getLastPlayedVideoId(): string {
  const value = readStorage<string>(KEYS.lastPlayed);
  return typeof value === "string" ? value : "";
}

export function setLastPlayedVideoId(videoId: string): void {
  if (!videoId) {
    return;
  }
  writeStorage(KEYS.lastPlayed, videoId);
}

export function getRadioSeeds(): string[] {
  const seeds = readStorage<string[]>(KEYS.radioSeeds);
  if (!Array.isArray(seeds)) {
    return [];
  }
  return seeds.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function rememberRadioSeeds(videoIds: string[]): void {
  const valid = videoIds.filter((id) => typeof id === "string" && id.length > 0);
  if (!valid.length) {
    return;
  }
  const merged = Array.from(new Set([...valid, ...getRadioSeeds()])).slice(0, MAX_RADIO_SEEDS);
  writeStorage(KEYS.radioSeeds, merged);
}

export function cacheSongMetaList(items: VideoItem[]): void {
  const songs = items.filter((item) => item.mediaType === "song" && typeof item.id === "string" && item.id);
  if (!songs.length) {
    return;
  }
  const existing = readStorage<Record<string, CachedSongMeta>>(KEYS.songMeta);
  const map: Record<string, CachedSongMeta> = existing && typeof existing === "object" ? { ...existing } : {};

  for (const song of songs) {
    const id = String(song.id);
    delete map[id];
    map[id] = {
      id,
      title: song.title,
      ...(song.subtitle ? { subtitle: song.subtitle } : {}),
      ...(song.posterPath ? { posterPath: song.posterPath } : {}),
      ...(song.coverUrl ? { coverUrl: song.coverUrl } : {}),
      ...(typeof song.duration === "number" ? { duration: song.duration } : {}),
      ...(song.durationText ? { durationText: song.durationText } : {}),
      ...(song.peoples?.length ? { peoples: song.peoples } : {}),
    };
  }

  const keys = Object.keys(map);
  if (keys.length > MAX_SONG_META_ENTRIES) {
    for (const staleKey of keys.slice(0, keys.length - MAX_SONG_META_ENTRIES)) {
      delete map[staleKey];
    }
  }
  writeStorage(KEYS.songMeta, map);
}

export function getCachedSongMeta(videoId: string): CachedSongMeta | null {
  const map = readStorage<Record<string, CachedSongMeta>>(KEYS.songMeta);
  if (!map || typeof map !== "object") {
    return null;
  }
  return map[videoId] ?? null;
}

export function getCachedLyrics(cacheKey: string): CachedLyrics | null {
  const map = readStorage<Record<string, CachedLyrics>>(KEYS.lyrics);
  if (!map || typeof map !== "object") {
    return null;
  }
  const entry = map[cacheKey];
  if (!entry || typeof entry.cachedAt !== "number") {
    return null;
  }
  if (Date.now() - entry.cachedAt > LYRICS_CACHE_TTL_MS) {
    return null;
  }
  return entry;
}

export function setCachedLyrics(cacheKey: string, entry: Omit<CachedLyrics, "cachedAt">): void {
  if (!entry.syncedLrc && !entry.plainText) {
    return;
  }
  const existing = readStorage<Record<string, CachedLyrics>>(KEYS.lyrics);
  const map: Record<string, CachedLyrics> = existing && typeof existing === "object" ? { ...existing } : {};
  delete map[cacheKey];
  map[cacheKey] = {
    ...entry,
    cachedAt: Date.now(),
  };

  const keys = Object.keys(map);
  if (keys.length > MAX_LYRICS_ENTRIES) {
    for (const staleKey of keys.slice(0, keys.length - MAX_LYRICS_ENTRIES)) {
      delete map[staleKey];
    }
  }
  writeStorage(KEYS.lyrics, map);
}
