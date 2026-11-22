import { parseCookieAuthInput, utf8ToBase64 } from "./auth";
import { browseById, callInnertube } from "./client";
import { buildAndroidMusicProfile, parseDetailLink } from "./constants";
import { findAll, findOne, type JsonRecord, textOf } from "./parser";
import { type CachedLyrics, getCachedLyrics, type RuntimeConfig, setCachedLyrics, syncRuntimeConfig } from "./storage";

const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export interface TimedLyricLine {
  startMs: number;
  text: string;
}

export interface YouTubeMusicLyricsResult {
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

export function extractYouTubeLyricsFromBrowse(answer: JsonRecord): YouTubeMusicLyricsResult {
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

async function callAndroidMusicBrowse(browseId: string, config: RuntimeConfig): Promise<JsonRecord> {
  try {
    return await callInnertube<JsonRecord>("browse", { browseId }, config, buildAndroidMusicProfile(false), 8);
  } catch (error) {
    if (!config.cookie) {
      throw error;
    }
    return callInnertube<JsonRecord>("browse", { browseId }, config, buildAndroidMusicProfile(true), 8);
  }
}

export async function fetchYouTubeMusicLyrics(
  videoId: string,
  config: RuntimeConfig,
): Promise<YouTubeMusicLyricsResult> {
  // WEB_REMIX next is ~18KB (vs >3MB on ANDROID_MUSIC) and still returns the MPLY* lyrics browseId.
  let next: JsonRecord;
  try {
    next = await callInnertube<JsonRecord>("next", { videoId, isAudioOnly: true }, config, undefined, 8);
  } catch (error) {
    console.warn(`YouTube Music next (lyrics) failed for ${videoId}:`, error instanceof Error ? error.message : error);
    return {};
  }

  const mplyId = findAll<unknown>(next, "browseId").find(
    (value): value is string => typeof value === "string" && value.startsWith("MPLY"),
  );
  if (!mplyId) {
    return {};
  }

  try {
    const browse = await callAndroidMusicBrowse(mplyId, config);
    const extracted = extractYouTubeLyricsFromBrowse(browse);
    if (extracted.syncedLrc || extracted.plainText) {
      return extracted;
    }
  } catch (error) {
    console.warn(
      `YouTube Music ANDROID_MUSIC lyrics browse failed for ${mplyId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  // Fallback to WEB_REMIX browse for plain text musicDescriptionShelfRenderer (including logged-in licensed lyrics).
  try {
    const webBrowse = await browseById(mplyId, config);
    return extractYouTubeLyricsFromBrowse(webBrowse);
  } catch (error) {
    console.warn(
      `YouTube Music WEB_REMIX lyrics browse failed for ${mplyId}:`,
      error instanceof Error ? error.message : error,
    );
    return {};
  }
}

export function buildSubtitleItems(videoId: string, data: Omit<CachedLyrics, "cachedAt">): SubtitleItem[] {
  const items: SubtitleItem[] = [];
  const sampleText = data.syncedLrc || data.plainText || "";
  const lang = detectLyricsLanguage(sampleText, data.lang || "und");

  if (data.syncedLrc) {
    items.push({
      id: `ytm:${videoId}:synced`,
      title: Widget.i18n("YouTube Music（同步歌词）"),
      lang,
      url: toLyricsDataUrl(data.syncedLrc),
    });
  } else if (data.plainText) {
    items.push({
      id: `ytm:${videoId}:plain`,
      title: Widget.i18n("YouTube Music（纯文本歌词）"),
      lang,
      url: toLyricsDataUrl(data.plainText),
    });
  }

  return items;
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

  if (!videoId) {
    return [];
  }

  const authScope = parseCookieAuthInput(config.cookie).hasSapisid ? "auth" : "anon";
  const cacheKey = `ytm:${authScope}:${videoId}`;
  const cachedLyrics = getCachedLyrics(cacheKey);
  if (cachedLyrics) {
    return buildSubtitleItems(videoId, cachedLyrics);
  }

  const result = await fetchYouTubeMusicLyrics(videoId, config);
  const payload: Omit<CachedLyrics, "cachedAt"> = {
    ...(result.syncedLrc ? { syncedLrc: result.syncedLrc } : {}),
    ...(result.plainText ? { plainText: result.plainText } : {}),
    lang: config.language,
  };

  setCachedLyrics(cacheKey, payload);
  return buildSubtitleItems(videoId, payload);
}
