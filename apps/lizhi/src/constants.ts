export const REPO = "nj-lizhi/song";
export const BRANCH = "main";
export const ARTIST_ID = "lizhi";
export const ARTIST_COVER_PATH = "audio/cover.png";

// jsDelivr does not serve files over 20 MiB from GitHub repositories.
export const CDN_LIMIT = 20 * 1024 * 1024;
export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
// The fallback list-v2.js omits file sizes, so retry GitHub Tree API sooner.
export const PARTIAL_TTL_MS = 60 * 60 * 1000;

export const RECENT_MAX = 50;
export const DAILY_PICKS_COUNT = 30;
export const DEFAULT_PAGE_SIZE = 30;
export const RADIO_PAGE_SIZE = 20;
export const ARTIST_SONGS_PAGE_SIZE = 20;
export const SEARCH_PAGE_SIZE = 50;
export const RELATED_ALBUMS_LIMIT = 10;

export const GITHUB_TREE_URL = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
export const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;

export type CdnMirrorPreference = "testingcf" | "jsdelivr" | "fastly" | "raw";
export type PlayerTypePreference = "auto" | "system" | "app";
export type AudioExt = "mp3" | "flac" | "wav";

export const CDN_MIRROR_BASES: Record<CdnMirrorPreference, string> = {
  testingcf: `https://testingcf.jsdelivr.net/gh/${REPO}@${BRANCH}/`,
  jsdelivr: `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/`,
  fastly: `https://fastly.jsdelivr.net/gh/${REPO}@${BRANCH}/`,
  raw: RAW_BASE,
};

export const AUDIO_EXT_REGEX = /\.(mp3|flac|wav)$/i;
export const AUDIO_PATH_REGEX = /^audio\/[^/]+\/[^/]+$/;
export const ALBUM_COVER_PATH_REGEX = /^audio\/([^/]+)\/cover\.png$/i;

export const LINK_PREFIX = {
  song: "lizhi:song:",
  album: "lizhi:album:",
  playlist: "lizhi:playlist:",
  radio: "lizhi:radio:",
} as const;

export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function safeDecodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

export function resolveCdnBase(mirror: CdnMirrorPreference): string {
  return CDN_MIRROR_BASES[mirror] || CDN_MIRROR_BASES.testingcf;
}

export function resolveAssetUrl(path: string, mirror: CdnMirrorPreference, size = 0): string {
  const base = mirror === "raw" || size > CDN_LIMIT ? RAW_BASE : resolveCdnBase(mirror);
  return `${base}${encodePath(path)}`;
}

export function resolvePlayerType(preference: PlayerTypePreference, ext: string): "system" | "app" | undefined {
  if (preference === "system" || preference === "app") {
    return preference;
  }
  // Standalone FLAC over HTTP can be unreliable on native AVPlayer; prefer software decoder automatically.
  if (ext.toLowerCase() === "flac") {
    return "app";
  }
  return undefined;
}

export function extractAudioExt(path: string): AudioExt | null {
  const match = AUDIO_EXT_REGEX.exec(path);
  if (!match?.[1]) {
    return null;
  }
  const ext = match[1].toLowerCase();
  if (ext === "mp3" || ext === "flac" || ext === "wav") {
    return ext;
  }
  return null;
}

export function songLink(path: string): string {
  return `${LINK_PREFIX.song}${path}`;
}

export function albumLink(folder: string): string {
  return `${LINK_PREFIX.album}${folder}`;
}

export function playlistLink(playlistId: string): string {
  return `${LINK_PREFIX.playlist}${playlistId}`;
}

export function radioLink(radioId: string): string {
  return `${LINK_PREFIX.radio}${radioId}`;
}

export type ParsedDetailLink =
  | { kind: "song"; id: string }
  | { kind: "album"; id: string }
  | { kind: "playlist"; id: string };

export function extractRepoAudioPath(url: string): string | null {
  const cleaned = (url || "").trim().replace(/[?#].*$/, "");
  const prefixes = [
    `https://github.com/${REPO}/blob/${BRANCH}/`,
    `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`,
    `/${REPO}@${BRANCH}/`,
  ];
  for (const prefix of prefixes) {
    const idx = cleaned.indexOf(prefix);
    if (idx < 0) {
      continue;
    }
    const candidate = safeDecodePath(cleaned.slice(idx + prefix.length));
    if (AUDIO_PATH_REGEX.test(candidate) && AUDIO_EXT_REGEX.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function parseDetailLink(link: string): ParsedDetailLink | null {
  const trimmed = (link || "").trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith(LINK_PREFIX.song)) {
    const id = trimmed.slice(LINK_PREFIX.song.length).trim();
    return id ? { kind: "song", id } : null;
  }
  if (trimmed.startsWith(LINK_PREFIX.album)) {
    const id = trimmed.slice(LINK_PREFIX.album.length).trim();
    return id ? { kind: "album", id } : null;
  }
  if (trimmed.startsWith(LINK_PREFIX.playlist)) {
    const id = trimmed.slice(LINK_PREFIX.playlist.length).trim();
    return id ? { kind: "playlist", id } : null;
  }
  const repoPath = extractRepoAudioPath(trimmed);
  if (repoPath) {
    return { kind: "song", id: repoPath };
  }
  return null;
}
