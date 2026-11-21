import { buildAuthHeaders, isYouTubeHostname, parseCookieAuthInput, parseHttpsUrlParts, setQueryParams } from "./auth";
import {
  type AudioFormatPreference,
  buildIosProfile,
  buildVisionOsProfile,
  buildWebRemixProfile,
  type InnertubeClientProfile,
  IOS_UA,
  type PlayerTypePreference,
  WEB_UA,
  YTM_SITE,
} from "./constants";
import { findAll, imageOf, type JsonRecord, secondsOf, textOf, type YtmTrackRef } from "./parser";
import {
  type CachedAudioStream,
  clearCachedVisitorData,
  getCachedStream,
  getCachedVisitorData,
  type RuntimeConfig,
  setCachedStream,
  setCachedVisitorData,
} from "./storage";

interface AdaptiveFormat {
  itag?: number;
  url?: string;
  mimeType?: string;
  bitrate?: number;
  isDrc?: boolean;
  audioTrack?: {
    audioIsDefault?: boolean;
  };
}

interface PlayerResponse {
  playabilityStatus?: {
    status?: string;
    reason?: string;
  };
  streamingData?: {
    adaptiveFormats?: AdaptiveFormat[];
  };
  videoDetails?: {
    videoId?: string;
    title?: string;
    lengthSeconds?: string;
    channelId?: string;
    author?: string;
    thumbnail?: {
      thumbnails?: Array<{ url?: string; width?: number; height?: number }>;
    };
  };
  playbackTracking?: {
    videostatsPlaybackUrl?: {
      baseUrl?: string;
    };
  };
}

function isHttp401Error(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /^HTTP\s+401\b/i.test(message);
}

export async function callInnertube<T = JsonRecord>(
  endpoint: string,
  body: Record<string, unknown>,
  config: RuntimeConfig,
  profile: InnertubeClientProfile = buildWebRemixProfile(config.language),
  timeoutSeconds = 20,
): Promise<T> {
  const auth = profile.anonymous ? {} : buildAuthHeaders(config.cookie, YTM_SITE);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": WEB_UA,
    origin: YTM_SITE,
    "x-origin": YTM_SITE,
    ...auth,
    ...(profile.headers || {}),
  };

  try {
    const response = await Widget.http.request<T>({
      url: `${YTM_SITE}/youtubei/v1/${endpoint}?prettyPrint=false`,
      method: "POST",
      headers,
      data: {
        context: { client: profile.client },
        ...body,
      },
      timeout: timeoutSeconds,
    });
    return response.data;
  } catch (error) {
    if (!profile.anonymous && config.cookie && isHttp401Error(error)) {
      throw new Error(Widget.i18n("YouTube Music 登录状态已失效，请更新 Cookie"));
    }
    throw error;
  }
}

export function browseById(
  browseId: string,
  config: RuntimeConfig,
  extraBody: Record<string, unknown> = {},
): Promise<JsonRecord> {
  return callInnertube("browse", { browseId, ...extraBody }, config);
}

export function browseContinuation(continuation: string, config: RuntimeConfig): Promise<JsonRecord> {
  return callInnertube("browse", { continuation }, config);
}

export async function enrichTrackDurations(tracks: YtmTrackRef[], config: RuntimeConfig): Promise<YtmTrackRef[]> {
  const missing = Array.from(new Set(tracks.filter((track) => !track.duration).map((track) => track.id))).slice(0, 100);
  if (!missing.length) {
    return tracks;
  }
  const known: Record<string, number> = {};
  try {
    const response = await callInnertube("music/get_queue", { videoIds: missing }, config);
    for (const panel of findAll<JsonRecord>(response, "playlistPanelVideoRenderer")) {
      const id = typeof panel.videoId === "string" ? panel.videoId : "";
      const seconds = secondsOf(textOf(panel.lengthText));
      if (id && seconds > 0) {
        known[id] = seconds;
      }
    }
  } catch (error) {
    console.warn("music/get_queue failed:", error instanceof Error ? error.message : String(error));
  }
  for (const track of tracks) {
    if (!track.duration && known[track.id]) {
      track.duration = known[track.id];
    }
  }
  return tracks;
}

export async function getVisitorData(config: RuntimeConfig, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = getCachedVisitorData();
    if (cached) {
      return cached;
    }
  }
  const response = await callInnertube<JsonRecord>("visitor_id", {}, config, {
    ...buildWebRemixProfile(config.language),
    anonymous: true,
  });
  const responseContext = response.responseContext as JsonRecord | undefined;
  const visitorData = typeof responseContext?.visitorData === "string" ? responseContext.visitorData : "";
  if (!visitorData) {
    throw new Error(Widget.i18n("YouTube 未返回有效的访问标识 (visitorData)"));
  }
  setCachedVisitorData(visitorData);
  return visitorData;
}

export function selectBestAudioFormat(
  adaptiveFormats: AdaptiveFormat[] | undefined,
  preference: AudioFormatPreference,
): AdaptiveFormat | null {
  const candidates = (adaptiveFormats || []).filter((format) => {
    if (!format.mimeType?.startsWith("audio/") || !format.url || format.isDrc) {
      return false;
    }
    if (format.audioTrack && format.audioTrack.audioIsDefault === false) {
      return false;
    }
    return true;
  });

  if (!candidates.length) {
    return null;
  }

  const pickHighest = (list: AdaptiveFormat[]): AdaptiveFormat | null => {
    let best: AdaptiveFormat | null = null;
    for (const item of list) {
      if (!best || (item.bitrate || 0) > (best.bitrate || 0)) {
        best = item;
      }
    }
    return best;
  };

  if (preference === "aac") {
    const mp4 = candidates.filter((f) => f.mimeType?.startsWith("audio/mp4"));
    return pickHighest(mp4) || pickHighest(candidates);
  }
  if (preference === "opus") {
    const webm = candidates.filter((f) => f.mimeType?.startsWith("audio/webm"));
    return pickHighest(webm) || pickHighest(candidates);
  }
  return pickHighest(candidates);
}

export function resolvePlayerType(preference: PlayerTypePreference, mimeType: string): "system" | "app" | undefined {
  if (preference === "system" || preference === "app") {
    return preference;
  }
  // iOS/macOS system AVPlayer cannot decode WebM/Opus; guide Rex to software decoder automatically.
  if (mimeType.startsWith("audio/webm")) {
    return "app";
  }
  return undefined;
}

async function fetchPlayerWithClient(
  videoId: string,
  config: RuntimeConfig,
  clientKind: "visionos" | "ios",
  visitorData: string,
): Promise<Omit<CachedAudioStream, "cachedAt">> {
  const profile = clientKind === "visionos" ? buildVisionOsProfile(visitorData) : buildIosProfile(visitorData);
  const response = await callInnertube<PlayerResponse>(
    "player",
    { videoId, contentCheckOk: true, racyCheckOk: true },
    config,
    profile,
  );
  const status = response.playabilityStatus;
  if (status?.status !== "OK") {
    const reason = status?.reason || `YouTube playability status: ${status?.status || "UNKNOWN"}`;
    const err = new Error(reason) as Error & { unplayable?: boolean };
    if (status?.status === "UNPLAYABLE" || status?.status === "ERROR") {
      err.unplayable = true;
    }
    throw err;
  }

  const chosen = selectBestAudioFormat(response.streamingData?.adaptiveFormats, config.audioFormat);
  if (!chosen?.url || !chosen.mimeType) {
    throw new Error(Widget.i18n("YouTube 未返回可直接播放的音频流"));
  }

  const details = response.videoDetails;
  const durationSec = details?.lengthSeconds ? Number(details.lengthSeconds) : 0;

  return {
    url: chosen.url,
    mimeType: chosen.mimeType,
    bitrate: chosen.bitrate || 0,
    headers: {
      "User-Agent": clientKind === "ios" ? IOS_UA : WEB_UA,
    },
    ...(Number.isFinite(durationSec) && durationSec > 0 ? { duration: durationSec } : {}),
    ...(details?.title ? { title: details.title } : {}),
    ...(details?.author ? { author: details.author.replace(/\s*-\s*Topic$/i, "") } : {}),
    ...(details?.channelId ? { channelId: details.channelId } : {}),
    ...(details?.thumbnail ? { coverUrl: imageOf(details.thumbnail) } : {}),
  };
}

export async function resolveAudioStream(videoId: string, config: RuntimeConfig): Promise<CachedAudioStream> {
  const cached = getCachedStream(videoId, config.audioFormat);
  if (cached) {
    return cached;
  }

  let visitorData = await getVisitorData(config);
  try {
    const stream = await fetchPlayerWithClient(videoId, config, "visionos", visitorData);
    setCachedStream(videoId, config.audioFormat, stream);
    return { ...stream, cachedAt: Date.now() };
  } catch (visionError) {
    const unplayable = Boolean((visionError as { unplayable?: boolean })?.unplayable);
    if (unplayable) {
      throw visionError;
    }
    console.warn(
      `VISIONOS player failed for ${videoId}, retrying with fresh visitorData / IOS fallback:`,
      visionError instanceof Error ? visionError.message : String(visionError),
    );
    clearCachedVisitorData();
    visitorData = await getVisitorData(config, true);

    try {
      const stream = await fetchPlayerWithClient(videoId, config, "ios", visitorData);
      setCachedStream(videoId, config.audioFormat, stream);
      return { ...stream, cachedAt: Date.now() };
    } catch (iosError) {
      console.warn(
        `IOS player fallback failed for ${videoId}:`,
        iosError instanceof Error ? iosError.message : String(iosError),
      );
      throw visionError;
    }
  }
}

function playbackNonce(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function reportPlaybackHistory(videoId: string, config: RuntimeConfig): Promise<void> {
  if (!config.reportHistory || !parseCookieAuthInput(config.cookie).hasSapisid) {
    return;
  }
  try {
    const player = await callInnertube<PlayerResponse>(
      "player",
      { videoId, playbackContext: { contentPlaybackContext: {} } },
      config,
      buildWebRemixProfile(config.language),
      8,
    );
    const baseUrl = player.playbackTracking?.videostatsPlaybackUrl?.baseUrl;
    if (!baseUrl) {
      return;
    }
    const parsed = parseHttpsUrlParts(baseUrl);
    if (!parsed || !isYouTubeHostname(parsed.hostname)) {
      return;
    }
    const trackingUrl = setQueryParams(baseUrl, {
      ver: "2",
      c: "WEB_REMIX",
      cpn: playbackNonce(),
    });
    await Widget.http.request({
      url: trackingUrl,
      method: "GET",
      headers: {
        "user-agent": WEB_UA,
        referer: `${YTM_SITE}/`,
        ...buildAuthHeaders(config.cookie, parsed.origin),
      },
      timeout: 8,
      decodable: false,
    });
  } catch (error) {
    console.warn(`reporting playback for ${videoId} failed:`, error instanceof Error ? error.message : String(error));
  }
}
