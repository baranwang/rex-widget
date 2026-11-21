import {
  ALBUM_COVER_PATH_REGEX,
  ARTIST_COVER_PATH,
  AUDIO_EXT_REGEX,
  AUDIO_PATH_REGEX,
  type AudioExt,
  BRANCH,
  CATALOG_TTL_MS,
  type CdnMirrorPreference,
  extractAudioExt,
  GITHUB_TREE_URL,
  PARTIAL_TTL_MS,
  REPO,
  resolveCdnBase,
  safeDecodePath,
} from "./constants";
import {
  type CatalogFile,
  getCachedCatalog,
  type RuntimeConfig,
  type StoredCatalog,
  setCachedCatalog,
} from "./storage";

export interface CatalogTrackEntry {
  id: string;
  name: string;
  ext: AudioExt;
  folder: string;
  size: number;
  coverPath: string;
}

export interface CatalogAlbumEntry {
  id: string;
  name: string;
  coverPath: string;
  ids: string[];
}

export interface Catalog {
  tracks: Map<string, CatalogTrackEntry>;
  albums: Map<string, CatalogAlbumEntry>;
  albumOrder: string[];
  allTrackIds: string[];
}

interface ParsedCatalogPayload {
  files: CatalogFile[];
  coverFolders: string[];
}

interface MemoryCatalogCache {
  time: number;
  partial: boolean;
  catalog: Catalog;
}

let memoryCatalog: MemoryCatalogCache | null = null;

export function resetCatalogMemoryCache(): void {
  memoryCatalog = null;
}

/**
 * Natural numeric sort without relying on Intl.Collator (not guaranteed in lightweight JS runtimes):
 * digit runs compare numerically, everything else compares by code point.
 */
export function compareNatural(a: string, b: string): number {
  const pa = a.match(/\d+|\D+/g) || [];
  const pb = b.match(/\d+|\D+/g) || [];
  const len = Math.min(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) {
      continue;
    }
    if (/^\d/.test(x) && /^\d/.test(y)) {
      return Number(x) - Number(y) || x.length - y.length;
    }
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}

/** Deterministic Mulberry32 PRNG used for daily recommendations. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function todayKey(date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function normalizeSearchText(value: string): string {
  return (value || "").toLowerCase().replace(/\s+/g, "");
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Math.round(bytes)} B`;
}

export function isPartialCatalog(files: readonly CatalogFile[]): boolean {
  return files.some((file) => !file.size);
}

export function parseTreeResponse(data: unknown): ParsedCatalogPayload {
  const tree =
    data && typeof data === "object" && Array.isArray((data as { tree?: unknown }).tree)
      ? ((data as { tree: unknown[] }).tree as Array<{ type?: unknown; path?: unknown; size?: unknown }>)
      : null;
  if (!tree) {
    throw new Error("invalid GitHub tree response");
  }

  const seenPaths = new Set<string>();
  const files: CatalogFile[] = [];
  const coverFolders = new Set<string>();

  for (const entry of tree) {
    if (entry?.type !== "blob" || typeof entry.path !== "string") {
      continue;
    }
    const coverMatch = ALBUM_COVER_PATH_REGEX.exec(entry.path);
    if (coverMatch?.[1]) {
      coverFolders.add(coverMatch[1]);
      continue;
    }
    if (!AUDIO_PATH_REGEX.test(entry.path) || !AUDIO_EXT_REGEX.test(entry.path)) {
      continue;
    }
    if (seenPaths.has(entry.path)) {
      continue;
    }
    seenPaths.add(entry.path);
    const size = typeof entry.size === "number" && Number.isFinite(entry.size) && entry.size > 0 ? entry.size : 0;
    files.push({ path: entry.path, size });
  }

  if (!files.length) {
    throw new Error("empty GitHub tree");
  }
  return { files, coverFolders: Array.from(coverFolders) };
}

export function parseListV2Script(text: string): ParsedCatalogPayload {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("empty list-v2.js");
  }
  const prefixes = [`${REPO}@${BRANCH}/`, `${REPO}/${BRANCH}/`];
  const seenPaths = new Set<string>();
  const files: CatalogFile[] = [];
  const coverFolders = new Set<string>();

  const urlRegex = /url:\s*["']([^"']+)["']/g;
  for (let match = urlRegex.exec(text); match; match = urlRegex.exec(text)) {
    const rawUrl = match[1].replace(/[?#].*$/, "");
    let path = "";
    for (const prefix of prefixes) {
      const idx = rawUrl.indexOf(prefix);
      if (idx >= 0) {
        path = safeDecodePath(rawUrl.slice(idx + prefix.length));
        break;
      }
    }
    if (!path || !AUDIO_PATH_REGEX.test(path) || !AUDIO_EXT_REGEX.test(path) || seenPaths.has(path)) {
      continue;
    }
    seenPaths.add(path);
    files.push({ path, size: 0 });
  }

  const coverRegex = /cover:\s*["']([^"']+)["']/g;
  for (let match = coverRegex.exec(text); match; match = coverRegex.exec(text)) {
    const rawUrl = match[1].replace(/[?#].*$/, "");
    for (const prefix of prefixes) {
      const idx = rawUrl.indexOf(prefix);
      if (idx >= 0) {
        const coverPath = safeDecodePath(rawUrl.slice(idx + prefix.length));
        const folderMatch = ALBUM_COVER_PATH_REGEX.exec(coverPath);
        if (folderMatch?.[1]) {
          coverFolders.add(folderMatch[1]);
        }
        break;
      }
    }
  }

  if (!files.length) {
    throw new Error("empty list-v2.js");
  }
  return { files, coverFolders: Array.from(coverFolders) };
}

export function buildCatalog(files: readonly CatalogFile[], coverFolders?: readonly string[]): Catalog {
  const coverSet = coverFolders && coverFolders.length > 0 ? new Set(coverFolders) : null;
  const tracks = new Map<string, CatalogTrackEntry>();
  const albums = new Map<string, CatalogAlbumEntry>();

  for (const { path, size } of files) {
    if (!AUDIO_PATH_REGEX.test(path)) {
      continue;
    }
    const ext = extractAudioExt(path);
    if (!ext) {
      continue;
    }
    const parts = path.split("/");
    const folder = parts[1];
    const fileName = parts[2];
    if (!folder || !fileName) {
      continue;
    }

    const coverPath = coverSet === null || coverSet.has(folder) ? `audio/${folder}/cover.png` : ARTIST_COVER_PATH;
    let albumEntry = albums.get(folder);
    if (!albumEntry) {
      albumEntry = {
        id: folder,
        name: folder,
        coverPath,
        ids: [],
      };
      albums.set(folder, albumEntry);
    }

    if (!tracks.has(path)) {
      tracks.set(path, {
        id: path,
        name: fileName.replace(AUDIO_EXT_REGEX, ""),
        ext,
        folder,
        size,
        coverPath: albumEntry.coverPath,
      });
      albumEntry.ids.push(path);
    }
  }

  for (const albumEntry of albums.values()) {
    albumEntry.ids.sort((a, b) => compareNatural(tracks.get(a)?.name || a, tracks.get(b)?.name || b));
  }

  const albumOrder = Array.from(albums.keys()).sort(compareNatural);
  const allTrackIds = albumOrder.flatMap((folder) => albums.get(folder)?.ids || []);

  return {
    tracks,
    albums,
    albumOrder,
    allTrackIds,
  };
}

async function fetchFromTree(): Promise<ParsedCatalogPayload> {
  const response = await Widget.http.request({
    url: GITHUB_TREE_URL,
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
    },
    timeout: 20,
  });
  return parseTreeResponse(response.data);
}

async function fetchFromList(mirror: CdnMirrorPreference): Promise<ParsedCatalogPayload> {
  const mirrorOrder: CdnMirrorPreference[] = [mirror, "testingcf", "jsdelivr", "raw"];
  const tried = new Set<string>();
  let lastError: unknown;

  for (const candidate of mirrorOrder) {
    const base = resolveCdnBase(candidate);
    if (tried.has(base)) {
      continue;
    }
    tried.add(base);
    try {
      const response = await Widget.http.request<string>({
        url: `${base}audio/list-v2.js`,
        method: "GET",
        decodable: false,
        timeout: 20,
      });
      return parseListV2Script(typeof response.data === "string" ? response.data : String(response.data ?? ""));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("failed to load list-v2.js");
}

function isCacheFresh(time: number, partial: boolean, now: number): boolean {
  const ttl = partial ? PARTIAL_TTL_MS : CATALOG_TTL_MS;
  return now - time < ttl;
}

export async function loadCatalog(config: RuntimeConfig, now = Date.now()): Promise<Catalog> {
  if (memoryCatalog && isCacheFresh(memoryCatalog.time, memoryCatalog.partial, now)) {
    return memoryCatalog.catalog;
  }

  const stored = getCachedCatalog();
  if (stored && isCacheFresh(stored.time, isPartialCatalog(stored.files), now)) {
    const built = buildCatalog(stored.files, stored.coverFolders);
    memoryCatalog = {
      time: stored.time,
      partial: isPartialCatalog(stored.files),
      catalog: built,
    };
    return built;
  }

  let fetched: ParsedCatalogPayload | null = null;
  for (const loader of [fetchFromTree, () => fetchFromList(config.cdnMirror)]) {
    try {
      fetched = await loader();
      break;
    } catch (error) {
      console.warn("catalog loader failed:", error instanceof Error ? error.message : String(error));
    }
  }

  if (!fetched) {
    if (memoryCatalog) {
      return memoryCatalog.catalog;
    }
    if (stored) {
      const built = buildCatalog(stored.files, stored.coverFolders);
      memoryCatalog = {
        time: stored.time,
        partial: isPartialCatalog(stored.files),
        catalog: built,
      };
      return built;
    }
    throw new Error(Widget.i18n("无法加载歌曲列表"));
  }

  const nextStored: StoredCatalog = {
    time: now,
    files: fetched.files,
    coverFolders: fetched.coverFolders,
  };
  setCachedCatalog(nextStored);

  const built = buildCatalog(fetched.files, fetched.coverFolders);
  memoryCatalog = {
    time: now,
    partial: isPartialCatalog(fetched.files),
    catalog: built,
  };
  return built;
}
