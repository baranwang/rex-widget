import { utf8ToBase64 } from "./auth";
import { browseById, callInnertube } from "./client";
import { buildAndroidMusicProfile, LRCLIB_API, parseDetailLink } from "./constants";
import { findAll, findOne, type JsonRecord, panelTrackOf, textOf } from "./parser";
import {
  type CachedLyrics,
  getCachedLyrics,
  getCachedSongMeta,
  type RuntimeConfig,
  setCachedLyrics,
  syncRuntimeConfig,
} from "./storage";

const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIDEO_FILENAME_RE = /\.(?:mkv|mp4|avi|mov|m4v|ts|wmv|flv|webm)$/i;
const LRCLIB_USER_AGENT = "RexYouTubeMusic/0.2.2 (https://github.com/baranwang/rex-widget)";

export interface TimedLyricLine {
  startMs: number;
  text: string;
}

export interface YouTubeMusicLyricsResult {
  syncedLrc?: string;
  plainText?: string;
  trackMeta?: {
    title: string;
    artist?: string;
    album?: string;
    duration?: number;
  };
}

export interface LrclibRecord {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

export interface LrclibLyricsResult {
  id?: number;
  syncedLrc?: string;
  plainText?: string;
}

export interface SubtitleRequestParams {
  id?: string;
  type?: string;
  title?: string;
  seriesName?: string;
  episodeName?: string;
  tmdbId?: string;
  imdbId?: string;
  link?: string;
  runtime?: string;
  duration?: string | number;
  artist?: string;
  subtitle?: string;
  album?: string;
  cookie?: string;
  language?: string;
  audioFormat?: string;
  playerType?: string;
  reportHistory?: string;
}

/**
 * Formats milliseconds as an LRC timestamp `[mm:ss.xx]`.
 */
export function formatLrcTimestamp(ms: number): string {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalCentiseconds = Math.round(safeMs / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}]`;
}

export function formatTimedLyricsToLrc(lines: TimedLyricLine[]): string {
  return lines
    .filter((line) => line.text.trim().length > 0)
    .sort((a, b) => a.startMs - b.startMs)
    .map((line) => `${formatLrcTimestamp(line.startMs)}${line.text.trim()}`)
    .join("\n");
}

export function toLyricsDataUrl(content: string, mime = "text/plain"): string {
  return `data:${mime};charset=utf-8;base64,${utf8ToBase64(content)}`;
}

export function detectLyricsLanguage(text: string, fallback = "und"): string {
  if (/[\u3040-\u30ff]/.test(text)) {
    return "ja";
  }
  if (/[\uac00-\ud7af]/.test(text)) {
    return "ko";
  }
  if (/[\u4e00-\u9fff]/.test(text)) {
    return "zh";
  }
  if (/[\u0400-\u04ff]/.test(text)) {
    return "ru";
  }
  if (/[A-Za-z]/.test(text)) {
    return "en";
  }
  return fallback || "und";
}

export function cleanTrackTitleForSearch(title: string): string {
  return title
    .replace(
      /\s*[([](?:official\s+(?:music\s+)?(?:video|audio|lyric\s+video|visualizer)|lyric\s+video|audio|mv|m\/v|live|hd|4k|hq|full\s+ver\.?|short\s+ver\.?)[)\]]/gi,
      "",
    )
    .replace(/\s*\((?:feat\.?|ft\.?|with)\s+[^)]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractYouTubeLyricsFromBrowse(answer: JsonRecord): { syncedLrc?: string; plainText?: string } {
  const timedRaw = findOne<unknown[]>(answer, "timedLyricsData");
  if (Array.isArray(timedRaw) && timedRaw.length > 0) {
    const timedLines: TimedLyricLine[] = [];
    const plainLines: string[] = [];
    let hasTimestamps = false;

    for (const item of timedRaw) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as JsonRecord;
      const text = typeof record.lyricLine === "string" ? record.lyricLine.trim() : "";
      if (!text) {
        continue;
      }
      plainLines.push(text);
      const cueRange = record.cueRange as JsonRecord | undefined;
      const startRaw = cueRange?.startTimeMilliseconds;
      const startMs = typeof startRaw === "number" ? startRaw : typeof startRaw === "string" ? Number(startRaw) : NaN;
      if (Number.isFinite(startMs) && startMs >= 0) {
        hasTimestamps = true;
        timedLines.push({ startMs, text });
      }
    }

    if (hasTimestamps && timedLines.length > 0) {
      return { syncedLrc: formatTimedLyricsToLrc(timedLines) };
    }
    if (plainLines.length > 0) {
      return { plainText: plainLines.join("\n") };
    }
  }

  const shelf = findOne<JsonRecord>(answer, "musicDescriptionShelfRenderer");
  if (shelf) {
    const description = textOf(shelf.description).trim();
    if (description) {
      return { plainText: description };
    }
  }

  return {};
}

async function callAndroidMusic(
  endpoint: string,
  body: Record<string, unknown>,
  config: RuntimeConfig,
): Promise<JsonRecord> {
  try {
    return await callInnertube<JsonRecord>(endpoint, body, config, buildAndroidMusicProfile(false), 8);
  } catch (error) {
    if (!config.cookie) {
      throw error;
    }
    return callInnertube<JsonRecord>(endpoint, body, config, buildAndroidMusicProfile(true), 8);
  }
}

export async function fetchYouTubeMusicLyrics(
  videoId: string,
  config: RuntimeConfig,
): Promise<YouTubeMusicLyricsResult> {
  // WEB_REMIX next is ~18KB (vs >3MB on ANDROID_MUSIC) and still returns both MPLY browseId and playlistPanelVideoRenderer.
  let next: JsonRecord;
  try {
    next = await callInnertube<JsonRecord>("next", { videoId, isAudioOnly: true }, config, undefined, 8);
  } catch (error) {
    console.warn(`YouTube Music next (lyrics) failed for ${videoId}:`, error instanceof Error ? error.message : error);
    return {};
  }

  const playingRenderer = findAll<JsonRecord>(next, "playlistPanelVideoRenderer").find(
    (item) => item.videoId === videoId,
  );
  const parsedTrack = playingRenderer ? panelTrackOf(playingRenderer) : null;
  const trackMeta = parsedTrack
    ? {
        title: parsedTrack.name,
        ...(parsedTrack.artists.length ? { artist: parsedTrack.artists.map((a) => a.name).join(", ") } : {}),
        ...(parsedTrack.album?.name ? { album: parsedTrack.album.name } : {}),
        ...(parsedTrack.duration > 0 ? { duration: parsedTrack.duration } : {}),
      }
    : undefined;

  const mplyId = findAll<unknown>(next, "browseId").find(
    (value): value is string => typeof value === "string" && value.startsWith("MPLY"),
  );
  if (!mplyId) {
    return { ...(trackMeta ? { trackMeta } : {}) };
  }

  try {
    const browse = await callAndroidMusic("browse", { browseId: mplyId }, config);
    const extracted = extractYouTubeLyricsFromBrowse(browse);
    if (extracted.syncedLrc || extracted.plainText) {
      return { ...extracted, ...(trackMeta ? { trackMeta } : {}) };
    }
  } catch (error) {
    console.warn(
      `YouTube Music ANDROID_MUSIC lyrics browse failed for ${mplyId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  // Fallback to WEB_REMIX browse for plain text musicDescriptionShelfRenderer
  try {
    const webBrowse = await browseById(mplyId, config);
    const extracted = extractYouTubeLyricsFromBrowse(webBrowse);
    return { ...extracted, ...(trackMeta ? { trackMeta } : {}) };
  } catch (error) {
    console.warn(
      `YouTube Music WEB_REMIX lyrics browse failed for ${mplyId}:`,
      error instanceof Error ? error.message : error,
    );
    return { ...(trackMeta ? { trackMeta } : {}) };
  }
}

function buildLrclibUrl(path: string, params: Record<string, string | undefined>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return pairs.length ? `${LRCLIB_API}/${path}?${pairs.join("&")}` : `${LRCLIB_API}/${path}`;
}

async function requestLrclibJson<T>(url: string): Promise<T | null> {
  try {
    const response = await Widget.http.request<T>({
      url,
      method: "GET",
      headers: {
        "user-agent": LRCLIB_USER_AGENT,
        accept: "application/json",
      },
      timeout: 6,
    });
    return response.data ?? null;
  } catch {
    return null;
  }
}

function pickBestLrclibCandidate(items: LrclibRecord[], duration?: number): LrclibRecord | null {
  const valid = items.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      !item.instrumental &&
      (Boolean(item.syncedLyrics?.trim()) || Boolean(item.plainLyrics?.trim())),
  );
  if (!valid.length) {
    return null;
  }

  const hasDuration = typeof duration === "number" && Number.isFinite(duration) && duration > 0;
  const durationDiff = (item: LrclibRecord) =>
    hasDuration && typeof item.duration === "number" && Number.isFinite(item.duration)
      ? Math.abs(item.duration - duration)
      : Number.POSITIVE_INFINITY;

  const synced = valid.filter((item) => Boolean(item.syncedLyrics?.trim()));
  if (synced.length > 0) {
    if (!hasDuration) {
      return synced[0];
    }
    const sorted = [...synced].sort((a, b) => durationDiff(a) - durationDiff(b));
    if (durationDiff(sorted[0]) <= 15) {
      return sorted[0];
    }
  }

  const plain = valid.filter((item) => Boolean(item.plainLyrics?.trim()));
  if (plain.length > 0) {
    if (!hasDuration) {
      return plain[0];
    }
    const sorted = [...plain].sort((a, b) => durationDiff(a) - durationDiff(b));
    if (durationDiff(sorted[0]) <= 20) {
      return sorted[0];
    }
  }

  return null;
}

export async function fetchLrclibLyrics(query: {
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
}): Promise<LrclibLyricsResult> {
  const title = query.title.trim();
  const artist = (query.artist || "").trim();
  const album = (query.album || "").trim();
  const duration =
    typeof query.duration === "number" && Number.isFinite(query.duration) && query.duration > 0
      ? Math.round(query.duration)
      : undefined;

  if (!title) {
    return {};
  }

  let fallbackPlain: string | undefined;
  let fallbackId: number | undefined;

  if (artist) {
    const exact = await requestLrclibJson<LrclibRecord>(
      buildLrclibUrl("get", {
        track_name: title,
        artist_name: artist,
        album_name: album || undefined,
        duration: duration ? String(duration) : undefined,
      }),
    );
    if (exact && !exact.instrumental) {
      const synced = exact.syncedLyrics?.trim();
      const plain = exact.plainLyrics?.trim();
      if (synced) {
        return {
          ...(typeof exact.id === "number" ? { id: exact.id } : {}),
          syncedLrc: synced,
          ...(plain ? { plainText: plain } : {}),
        };
      }
      if (plain) {
        fallbackPlain = plain;
        fallbackId = typeof exact.id === "number" ? exact.id : undefined;
      }
    }
  }

  const searchTitles = [title];
  const cleaned = cleanTrackTitleForSearch(title);
  if (cleaned && cleaned !== title) {
    searchTitles.push(cleaned);
  }

  for (const candidateTitle of searchTitles) {
    const results = await requestLrclibJson<LrclibRecord[]>(
      buildLrclibUrl("search", {
        track_name: candidateTitle,
        artist_name: artist || undefined,
      }),
    );
    if (!Array.isArray(results) || !results.length) {
      continue;
    }
    const best = pickBestLrclibCandidate(results, duration);
    if (!best) {
      continue;
    }
    const synced = best.syncedLyrics?.trim();
    const plain = best.plainLyrics?.trim();
    if (synced) {
      return {
        ...(typeof best.id === "number" ? { id: best.id } : {}),
        syncedLrc: synced,
        ...(plain ? { plainText: plain } : {}),
      };
    }
    if (plain && !fallbackPlain) {
      fallbackPlain = plain;
      fallbackId = typeof best.id === "number" ? best.id : undefined;
    }
  }

  if (fallbackPlain) {
    return {
      ...(fallbackId !== undefined ? { id: fallbackId } : {}),
      plainText: fallbackPlain,
    };
  }
  return {};
}

export function buildSubtitleItems(cacheKey: string, data: Omit<CachedLyrics, "cachedAt">): SubtitleItem[] {
  const items: SubtitleItem[] = [];
  const sampleText = data.ytmSyncedLrc || data.lrclibSyncedLrc || data.ytmPlainText || data.lrclibPlainText || "";
  const lang = detectLyricsLanguage(sampleText, data.lang || "und");

  if (data.ytmSyncedLrc) {
    items.push({
      id: `${cacheKey}:ytm-synced`,
      title: Widget.i18n("YouTube Music（同步歌词）"),
      lang,
      url: toLyricsDataUrl(data.ytmSyncedLrc),
    });
  }
  if (data.lrclibSyncedLrc) {
    items.push({
      id: `${cacheKey}:lrclib-synced`,
      title: Widget.i18n("LRCLIB（同步歌词）"),
      lang,
      url: toLyricsDataUrl(data.lrclibSyncedLrc),
    });
  }
  if (data.ytmPlainText) {
    items.push({
      id: `${cacheKey}:ytm-plain`,
      title: Widget.i18n("YouTube Music（纯文本歌词）"),
      lang,
      url: toLyricsDataUrl(data.ytmPlainText),
    });
  }
  if (!items.length && data.lrclibPlainText) {
    items.push({
      id: `${cacheKey}:lrclib-plain`,
      title: Widget.i18n("LRCLIB（纯文本歌词）"),
      lang,
      url: toLyricsDataUrl(data.lrclibPlainText),
    });
  }

  return items;
}

function parseRuntimeSeconds(value?: string | number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }
  const num = Number((value || "").trim());
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

export async function handleSubtitle(params: SubtitleRequestParams): Promise<SubtitleItem[]> {
  const config = syncRuntimeConfig(params);

  const parsedLink = params.link ? parseDetailLink(params.link) : null;
  const isYtmSongLink = parsedLink?.kind === "song";
  const isVideoMedia =
    !isYtmSongLink &&
    (params.type === "movie" ||
      params.type === "tv" ||
      Boolean((params.tmdbId || "").trim()) ||
      Boolean((params.imdbId || "").trim()));

  if (isVideoMedia) {
    return [];
  }

  const rawId = (params.id || "").trim();
  const parsedIdLink = rawId ? parseDetailLink(rawId) : null;
  const videoId = isYtmSongLink
    ? parsedLink.id
    : parsedIdLink?.kind === "song"
      ? parsedIdLink.id
      : YOUTUBE_VIDEO_ID_RE.test(rawId)
        ? rawId
        : "";

  const cachedMeta = videoId ? getCachedSongMeta(videoId) : null;
  const initialTitle = (cachedMeta?.title || params.title || params.episodeName || params.seriesName || "").trim();
  const initialArtist = (
    cachedMeta?.subtitle ||
    params.artist ||
    params.subtitle ||
    (params.seriesName && params.seriesName.trim() !== initialTitle ? params.seriesName : "") ||
    ""
  ).trim();
  const initialAlbum = (params.album || "").trim();
  const initialDuration = cachedMeta?.duration || parseRuntimeSeconds(params.runtime ?? params.duration);

  if (!videoId) {
    if (!initialTitle || VIDEO_FILENAME_RE.test(initialTitle)) {
      return [];
    }
  }

  const cacheKey = videoId
    ? `ytm:${videoId}`
    : `q:${initialTitle.toLowerCase()}|${initialArtist.toLowerCase()}|${initialDuration || 0}`;

  const cachedLyrics = getCachedLyrics(cacheKey);
  if (cachedLyrics) {
    return buildSubtitleItems(cacheKey, cachedLyrics);
  }

  let ytmResult: YouTubeMusicLyricsResult = {};
  let lrclibResult: LrclibLyricsResult = {};

  if (videoId && initialTitle) {
    const [ytmSettled, lrcSettled] = await Promise.allSettled([
      fetchYouTubeMusicLyrics(videoId, config),
      fetchLrclibLyrics({
        title: initialTitle,
        artist: initialArtist,
        album: initialAlbum,
        duration: initialDuration,
      }),
    ]);
    if (ytmSettled.status === "fulfilled") {
      ytmResult = ytmSettled.value;
    }
    if (lrcSettled.status === "fulfilled") {
      lrclibResult = lrcSettled.value;
    }
    // If initial search missed synced lyrics and YouTube Music's next endpoint revealed cleaner metadata, retry LRCLIB once.
    if (
      !ytmResult.syncedLrc &&
      !lrclibResult.syncedLrc &&
      ytmResult.trackMeta?.title &&
      (ytmResult.trackMeta.title !== initialTitle ||
        (ytmResult.trackMeta.artist && ytmResult.trackMeta.artist !== initialArtist))
    ) {
      const retried = await fetchLrclibLyrics({
        ...ytmResult.trackMeta,
        duration: ytmResult.trackMeta.duration || initialDuration,
      });
      if (retried.syncedLrc || retried.plainText) {
        lrclibResult = { ...lrclibResult, ...retried };
      }
    }
  } else if (videoId) {
    ytmResult = await fetchYouTubeMusicLyrics(videoId, config);
    if (!ytmResult.syncedLrc && ytmResult.trackMeta?.title) {
      lrclibResult = await fetchLrclibLyrics({
        ...ytmResult.trackMeta,
        duration: ytmResult.trackMeta.duration || initialDuration,
      });
    }
  } else {
    lrclibResult = await fetchLrclibLyrics({
      title: initialTitle,
      artist: initialArtist,
      album: initialAlbum,
      duration: initialDuration,
    });
  }

  const payload: Omit<CachedLyrics, "cachedAt"> = {
    ...(ytmResult.syncedLrc ? { ytmSyncedLrc: ytmResult.syncedLrc } : {}),
    ...(ytmResult.plainText ? { ytmPlainText: ytmResult.plainText } : {}),
    ...(lrclibResult.id !== undefined ? { lrclibId: lrclibResult.id } : {}),
    ...(lrclibResult.syncedLrc ? { lrclibSyncedLrc: lrclibResult.syncedLrc } : {}),
    ...(lrclibResult.plainText ? { lrclibPlainText: lrclibResult.plainText } : {}),
    lang: config.language,
  };

  setCachedLyrics(cacheKey, payload);
  return buildSubtitleItems(cacheKey, payload);
}
