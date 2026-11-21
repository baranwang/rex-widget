import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core";
import {
  buildCatalog,
  compareNatural,
  formatFileSize,
  loadCatalog,
  parseListV2Script,
  parseTreeResponse,
  resetCatalogMemoryCache,
  seeded,
  shuffle,
  todayKey,
} from "./catalog";
import {
  CDN_LIMIT,
  encodePath,
  extractRepoAudioPath,
  parseDetailLink,
  resolveAssetUrl,
  resolvePlayerType,
  safeDecodePath,
} from "./constants";
import type { RuntimeConfig } from "./storage";

const DEFAULT_CONFIG: RuntimeConfig = {
  language: "zh-CN",
  cdnMirror: "testingcf",
  playerType: "auto",
};

describe("catalog utilities & URL helpers", () => {
  beforeEach(() => {
    Widget.storage.clear();
    resetCatalogMemoryCache();
  });

  afterEach(() => {
    rs.restoreAllMocks();
    Widget.storage.clear();
    resetCatalogMemoryCache();
  });

  test("compareNatural sorts numeric prefixes numerically like mygo-lizhi", () => {
    const albums = ["108个关键词", "1701", "8", "F", "io", "梵高先生", "零碎"];
    expect([...albums].sort(compareNatural)).toEqual(["8", "108个关键词", "1701", "F", "io", "梵高先生", "零碎"]);

    const tracks = ["10. 尾巴", "2. 开头", "02. 前奏", "1. 序曲"];
    expect([...tracks].sort(compareNatural)).toEqual(["1. 序曲", "2. 开头", "02. 前奏", "10. 尾巴"]);
  });

  test("seeded shuffle is deterministic for the same seed and differs across days", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `track-${i}`);
    const day1a = shuffle(ids, seeded(todayKey(new Date(2026, 10, 21))));
    const day1b = shuffle(ids, seeded(todayKey(new Date(2026, 10, 21))));
    const day2 = shuffle(ids, seeded(todayKey(new Date(2026, 10, 22))));

    expect(day1a).toEqual(day1b);
    expect(day1a).not.toEqual(day2);
    expect([...day1a].sort()).toEqual([...ids].sort());
  });

  test("encodePath and safeDecodePath round-trip special characters including &, +, and CJK", () => {
    const path = "audio/io/下雨&董卓瑶&忽然.MP3";
    const encoded = encodePath(path);
    expect(encoded).toBe("audio/io/%E4%B8%8B%E9%9B%A8%26%E8%91%A3%E5%8D%93%E7%91%B6%26%E5%BF%BD%E7%84%B6.MP3");
    expect(safeDecodePath(encoded)).toBe(path);
    expect(safeDecodePath("audio/108个关键词/%E0%A4%A.mp3")).toBe("audio/108个关键词/%E0%A4%A.mp3");
  });

  test("resolveAssetUrl switches files over 20 MiB to GitHub Raw and respects cdnMirror", () => {
    const smallPath = "audio/梵高先生/广场.mp3";
    const largePath = "audio/动静/地方.flac";

    expect(resolveAssetUrl(smallPath, "testingcf", 8_000_000)).toBe(
      `https://testingcf.jsdelivr.net/gh/nj-lizhi/song@main/${encodePath(smallPath)}`,
    );
    expect(resolveAssetUrl(smallPath, "jsdelivr", 8_000_000)).toBe(
      `https://cdn.jsdelivr.net/gh/nj-lizhi/song@main/${encodePath(smallPath)}`,
    );
    expect(resolveAssetUrl(smallPath, "fastly", 8_000_000)).toBe(
      `https://fastly.jsdelivr.net/gh/nj-lizhi/song@main/${encodePath(smallPath)}`,
    );
    expect(resolveAssetUrl(smallPath, "raw", 8_000_000)).toBe(
      `https://raw.githubusercontent.com/nj-lizhi/song/main/${encodePath(smallPath)}`,
    );
    expect(resolveAssetUrl(largePath, "testingcf", CDN_LIMIT + 1)).toBe(
      `https://raw.githubusercontent.com/nj-lizhi/song/main/${encodePath(largePath)}`,
    );
    expect(resolveAssetUrl(largePath, "testingcf", CDN_LIMIT)).toBe(
      `https://testingcf.jsdelivr.net/gh/nj-lizhi/song@main/${encodePath(largePath)}`,
    );
  });

  test("resolvePlayerType uses app decoder for FLAC in auto mode and honors explicit preference", () => {
    expect(resolvePlayerType("auto", "mp3")).toBeUndefined();
    expect(resolvePlayerType("auto", "wav")).toBeUndefined();
    expect(resolvePlayerType("auto", "flac")).toBe("app");
    expect(resolvePlayerType("auto", "FLAC")).toBe("app");
    expect(resolvePlayerType("system", "flac")).toBe("system");
    expect(resolvePlayerType("app", "mp3")).toBe("app");
  });

  test("parseDetailLink supports lizhi scheme and direct GitHub/jsDelivr URLs", () => {
    expect(parseDetailLink("lizhi:song:audio/梵高先生/广场.mp3")).toEqual({
      kind: "song",
      id: "audio/梵高先生/广场.mp3",
    });
    expect(parseDetailLink("lizhi:album:梵高先生")).toEqual({ kind: "album", id: "梵高先生" });
    expect(parseDetailLink("lizhi:playlist:today")).toEqual({ kind: "playlist", id: "today" });
    expect(
      parseDetailLink(
        "https://github.com/nj-lizhi/song/blob/main/audio/io/%E4%B8%8B%E9%9B%A8%26%E8%91%A3%E5%8D%93%E7%91%B6%26%E5%BF%BD%E7%84%B6.MP3",
      ),
    ).toEqual({
      kind: "song",
      id: "audio/io/下雨&董卓瑶&忽然.MP3",
    });
    expect(
      extractRepoAudioPath("https://testingcf.jsdelivr.net/gh/nj-lizhi/song@main/audio/1701/大象.mp3?foo=bar"),
    ).toBe("audio/1701/大象.mp3");
    expect(parseDetailLink("unknown:123")).toBeNull();
  });

  test("parseTreeResponse extracts audio files and album covers while ignoring non-audio blobs", () => {
    const parsed = parseTreeResponse({
      tree: [
        { type: "blob", path: "audio/cover.png", size: 44516 },
        { type: "blob", path: "audio/1701/cover.png", size: 160226 },
        { type: "blob", path: "audio/1701/大象.mp3", size: 13143218 },
        { type: "blob", path: "audio/io/下雨&董卓瑶&忽然.MP3", size: 29040239 },
        { type: "blob", path: "audio/动静/地方.flac", size: 40452968 },
        { type: "blob", path: "audio/被禁忌的游戏/青春.wav", size: 33967764 },
        { type: "blob", path: "audio/list-v2.js", size: 82097 },
        { type: "blob", path: "audio/deep/nested/skip.mp3", size: 1000 },
        { type: "tree", path: "audio/1701" },
      ],
    });

    expect(parsed.files).toHaveLength(4);
    expect(parsed.coverFolders).toEqual(["1701"]);

    const catalog = buildCatalog(parsed.files, parsed.coverFolders);
    expect(catalog.albums.get("1701")?.coverPath).toBe("audio/1701/cover.png");
    expect(catalog.albums.get("io")?.coverPath).toBe("audio/cover.png");
    expect(catalog.tracks.get("audio/io/下雨&董卓瑶&忽然.MP3")?.ext).toBe("mp3");
    expect(catalog.tracks.get("audio/动静/地方.flac")?.ext).toBe("flac");
    expect(catalog.tracks.get("audio/被禁忌的游戏/青春.wav")?.ext).toBe("wav");
  });

  test("parseListV2Script extracts audio paths and covers from nj-lizhi/song list-v2.js format", () => {
    const script = `var list = [
      {
        name: "倒影",
        artist: "专辑-108个关键词",
        url: "https://testingcf.jsdelivr.net/gh/nj-lizhi/song@main/audio/108个关键词/倒影.mp3",
        cover:
          "https://testingcf.jsdelivr.net/gh/nj-lizhi/song@main/audio/108个关键词/cover.png",
      },
      {
        name: "大象",
        artist: "专辑-1701",
        url:
          "https://cdn.jsdelivr.net/gh/nj-lizhi/song@main/audio/1701/%E5%A4%A7%E8%B1%A1.mp3",
        cover: "https://cdn.jsdelivr.net/gh/nj-lizhi/song@main/audio/1701/cover.png",
      },
    ];`;

    const parsed = parseListV2Script(script);
    expect(parsed.files).toEqual([
      { path: "audio/108个关键词/倒影.mp3", size: 0 },
      { path: "audio/1701/大象.mp3", size: 0 },
    ]);
    expect(parsed.coverFolders).toEqual(["108个关键词", "1701"]);
  });

  test("loadCatalog falls back from GitHub Tree API to list-v2.js and then to stale storage cache", async () => {
    const listScript = `var list = [{
      name: "广场",
      url: "https://testingcf.jsdelivr.net/gh/nj-lizhi/song@main/audio/梵高先生/广场.mp3",
      cover: "https://testingcf.jsdelivr.net/gh/nj-lizhi/song@main/audio/梵高先生/cover.png",
    }];`;

    let failAll = false;
    const spy = rs.spyOn(Widget.http, "request").mockImplementation(async (options) => {
      if (failAll) {
        throw new Error("HTTP 503: service unavailable");
      }
      if (options.url.includes("api.github.com")) {
        throw new Error("HTTP 403: forbidden");
      }
      if (options.url.endsWith("audio/list-v2.js")) {
        return { data: listScript, statusCode: 200, headers: {} };
      }
      throw new Error(`Unexpected url: ${options.url}`);
    });

    const t0 = 1_700_000_000_000;
    const catalog1 = await loadCatalog(DEFAULT_CONFIG, t0);
    expect(catalog1.allTrackIds).toEqual(["audio/梵高先生/广场.mp3"]);
    expect(spy).toHaveBeenCalledTimes(2);

    // Within PARTIAL_TTL (1h), served from memory cache without HTTP requests
    const catalog2 = await loadCatalog(DEFAULT_CONFIG, t0 + 30 * 60 * 1000);
    expect(catalog2.allTrackIds).toEqual(["audio/梵高先生/广场.mp3"]);
    expect(spy).toHaveBeenCalledTimes(2);

    // After PARTIAL_TTL (1h), tries network again; when all sources fail, falls back to stale cache
    resetCatalogMemoryCache();
    failAll = true;
    const catalog3 = await loadCatalog(DEFAULT_CONFIG, t0 + 2 * 60 * 60 * 1000);
    expect(catalog3.allTrackIds).toEqual(["audio/梵高先生/广场.mp3"]);
  });

  test("formatFileSize formats bytes cleanly", () => {
    expect(formatFileSize(0)).toBe("");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(204_800)).toBe("200 KB");
    expect(formatFileSize(12_866_362)).toBe("12.3 MB");
  });
});
