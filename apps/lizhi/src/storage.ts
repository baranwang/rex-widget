import { type CdnMirrorPreference, type PlayerTypePreference, RECENT_MAX } from "./constants";

const KEYS = {
  config: "lizhi:config",
  catalog: "lizhi:catalog",
  recent: "lizhi:recent",
  radioQueue: "lizhi:radioQueue",
} as const;

export interface RuntimeConfig {
  language: string;
  cdnMirror: CdnMirrorPreference;
  playerType: PlayerTypePreference;
}

export interface CatalogFile {
  path: string;
  size: number;
}

export interface StoredCatalog {
  time: number;
  files: CatalogFile[];
  coverFolders?: string[];
}

const DEFAULT_CONFIG: RuntimeConfig = {
  language: "zh-CN",
  cdnMirror: "testingcf",
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

export function normalizeCdnMirror(value?: string): CdnMirrorPreference {
  if (value === "testingcf" || value === "jsdelivr" || value === "fastly" || value === "raw") {
    return value;
  }
  return "testingcf";
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
    language: typeof stored.language === "string" && stored.language ? stored.language : DEFAULT_CONFIG.language,
    cdnMirror: normalizeCdnMirror(stored.cdnMirror),
    playerType: normalizePlayerType(stored.playerType),
  };
}

export function syncRuntimeConfig(params?: {
  language?: string;
  cdnMirror?: string;
  playerType?: string;
}): RuntimeConfig {
  const prev = getRuntimeConfig();
  if (!params) {
    return prev;
  }
  const next: RuntimeConfig = {
    language: typeof params.language === "string" && params.language.trim() ? params.language.trim() : prev.language,
    cdnMirror: params.cdnMirror !== undefined ? normalizeCdnMirror(params.cdnMirror) : prev.cdnMirror,
    playerType: params.playerType !== undefined ? normalizePlayerType(params.playerType) : prev.playerType,
  };
  writeStorage(KEYS.config, next);
  return next;
}

export function getCachedCatalog(): StoredCatalog | null {
  const cached = readStorage<StoredCatalog>(KEYS.catalog);
  if (!cached || typeof cached !== "object" || typeof cached.time !== "number" || !Array.isArray(cached.files)) {
    return null;
  }
  const files = cached.files.filter(
    (entry): entry is CatalogFile =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof entry.path === "string" &&
      typeof entry.size === "number" &&
      Number.isFinite(entry.size),
  );
  if (!files.length) {
    return null;
  }
  const coverFolders = Array.isArray(cached.coverFolders)
    ? cached.coverFolders.filter((item): item is string => typeof item === "string" && item.length > 0)
    : undefined;
  return {
    time: cached.time,
    files,
    ...(coverFolders ? { coverFolders } : {}),
  };
}

export function setCachedCatalog(catalog: StoredCatalog): void {
  writeStorage(KEYS.catalog, catalog);
}

export function getRecentTrackIds(): string[] {
  const stored = readStorage<unknown>(KEYS.recent);
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function recordRecentTrack(id: string): void {
  if (!id) {
    return;
  }
  const next = getRecentTrackIds().filter((item) => item !== id);
  next.unshift(id);
  writeStorage(KEYS.recent, next.slice(0, RECENT_MAX));
}

export function getRadioQueue(): string[] {
  const stored = readStorage<unknown>(KEYS.radioQueue);
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function setRadioQueue(ids: string[]): void {
  writeStorage(
    KEYS.radioQueue,
    ids.filter((id) => typeof id === "string" && id.length > 0),
  );
}
