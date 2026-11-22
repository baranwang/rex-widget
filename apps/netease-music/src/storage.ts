import type { ManagedCookieName, SetCookieUpdate } from "./auth";
import {
  ACCOUNT_CACHE_TTL_MS,
  type PlayerTypePreference,
  type QualityPreference,
  STREAM_CACHE_TTL_MS,
} from "./constants";

const KEYS = {
  config: "ncm:config",
  deviceId: "ncm:deviceId",
  serverCookies: "ncm:serverCookies",
  account: "ncm:account",
  streams: "ncm:streams",
  songMeta: "ncm:songMeta",
} as const;

const MAX_STREAM_ENTRIES = 50;
const MAX_SONG_META_ENTRIES = 160;

export interface RuntimeConfig {
  cookie: string;
  quality: QualityPreference;
  allowTrial: boolean;
  playerType: PlayerTypePreference;
}

export interface CachedAccount {
  uid: string;
  nickname: string;
  cookieKey: string;
  cachedAt: number;
}

export interface CachedAudioStream {
  url: string;
  format: string;
  level: string;
  bitrate: number;
  isTrial: boolean;
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
  quality: "exhigh",
  allowTrial: false,
  playerType: "auto",
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

export function normalizeQuality(value?: string): QualityPreference {
  if (value === "standard" || value === "higher" || value === "exhigh" || value === "lossless" || value === "hires") {
    return value;
  }
  return "exhigh";
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
    quality: normalizeQuality(stored.quality),
    allowTrial: Boolean(stored.allowTrial),
    playerType: normalizePlayerType(stored.playerType),
  };
}

export function syncRuntimeConfig(params?: {
  cookie?: string;
  quality?: string;
  allowTrial?: string;
  playerType?: string;
}): RuntimeConfig {
  const prev = getRuntimeConfig();
  if (!params) {
    return prev;
  }
  const next: RuntimeConfig = {
    cookie: typeof params.cookie === "string" ? params.cookie.trim() : prev.cookie,
    quality: params.quality !== undefined ? normalizeQuality(params.quality) : prev.quality,
    allowTrial: params.allowTrial !== undefined ? params.allowTrial === "true" : prev.allowTrial,
    playerType: params.playerType !== undefined ? normalizePlayerType(params.playerType) : prev.playerType,
  };
  if (next.cookie !== prev.cookie) {
    removeStorage(KEYS.account);
    removeStorage(KEYS.streams);
  }
  writeStorage(KEYS.config, next);
  return next;
}

export function getOrCreateDeviceId(): string {
  const existing = readStorage<string>(KEYS.deviceId);
  if (typeof existing === "string" && /^[0-9A-F]{52}$/.test(existing)) {
    return existing;
  }
  let id = "";
  for (let i = 0; i < 52; i++) {
    id += Math.floor(Math.random() * 16)
      .toString(16)
      .toUpperCase();
  }
  writeStorage(KEYS.deviceId, id);
  return id;
}

export function getServerCookies(): Partial<Record<ManagedCookieName, string>> {
  const stored = readStorage<Partial<Record<ManagedCookieName, string>>>(KEYS.serverCookies);
  if (!stored || typeof stored !== "object") {
    return {};
  }
  return { ...stored };
}

export function applyServerCookieUpdate(update: SetCookieUpdate): void {
  const hasUpdates = Object.keys(update.updates).length > 0;
  if (!hasUpdates && !update.deletes.length) {
    return;
  }
  const next = getServerCookies();
  for (const name of update.deletes) {
    delete next[name];
  }
  for (const [name, value] of Object.entries(update.updates)) {
    if (value) {
      next[name as ManagedCookieName] = value;
    }
  }
  writeStorage(KEYS.serverCookies, next);
}

export function getCachedAccount(cookieKey: string, now = Date.now()): CachedAccount | null {
  if (!cookieKey) {
    return null;
  }
  const entry = readStorage<CachedAccount>(KEYS.account);
  if (!entry || entry.cookieKey !== cookieKey || !entry.uid) {
    return null;
  }
  if (now - entry.cachedAt > ACCOUNT_CACHE_TTL_MS) {
    return null;
  }
  return entry;
}

export function setCachedAccount(uid: string, nickname: string, cookieKey: string, now = Date.now()): void {
  if (!uid || !cookieKey) {
    return;
  }
  writeStorage(KEYS.account, { uid, nickname, cookieKey, cachedAt: now });
}

export function getCachedStream(
  songId: string,
  quality: QualityPreference,
  allowTrial: boolean,
  now = Date.now(),
): CachedAudioStream | null {
  const map = readStorage<Record<string, CachedAudioStream>>(KEYS.streams);
  if (!map || typeof map !== "object") {
    return null;
  }
  const entry = map[`${songId}:${quality}:${allowTrial ? "1" : "0"}`];
  if (!entry || typeof entry.url !== "string" || typeof entry.cachedAt !== "number") {
    return null;
  }
  if (now - entry.cachedAt > STREAM_CACHE_TTL_MS) {
    return null;
  }
  return entry;
}

export function setCachedStream(
  songId: string,
  quality: QualityPreference,
  allowTrial: boolean,
  stream: Omit<CachedAudioStream, "cachedAt">,
  now = Date.now(),
): void {
  const existing = readStorage<Record<string, CachedAudioStream>>(KEYS.streams);
  const map: Record<string, CachedAudioStream> = existing && typeof existing === "object" ? { ...existing } : {};
  const key = `${songId}:${quality}:${allowTrial ? "1" : "0"}`;
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

export function getCachedSongMeta(songId: string): CachedSongMeta | null {
  const map = readStorage<Record<string, CachedSongMeta>>(KEYS.songMeta);
  if (!map || typeof map !== "object") {
    return null;
  }
  return map[songId] ?? null;
}
