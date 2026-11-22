export const NCM_SITE = "https://music.163.com";
export const NCM_EAPI_HOST = "https://interfacepc.music.163.com";
export const EAPI_KEY = "e82ckenh8dichen8";

export const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const EAPI_CLIENT = {
  osver: "Microsoft-Windows-10-Professional-build-19045-64bit",
  os: "pc",
  appver: "3.1.29.205117",
  versioncode: "140",
  resolution: "1920x1080",
  channel: "netease",
} as const;

export const EAPI_CLIENT_ANDROID = {
  osver: "14",
  os: "android",
  appver: "9.5.61",
  versioncode: "9005061",
  resolution: "1080x2400",
  channel: "xiaomi",
} as const;

export const EAPI_UA = `Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/${EAPI_CLIENT.appver}`;
export const EAPI_ANDROID_UA =
  "NeteaseMusic/9.5.61.260802021928(9005061);Dalvik/2.1.0 (Linux; U; Android 12; HBN-AL00 Build/cd737a2.0)";

export const PRIVATE_RADAR_PLAYLIST_ID = "3136952023";

export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PLAYLIST_TRACKS = 300;
export const MAX_PODCAST_PROGRAMS = 100;
export const SONG_DETAIL_BATCH_SIZE = 100;
export const STREAM_CACHE_TTL_MS = 15 * 60 * 1000;
export const ACCOUNT_CACHE_TTL_MS = 30 * 60 * 1000;
export const GENRE_COVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ARTIST_AVATAR_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type QualityPreference =
  | "standard"
  | "higher"
  | "exhigh"
  | "lossless"
  | "hires"
  | "jyeffect"
  | "sky"
  | "dolby"
  | "vivid"
  | "jymaster";
export type PlayerTypePreference = "auto" | "system" | "app";
export type SearchKind = "all" | "songs" | "albums" | "artists" | "playlists" | "dj" | "lyrics" | "voices";
export type ReleaseArea = "ALL" | "ZH" | "EA" | "KR" | "JP";
export type ArtistArea = "ALL" | "ZH" | "EA" | "JP" | "KR" | "OTHER";
export type ArtistType = "ALL" | "MALE" | "FEMALE" | "BAND";
export type BannerClientType = "ipad" | "pc" | "iphone" | "android";

export const QUALITY_LEVELS: readonly QualityPreference[] = [
  "standard",
  "higher",
  "exhigh",
  "lossless",
  "hires",
  "jyeffect",
  "sky",
  "dolby",
  "vivid",
  "jymaster",
] as const;

export const QUALITY_BITRATES: Record<QualityPreference, number> = {
  standard: 128000,
  higher: 192000,
  exhigh: 320000,
  lossless: 999000,
  hires: 999000,
  jyeffect: 999000,
  sky: 999000,
  dolby: 999000,
  vivid: 999000,
  jymaster: 999000,
};

export function isFlacQuality(quality: QualityPreference): boolean {
  return (
    quality === "lossless" ||
    quality === "hires" ||
    quality === "jyeffect" ||
    quality === "sky" ||
    quality === "dolby" ||
    quality === "jymaster"
  );
}

export const NEW_SONG_AREA_IDS: Record<ReleaseArea, number> = {
  ALL: 0,
  ZH: 7,
  EA: 96,
  KR: 16,
  JP: 8,
};

export const ARTIST_AREA_CODES: Record<ArtistArea, number> = {
  ALL: -1,
  ZH: 7,
  EA: 96,
  JP: 8,
  KR: 16,
  OTHER: 0,
};

export const ARTIST_TYPE_CODES: Record<ArtistType, number> = {
  ALL: -1,
  MALE: 1,
  FEMALE: 2,
  BAND: 3,
};

export const CHART_ARTIST_AREA_CODES: Record<Exclude<ReleaseArea, "ALL">, number> = {
  ZH: 1,
  EA: 2,
  KR: 3,
  JP: 4,
};

export const SEARCH_TYPE_CODES: Record<Exclude<SearchKind, "all" | "voices">, number> = {
  songs: 1,
  albums: 10,
  artists: 100,
  playlists: 1000,
  lyrics: 1006,
  dj: 1009,
};

export interface CuratedGenre {
  id: string;
  title: string;
  subtitle: string;
  styleTagId?: string;
  artistArea?: ArtistArea;
}

export const CURATED_GENRES: readonly CuratedGenre[] = [
  { id: "华语", title: "华语", subtitle: "语种", artistArea: "ZH" },
  { id: "欧美", title: "欧美", subtitle: "语种", artistArea: "EA" },
  { id: "日语", title: "日语", subtitle: "语种", artistArea: "JP" },
  { id: "韩语", title: "韩语", subtitle: "语种", artistArea: "KR" },
  { id: "粤语", title: "粤语", subtitle: "语种", artistArea: "ZH" },
  { id: "流行", title: "流行", subtitle: "风格", styleTagId: "1000" },
  { id: "摇滚", title: "摇滚", subtitle: "风格", styleTagId: "1008" },
  { id: "民谣", title: "民谣", subtitle: "风格", styleTagId: "1003" },
  { id: "电子", title: "电子", subtitle: "风格", styleTagId: "1015" },
  { id: "说唱", title: "说唱", subtitle: "风格", styleTagId: "1017" },
  { id: "轻音乐", title: "轻音乐", subtitle: "风格", styleTagId: "1006" },
  { id: "爵士", title: "爵士", subtitle: "风格", styleTagId: "1011" },
  { id: "古典", title: "古典", subtitle: "风格", styleTagId: "1022" },
  { id: "古风", title: "古风", subtitle: "风格", styleTagId: "10119" },
  { id: "R&B/Soul", title: "R&B/Soul", subtitle: "风格", styleTagId: "1028" },
  { id: "ACG", title: "ACG", subtitle: "主题", styleTagId: "1252" },
  { id: "影视原声", title: "影视原声", subtitle: "主题", styleTagId: "1010" },
  { id: "游戏", title: "游戏", subtitle: "主题" },
  { id: "怀旧", title: "怀旧", subtitle: "情感" },
  { id: "治愈", title: "治愈", subtitle: "情感" },
  { id: "夜晚", title: "夜晚", subtitle: "场景" },
  { id: "学习", title: "学习", subtitle: "场景" },
  { id: "运动", title: "运动", subtitle: "场景" },
  { id: "驾车", title: "驾车", subtitle: "场景" },
] as const;

export const LINK_PREFIX = {
  song: "ncm:song:",
  album: "ncm:album:",
  playlist: "ncm:playlist:",
  dj: "ncm:dj:",
  hot: "ncm:hot:",
  genre: "ncm:genre:",
  radio: "ncm:radio:",
} as const;

export function songLink(id: string): string {
  return `${LINK_PREFIX.song}${id}`;
}

export function albumLink(id: string): string {
  return `${LINK_PREFIX.album}${id}`;
}

export function playlistLink(id: string): string {
  return `${LINK_PREFIX.playlist}${id}`;
}

export function djLink(id: string): string {
  return `${LINK_PREFIX.dj}${id}`;
}

export function hotSearchLink(keyword: string): string {
  return `${LINK_PREFIX.hot}${encodeURIComponent(keyword.trim())}`;
}

export function genreLink(cat: string): string {
  return `${LINK_PREFIX.genre}${cat}`;
}

export function radioLink(radioId: string): string {
  return `${LINK_PREFIX.radio}${radioId}`;
}

export function isValidNumericId(value: string): boolean {
  return /^\d{1,20}$/.test(value);
}

export type ParsedDetailLink =
  | { kind: "song"; id: string }
  | { kind: "album"; id: string }
  | { kind: "playlist"; id: string }
  | { kind: "dj"; id: string }
  | { kind: "hot"; keyword: string };

export function parseDetailLink(link: string): ParsedDetailLink | null {
  const trimmed = (link || "").trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith(LINK_PREFIX.song)) {
    const id = trimmed.slice(LINK_PREFIX.song.length).trim();
    return isValidNumericId(id) ? { kind: "song", id } : null;
  }
  if (trimmed.startsWith(LINK_PREFIX.album)) {
    const id = trimmed.slice(LINK_PREFIX.album.length).trim();
    return isValidNumericId(id) ? { kind: "album", id } : null;
  }
  if (trimmed.startsWith(LINK_PREFIX.playlist)) {
    const id = trimmed.slice(LINK_PREFIX.playlist.length).trim();
    return isValidNumericId(id) ? { kind: "playlist", id } : null;
  }
  if (trimmed.startsWith(LINK_PREFIX.dj)) {
    const id = trimmed.slice(LINK_PREFIX.dj.length).trim();
    return isValidNumericId(id) ? { kind: "dj", id } : null;
  }
  if (trimmed.startsWith(LINK_PREFIX.hot)) {
    const encoded = trimmed.slice(LINK_PREFIX.hot.length).trim();
    if (!encoded) {
      return null;
    }
    try {
      const keyword = decodeURIComponent(encoded).trim();
      return keyword ? { kind: "hot", keyword } : null;
    } catch {
      return { kind: "hot", keyword: encoded };
    }
  }

  // Compatible with NetEase Cloud Music web/share links
  const webMatch = /music\.163\.com\/(?:#\/)?(song|album|playlist|djradio|radio)\?[^#]*\bid=(\d{1,20})\b/i.exec(
    trimmed,
  );
  if (webMatch?.[1] && webMatch[2]) {
    const rawKind = webMatch[1].toLowerCase();
    const kind = rawKind === "djradio" || rawKind === "radio" ? "dj" : (rawKind as "song" | "album" | "playlist");
    return { kind, id: webMatch[2] };
  }
  return null;
}

export function resolvePlayerType(preference: PlayerTypePreference, format: string): "system" | "app" | undefined {
  if (preference === "system" || preference === "app") {
    return preference;
  }
  // Standalone FLAC/ALAC over HTTP can be unreliable on native AVPlayer; prefer software decoder automatically.
  const lower = format.toLowerCase();
  if (lower === "flac" || lower === "alac") {
    return "app";
  }
  return undefined;
}

export function normalizeHttpsUrl(url?: string): string | undefined {
  if (typeof url !== "string") {
    return undefined;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("http://")) {
    return `https://${trimmed.slice("http://".length)}`;
  }
  return undefined;
}

export function formatCoverUrl(url?: string, size = 500): string | undefined {
  const secure = normalizeHttpsUrl(url);
  if (!secure) {
    return undefined;
  }
  if (!/^https:\/\/p\d+\.music\.126\.net\//i.test(secure)) {
    return secure;
  }
  if (/[?&]param=/i.test(secure)) {
    return secure;
  }
  const cleanBase = /[?&]imageView=/i.test(secure) ? secure.split("?")[0] : secure;
  const sep = cleanBase.includes("?") ? "&" : "?";
  return `${cleanBase}${sep}param=${size}y${size}`;
}
