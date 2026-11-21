export const YTM_SITE = "https://music.youtube.com";

export const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const VISION_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

export const IOS_UA = "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)";

export const VISITOR_DATA_TTL_MS = 6 * 60 * 60 * 1000;
export const STREAM_CACHE_TTL_MS = 60 * 60 * 1000;
export const STREAM_EXPIRY_SAFETY_MARGIN_SECONDS = 5 * 60;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PLAYLIST_CONTINUATION_PAGES = 5;

export type AudioFormatPreference = "aac" | "opus" | "best";
export type PlayerTypePreference = "auto" | "system" | "app";
export type SearchFilterKind = "songs" | "albums" | "artists" | "playlists";

export const SEARCH_FILTERS: Record<SearchFilterKind, string> = {
  songs: "EgWKAQIIAWoMEA4QChADEAQQCRAF",
  albums: "EgWKAQIYAWoMEA4QChADEAQQCRAF",
  artists: "EgWKAQIgAWoMEA4QChADEAQQCRAF",
  playlists: "EgeKAQQoAEABagwQDhAKEAMQBBAJEAU=",
};

export interface InnertubeClientProfile {
  client: Record<string, unknown>;
  headers?: Record<string, string>;
  anonymous?: boolean;
}

export function buildWebClientVersion(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `1.${year}${month}${day}.01.00`;
}

export function normalizeYouTubeLanguage(language?: string): string {
  const normalized = (language || "").trim().replace(/_/g, "-");
  if (!normalized) {
    return "zh-CN";
  }
  const lower = normalized.toLowerCase();
  if (lower.startsWith("zh")) {
    if (/(?:hant|tw|hk|mo)/.test(lower)) {
      return "zh-TW";
    }
    return "zh-CN";
  }
  const base = lower.split("-")[0];
  if (base === "ja" || base === "ko" || base === "en" || base === "es" || base === "fr" || base === "ru") {
    return base;
  }
  if (lower.startsWith("pt")) {
    return "pt";
  }
  return "en";
}

export function buildWebRemixProfile(language?: string): InnertubeClientProfile {
  return {
    client: {
      clientName: "WEB_REMIX",
      clientVersion: buildWebClientVersion(),
      hl: normalizeYouTubeLanguage(language),
    },
  };
}

export function buildVisionOsProfile(visitorData: string): InnertubeClientProfile {
  return {
    client: {
      clientName: "VISIONOS",
      clientVersion: "1.02",
      deviceMake: "Apple",
      deviceModel: "RealityDevice17,1",
      userAgent: VISION_UA,
      osName: "visionOS",
      osVersion: "26.5.23O471",
      visitorData,
    },
    headers: {
      "user-agent": VISION_UA,
      "x-goog-visitor-id": visitorData,
      "x-youtube-client-name": "101",
      "x-youtube-client-version": "1.02",
    },
    anonymous: true,
  };
}

export function buildIosProfile(visitorData: string): InnertubeClientProfile {
  return {
    client: {
      clientName: "IOS",
      clientVersion: "20.10.4",
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.3.2.22D82",
      visitorData,
    },
    headers: {
      "user-agent": IOS_UA,
      "x-goog-visitor-id": visitorData,
    },
    anonymous: true,
  };
}

export function plainPlaylistId(id: string): string {
  return (id || "").replace(/^VL/, "");
}

export const LINK_PREFIX = {
  song: "ytm:song:",
  album: "ytm:album:",
  playlist: "ytm:playlist:",
  genre: "ytm:genre:",
  radio: "ytm:radio:",
} as const;

export function songLink(videoId: string): string {
  return `${LINK_PREFIX.song}${videoId}`;
}

export function albumLink(browseId: string): string {
  return `${LINK_PREFIX.album}${browseId}`;
}

export function playlistLink(playlistId: string): string {
  return `${LINK_PREFIX.playlist}${plainPlaylistId(playlistId)}`;
}

export function genreLink(genreId: string): string {
  return `${LINK_PREFIX.genre}${genreId}`;
}

export function radioLink(radioId: string): string {
  return `${LINK_PREFIX.radio}${radioId}`;
}

export type ParsedDetailLink =
  | { kind: "song"; id: string }
  | { kind: "album"; id: string }
  | { kind: "playlist"; id: string };

export function parseDetailLink(link: string): ParsedDetailLink | null {
  const trimmed = (link || "").trim();
  if (trimmed.startsWith(LINK_PREFIX.song)) {
    const id = trimmed.slice(LINK_PREFIX.song.length).trim();
    return id ? { kind: "song", id } : null;
  }
  if (trimmed.startsWith(LINK_PREFIX.album)) {
    const id = trimmed.slice(LINK_PREFIX.album.length).trim();
    return id ? { kind: "album", id } : null;
  }
  if (trimmed.startsWith(LINK_PREFIX.playlist)) {
    const id = plainPlaylistId(trimmed.slice(LINK_PREFIX.playlist.length).trim());
    return id ? { kind: "playlist", id } : null;
  }
  // 兼容直接传入 YouTube Music / YouTube 网页链接
  const watchMatch = /[?&]v=([a-zA-Z0-9_-]{11})(?:&|$)/.exec(trimmed);
  if (watchMatch?.[1]) {
    return { kind: "song", id: watchMatch[1] };
  }
  const listMatch = /[?&]list=([a-zA-Z0-9_-]+)(?:&|$)/.exec(trimmed);
  if (listMatch?.[1]) {
    return { kind: "playlist", id: plainPlaylistId(listMatch[1]) };
  }
  const browseMatch = /music\.youtube\.com\/browse\/(MPREb_[a-zA-Z0-9_-]+)/.exec(trimmed);
  if (browseMatch?.[1]) {
    return { kind: "album", id: browseMatch[1] };
  }
  return null;
}
