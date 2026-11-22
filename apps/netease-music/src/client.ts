import { extractManagedSetCookies, parseCookieAuthInput, serializeCookiePairs } from "./auth";
import {
  EAPI_ANDROID_UA,
  EAPI_CLIENT,
  EAPI_CLIENT_ANDROID,
  EAPI_UA,
  isFlacQuality,
  NCM_EAPI_HOST,
  NCM_SITE,
  normalizeHttpsUrl,
  QUALITY_BITRATES,
  SONG_DETAIL_BATCH_SIZE,
  WEB_UA,
} from "./constants";
import { encodeEapiPayload } from "./crypto";
import type { NeteaseLyricResponse } from "./lyrics";
import { type JsonRecord, type NcmTrackRef, parseTrack } from "./parser";
import {
  applyServerCookieUpdate,
  getCachedAccount,
  getCachedStream,
  getOrCreateDeviceId,
  getServerCookies,
  type RuntimeConfig,
  setCachedAccount,
  setCachedStream,
} from "./storage";

export class NeteaseApiError extends Error {
  readonly code: number;
  readonly transient: boolean;

  constructor(message: string, code = 0, transient = false) {
    super(message);
    this.name = "NeteaseApiError";
    this.code = code;
    this.transient = transient;
  }
}

export interface ResolvedAudioStream {
  url: string;
  format: string;
  level: string;
  bitrate: number;
  isTrial: boolean;
  headers: Record<string, string>;
}

interface SongUrlEntry {
  id?: number | string;
  url?: string | null;
  type?: string | null;
  level?: string | null;
  br?: number;
  code?: number;
  freeTrialInfo?: unknown;
}

const SUPPORTED_FORMATS = new Set(["mp3", "flac", "m4a", "aac", "ogg", "wav", "mp4"]);

function buildMergedCookies(config: RuntimeConfig): Record<string, string> {
  const server = getServerCookies();
  const parsed = parseCookieAuthInput(config.cookie);
  const merged: Record<string, string> = {};
  if (server.NMTID) {
    merged.NMTID = server.NMTID;
  }
  if (server.__csrf) {
    merged.__csrf = server.__csrf;
  }
  Object.assign(merged, parsed.cookies);
  // Keep server-refreshed NMTID if the user did not supply one explicitly
  if (!parsed.cookies.NMTID && server.NMTID) {
    merged.NMTID = server.NMTID;
  }
  return merged;
}

function encodeFormBody(params: Record<string, string | number | boolean>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

function parseJsonResponse<T>(raw: unknown): T {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new NeteaseApiError(Widget.i18n("网易云返回了无法解析的响应"), 0, false);
    }
  }
  if (raw && typeof raw === "object") {
    return raw as T;
  }
  throw new NeteaseApiError(Widget.i18n("网易云返回了无效数据"), 0, false);
}

function checkApiCode(data: JsonRecord, allowedCodes: readonly number[]): void {
  const rawCode = data.code;
  if (rawCode === undefined || rawCode === null) {
    return;
  }
  const code = Number(rawCode);
  if (allowedCodes.includes(code)) {
    return;
  }
  if (code === 301 || code === 302 || code === 401) {
    throw new NeteaseApiError(Widget.i18n("网易云登录状态已失效或需要登录，请检查 Cookie 配置"), code, false);
  }
  if (code === -460 || code === 460) {
    throw new NeteaseApiError(Widget.i18n("网易云暂时触发风控限制，请稍后重试"), code, true);
  }
  if (code === 405 || code === 429) {
    throw new NeteaseApiError(Widget.i18n("网易云请求过于频繁，请稍后重试"), code, true);
  }
  const msg = typeof data.message === "string" && data.message.trim() ? data.message.trim() : `code ${code}`;
  throw new NeteaseApiError(`${Widget.i18n("网易云接口返回错误")} (${msg})`, code, code >= 500);
}

function isTransientTransportError(error: unknown): boolean {
  if (error instanceof NeteaseApiError) {
    return error.transient;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /^HTTP\s+(?:429|5\d\d)\b/i.test(message);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTransientRetry<T>(task: (attempt: number) => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (!isTransientTransportError(error) || attempt >= maxAttempts) {
        throw error;
      }
      await sleep(attempt * 250);
    }
  }
  throw lastError;
}

export async function webRequest<T extends JsonRecord = JsonRecord>(
  path: string,
  params: Record<string, string | number | boolean> = {},
  config: RuntimeConfig,
  options: { method?: "GET" | "POST"; allowedCodes?: readonly number[]; timeout?: number } = {},
): Promise<T> {
  const method = options.method || "GET";
  const cookies = buildMergedCookies(config);
  const queryParams: Record<string, string | number | boolean> = { ...params };
  if (method === "POST" && cookies.__csrf && queryParams.csrf_token === undefined) {
    queryParams.csrf_token = cookies.__csrf;
  }

  const cookieStr = serializeCookiePairs(cookies);
  const headers: Record<string, string> = {
    "user-agent": WEB_UA,
    referer: `${NCM_SITE}/`,
    ...(cookieStr ? { cookie: cookieStr } : {}),
  };

  let url = `${NCM_SITE}${path}`;
  let data: string | undefined;
  if (method === "POST") {
    headers["content-type"] = "application/x-www-form-urlencoded";
    data = encodeFormBody(queryParams);
  } else {
    const query = encodeFormBody(queryParams);
    if (query) {
      url += (url.includes("?") ? "&" : "?") + query;
    }
  }

  const response = await Widget.http.request<T>({
    url,
    method,
    headers,
    ...(data !== undefined ? { data } : {}),
    timeout: options.timeout ?? 18,
  });

  applyServerCookieUpdate(extractManagedSetCookies(response.headers));
  const parsed = parseJsonResponse<T>(response.data);
  checkApiCode(parsed, options.allowedCodes ?? [200]);
  return parsed;
}

export async function eapiRequest<T extends JsonRecord = JsonRecord>(
  path: string,
  payload: Record<string, unknown>,
  config: RuntimeConfig,
  options: { allowedCodes?: readonly number[]; timeout?: number; clientProfile?: "pc" | "android" } = {},
): Promise<T> {
  const cookies = buildMergedCookies(config);
  const now = Date.now();
  const deviceId = getOrCreateDeviceId();
  const useAndroid = options.clientProfile === "android";
  const client = useAndroid ? EAPI_CLIENT_ANDROID : EAPI_CLIENT;
  const userAgent = useAndroid ? EAPI_ANDROID_UA : EAPI_UA;

  const header: Record<string, string> = {
    ...client,
    deviceId,
    mobilename: "",
    buildver: String(Math.floor(now / 1000)),
    requestId: `${now}_${String(Math.floor(Math.random() * 1000)).padStart(4, "0")}`,
    __csrf: cookies.__csrf || "",
  };
  if (cookies.MUSIC_U) {
    header.MUSIC_U = cookies.MUSIC_U;
  }
  if (cookies.NMTID) {
    header.NMTID = cookies.NMTID;
  }

  const encrypted = encodeEapiPayload(path, {
    ...payload,
    header,
    e_r: false,
  });

  const eapiCookie = Object.entries(header)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("; ");

  const url = `${NCM_EAPI_HOST}${path.replace(/^\/api\//, "/eapi/")}`;
  const response = await Widget.http.request<T>({
    url,
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": userAgent,
      cookie: eapiCookie,
    },
    data: `params=${encrypted}`,
    timeout: options.timeout ?? 18,
  });

  applyServerCookieUpdate(extractManagedSetCookies(response.headers));
  const parsed = parseJsonResponse<T>(response.data);
  checkApiCode(parsed, options.allowedCodes ?? [200]);
  return parsed;
}

export async function resolveAccountUid(config: RuntimeConfig): Promise<{ uid: string; nickname: string }> {
  const parsedAuth = parseCookieAuthInput(config.cookie);
  if (!parsedAuth.hasMusicU) {
    throw new Error(Widget.i18n("请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后查看个人内容"));
  }
  const cacheKey = parsedAuth.cookies.MUSIC_U;
  const cached = getCachedAccount(cacheKey);
  if (cached) {
    return { uid: cached.uid, nickname: cached.nickname };
  }

  const response = await webRequest<{
    account?: { id?: number | string };
    profile?: { userId?: number | string; nickname?: string };
  }>("/api/nuser/account/get", {}, config);

  const rawUid = response.profile?.userId ?? response.account?.id;
  const uid = rawUid ? String(rawUid) : "";
  if (!uid || !/^\d+$/.test(uid) || !response.profile) {
    throw new Error(Widget.i18n("网易云登录状态已失效或 Cookie 无效，请更新包含 MUSIC_U 的 Cookie"));
  }
  const nickname = typeof response.profile.nickname === "string" ? response.profile.nickname : "";
  setCachedAccount(uid, nickname, cacheKey);
  return { uid, nickname };
}

export async function fetchSongDetails(ids: string[], config: RuntimeConfig): Promise<NcmTrackRef[]> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => /^\d+$/.test(id))));
  if (!uniqueIds.length) {
    return [];
  }

  const byId = new Map<string, NcmTrackRef>();
  for (let i = 0; i < uniqueIds.length; i += SONG_DETAIL_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + SONG_DETAIL_BATCH_SIZE);
    const response = await webRequest<{ songs?: unknown[] }>(
      "/api/v3/song/detail",
      { c: JSON.stringify(batch.map((id) => ({ id: Number(id) }))) },
      config,
      { method: "POST" },
    );
    for (const rawSong of Array.isArray(response.songs) ? response.songs : []) {
      const track = parseTrack(rawSong);
      if (track) {
        byId.set(track.id, track);
      }
    }
  }

  const ordered: NcmTrackRef[] = [];
  for (const id of uniqueIds) {
    const found = byId.get(id);
    if (found) {
      ordered.push(found);
    }
  }
  return ordered;
}

function pickStreamEntry(entries: SongUrlEntry[], songId: string): SongUrlEntry | undefined {
  return entries.find((item) => String(item.id) === songId) ?? entries[0];
}

export async function resolveAudioStream(songId: string, config: RuntimeConfig): Promise<ResolvedAudioStream> {
  const cached = getCachedStream(songId, config.quality, config.allowTrial);
  if (cached) {
    return {
      url: cached.url,
      format: cached.format,
      level: cached.level,
      bitrate: cached.bitrate,
      isTrial: cached.isTrial,
      headers: {
        "User-Agent": WEB_UA,
        Referer: `${NCM_SITE}/`,
      },
    };
  }

  const encodeType = config.quality === "vivid" ? "mp3" : isFlacQuality(config.quality) ? "flac" : "mp3";
  const clientProfile: "pc" | "android" = config.quality === "vivid" ? "android" : "pc";
  const v1Payload: Record<string, unknown> = {
    ids: `[${songId}]`,
    level: config.quality,
    encodeType,
  };
  if (config.quality === "sky") {
    v1Payload.immerseType = "c51";
  }

  let entries: SongUrlEntry[] = [];

  try {
    const response = await withTransientRetry(
      () =>
        eapiRequest<{ data?: SongUrlEntry[] }>("/api/song/enhance/player/url/v1", v1Payload, config, {
          clientProfile,
        }),
      3,
    );
    entries = Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    if (!isTransientTransportError(error)) {
      throw error;
    }
    // Fallback to legacy bitrate-based EAPI endpoint when v1 encounters risk-control rejection
    const fallback = await withTransientRetry(
      () =>
        eapiRequest<{ data?: SongUrlEntry[] }>(
          "/api/song/enhance/player/url",
          {
            ids: `[${songId}]`,
            br: QUALITY_BITRATES[config.quality] || 320000,
          },
          config,
        ),
      2,
    );
    entries = Array.isArray(fallback.data) ? fallback.data : [];
  }

  const chosen = pickStreamEntry(entries, songId);
  const secureUrl = normalizeHttpsUrl(chosen?.url ?? undefined);
  const isTrial = chosen?.freeTrialInfo !== null && chosen?.freeTrialInfo !== undefined;

  if (!chosen || !secureUrl || (chosen.code !== undefined && chosen.code !== 200)) {
    throw new Error(Widget.i18n("当前歌曲暂无可用播放源，可能需要登录网易云黑胶 VIP 账号或受地区版权限制"));
  }

  if (isTrial && !config.allowTrial) {
    throw new Error(
      Widget.i18n("当前歌曲仅返回 30 秒 VIP 试听片段；请配置黑胶 VIP Cookie，或在模块设置中开启「允许播放 30 秒试听」"),
    );
  }

  const rawFormat = (
    chosen.type || (chosen.level && isFlacQuality(chosen.level as RuntimeConfig["quality"]) ? "flac" : "mp3")
  ).toLowerCase();
  const format = SUPPORTED_FORMATS.has(rawFormat) ? rawFormat : "mp3";
  const level = typeof chosen.level === "string" && chosen.level ? chosen.level : config.quality;
  const bitrate = typeof chosen.br === "number" && Number.isFinite(chosen.br) ? chosen.br : 0;

  setCachedStream(songId, config.quality, config.allowTrial, {
    url: secureUrl,
    format,
    level,
    bitrate,
    isTrial,
  });

  return {
    url: secureUrl,
    format,
    level,
    bitrate,
    isTrial,
    headers: {
      "User-Agent": WEB_UA,
      Referer: `${NCM_SITE}/`,
    },
  };
}

export async function fetchSongLyric(songId: string, config: RuntimeConfig): Promise<NeteaseLyricResponse> {
  return eapiRequest<NeteaseLyricResponse & JsonRecord>(
    "/api/song/lyric",
    {
      id: songId,
      tv: -1,
      lv: -1,
      rv: -1,
      kv: -1,
      _nmclfl: 1,
    },
    config,
    { timeout: 10 },
  );
}

export async function fetchSongDynamicCover(songId: string, config: RuntimeConfig): Promise<string | undefined> {
  if (!parseCookieAuthInput(config.cookie).hasMusicU) {
    return undefined;
  }
  const response = await eapiRequest<{ data?: { videoPlayUrl?: string } }>(
    "/api/songplay/dynamic-cover",
    { songId },
    config,
    { timeout: 6 },
  );
  return normalizeHttpsUrl(response.data?.videoPlayUrl);
}

export async function fetchMvUrl(mvId: number, config: RuntimeConfig): Promise<string | undefined> {
  if (!Number.isFinite(mvId) || mvId <= 0) {
    return undefined;
  }
  const response = await eapiRequest<{ data?: { url?: string } }>(
    "/api/song/enhance/play/mv/url",
    { id: Math.floor(mvId), r: 1080 },
    config,
    { timeout: 6 },
  );
  return normalizeHttpsUrl(response.data?.url);
}

export async function scrobbleSong(
  songId: string,
  sourceId: string | undefined,
  durationSec: number,
  config: RuntimeConfig,
): Promise<void> {
  if (!config.reportHistory || !parseCookieAuthInput(config.cookie).hasMusicU) {
    return;
  }
  await eapiRequest(
    "/api/feedback/weblog",
    {
      logs: JSON.stringify([
        {
          action: "play",
          json: {
            download: 0,
            end: "playend",
            id: songId,
            sourceId: sourceId || "",
            time: Math.max(0, Math.round(durationSec)),
            type: "song",
            wifi: 0,
            source: "list",
            mainsite: 1,
            content: "",
          },
        },
      ]),
    },
    config,
    { timeout: 6 },
  );
}
