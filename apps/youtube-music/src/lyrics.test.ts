import { beforeEach, describe, expect, test } from "@rstest/core";
import {
  cleanTrackTitleForSearch,
  detectLyricsLanguage,
  extractYouTubeLyricsFromBrowse,
  formatLrcTimestamp,
  handleSubtitle,
  toLyricsDataUrl,
} from "./lyrics";
import { cacheSongMetaList } from "./storage";

type MockRequestOptions = Parameters<typeof Widget.http.request>[0];
type MockRequestHandler = (options: MockRequestOptions) => unknown | Promise<unknown>;

function decodeDataUrl(url: string): string {
  const prefix = "data:text/plain;charset=utf-8;base64,";
  expect(url.startsWith(prefix)).toBe(true);
  return Buffer.from(url.slice(prefix.length), "base64").toString("utf8");
}

function setupWidgetEnv(handler?: MockRequestHandler): void {
  const store = new Map<string, unknown>();
  const globalObj = globalThis as unknown as Record<string, unknown>;
  globalObj.Widget = {
    i18n: (text: string) => text,
    storage: {
      get: <T>(key: string): T | null => (store.has(key) ? (store.get(key) as T) : null),
      set: (key: string, value: unknown) => {
        store.set(key, value);
      },
      remove: (key: string) => {
        store.delete(key);
      },
      keys: () => Array.from(store.keys()),
      clear: () => {
        store.clear();
      },
    },
    http: {
      request: async (options: MockRequestOptions) => {
        if (!handler) {
          throw new Error(`Unexpected request: ${options.url}`);
        }
        const data = await handler(options);
        return { data, statusCode: 200, headers: {} };
      },
    },
  };
}

describe("lyrics formatting and extraction", () => {
  test("formats LRC timestamps cleanly including centisecond carry", () => {
    expect(formatLrcTimestamp(0)).toBe("[00:00.00]");
    expect(formatLrcTimestamp(-500)).toBe("[00:00.00]");
    expect(formatLrcTimestamp(26020)).toBe("[00:26.02]");
    expect(formatLrcTimestamp(62999)).toBe("[01:03.00]");
  });

  test("extracts timed LRC when cueRange exists, and plain untimed lyrics when cueRange is omitted", () => {
    const timed = extractYouTubeLyricsFromBrowse({
      contents: {
        timedLyricsRenderer: {
          timedLyricsData: [
            { lyricLine: "Second line", cueRange: { startTimeMilliseconds: "12340" } },
            { lyricLine: "First line", cueRange: { startTimeMilliseconds: "1500" } },
          ],
        },
      },
    });
    expect(timed).toEqual({
      syncedLrc: "[00:01.50]First line\n[00:12.34]Second line",
    });

    const untimed = extractYouTubeLyricsFromBrowse({
      contents: {
        timedLyricsRenderer: {
          timedLyricsData: [{ lyricLine: "無敵の笑顔で荒らすメディア" }, { lyricLine: "知りたいその秘密ミステリアス" }],
        },
      },
    });
    expect(untimed).toEqual({
      plainText: "無敵の笑顔で荒らすメディア\n知りたいその秘密ミステリアス",
    });

    const webShelf = extractYouTubeLyricsFromBrowse({
      contents: {
        musicDescriptionShelfRenderer: {
          description: { runs: [{ text: "Line A\nLine B" }] },
        },
      },
    });
    expect(webShelf).toEqual({ plainText: "Line A\nLine B" });
  });

  test("cleans noisy YouTube title suffixes and detects language", () => {
    expect(cleanTrackTitleForSearch("Idol (Official Music Video) (feat. Guest)")).toBe("Idol");
    expect(detectLyricsLanguage("無敵の笑顔で荒らすメディア")).toBe("ja");
    expect(detectLyricsLanguage("故事的小黃花")).toBe("zh");
    expect(detectLyricsLanguage("We both know how the story ends")).toBe("en");
    expect(decodeDataUrl(toLyricsDataUrl("你好 🎵"))).toBe("你好 🎵");
  });
});

describe("handleSubtitle (Rex loadSubtitle entrypoint)", () => {
  beforeEach(() => {
    setupWidgetEnv();
  });

  test("ignores movies and TV shows so music lyrics never pollute video playback", async () => {
    let calls = 0;
    setupWidgetEnv(() => {
      calls++;
      return {};
    });

    expect(await handleSubtitle({ id: "12345", type: "movie", title: "Inception", tmdbId: "27205" })).toEqual([]);
    expect(await handleSubtitle({ id: "12345", type: "tv", seriesName: "Breaking Bad" })).toEqual([]);
    expect(await handleSubtitle({ id: "local", type: "other", title: "Home.Video.2026.mkv" })).toEqual([]);
    expect(calls).toBe(0);
  });

  test("returns LRCLIB synced LRC first plus YouTube Music untimed lyrics, and caches results", async () => {
    let calls = 0;
    setupWidgetEnv((options) => {
      calls++;
      if (options.url.includes("/youtubei/v1/next")) {
        return {
          contents: {
            tabs: [{ tabRenderer: { endpoint: { browseEndpoint: { browseId: "MPLYt_idol" } } } }],
            playlistPanelVideoRenderer: {
              videoId: "ZRtdQ81jPUQ",
              title: { runs: [{ text: "アイドル" }] },
              longBylineText: { runs: [{ text: "YOASOBI" }] },
              lengthText: { runs: [{ text: "3:46" }] },
            },
          },
        };
      }
      if (options.url.includes("/youtubei/v1/browse")) {
        return {
          timedLyricsData: [{ lyricLine: "無敵の笑顔で荒らすメディア" }, { lyricLine: "知りたいその秘密ミステリアス" }],
        };
      }
      if (options.url.startsWith("https://lrclib.net/api/get?")) {
        return {
          id: 7159727,
          trackName: "アイドル",
          artistName: "YOASOBI",
          duration: 226,
          instrumental: false,
          syncedLyrics: "[00:00.87] 無敵の笑顔で荒らすメディア\n[00:03.78] 知りたいその秘密ミステリアス",
          plainLyrics: "無敵の笑顔で荒らすメディア\n知りたいその秘密ミステリアス",
        };
      }
      throw new Error(`Unexpected URL: ${options.url}`);
    });

    cacheSongMetaList([
      {
        id: "ZRtdQ81jPUQ",
        type: "url",
        mediaType: "song",
        link: "ytm:song:ZRtdQ81jPUQ",
        title: "アイドル",
        subtitle: "YOASOBI",
        duration: 226,
      },
    ]);

    const subtitles = await handleSubtitle({
      id: "ZRtdQ81jPUQ",
      type: "other",
      link: "ytm:song:ZRtdQ81jPUQ",
      title: "アイドル",
    });

    expect(subtitles).toHaveLength(2);
    expect(subtitles[0]?.title).toBe("LRCLIB（同步歌词）");
    expect(subtitles[0]?.lang).toBe("ja");
    expect(decodeDataUrl(subtitles[0]?.url || "")).toContain("[00:00.87] 無敵の笑顔で荒らすメディア");
    expect(subtitles[1]?.title).toBe("YouTube Music（纯文本歌词）");
    expect(decodeDataUrl(subtitles[1]?.url || "")).toBe("無敵の笑顔で荒らすメディア\n知りたいその秘密ミステリアス");

    // Second invocation hits 24h lyrics cache with zero network requests
    const callsAfterFirst = calls;
    const cached = await handleSubtitle({ id: "ZRtdQ81jPUQ", type: "other", link: "ytm:song:ZRtdQ81jPUQ" });
    expect(cached).toEqual(subtitles);
    expect(calls).toBe(callsAfterFirst);
  });

  test("returns untimed YouTube Music lyrics as primary result when no synced lyrics exist anywhere", async () => {
    setupWidgetEnv((options) => {
      if (options.url.includes("/youtubei/v1/next")) {
        return {
          tabs: [{ tabRenderer: { endpoint: { browseEndpoint: { browseId: "MPLYt_niche" } } } }],
          playlistPanelVideoRenderer: {
            videoId: "AbCdEfGhIjK",
            title: { runs: [{ text: "Niche Indie Track" }] },
            longBylineText: { runs: [{ text: "Indie Band" }] },
            lengthText: { runs: [{ text: "3:10" }] },
          },
        };
      }
      if (options.url.includes("/youtubei/v1/browse")) {
        return {
          timedLyricsData: [{ lyricLine: "Untimed verse one" }, { lyricLine: "Untimed verse two" }],
        };
      }
      if (options.url.startsWith("https://lrclib.net/api/")) {
        throw new Error("HTTP 404: not found");
      }
      throw new Error(`Unexpected URL: ${options.url}`);
    });

    const subtitles = await handleSubtitle({
      id: "AbCdEfGhIjK",
      type: "other",
      link: "ytm:song:AbCdEfGhIjK",
    });

    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]?.title).toBe("YouTube Music（纯文本歌词）");
    expect(subtitles[0]?.lang).toBe("en");
    expect(decodeDataUrl(subtitles[0]?.url || "")).toBe("Untimed verse one\nUntimed verse two");
  });

  test("prefers YouTube Music native synced lyrics when cueRange is provided", async () => {
    setupWidgetEnv((options) => {
      if (options.url.includes("/youtubei/v1/next")) {
        return {
          tabs: [{ tabRenderer: { endpoint: { browseEndpoint: { browseId: "MPLYt_sync" } } } }],
          playlistPanelVideoRenderer: {
            videoId: "SyNcEd12345",
            title: { runs: [{ text: "Synced Song" }] },
            longBylineText: { runs: [{ text: "Singer" }] },
            lengthText: { runs: [{ text: "2:30" }] },
          },
        };
      }
      if (options.url.includes("/youtubei/v1/browse")) {
        return {
          timedLyricsData: [
            { lyricLine: "Hello world", cueRange: { startTimeMilliseconds: "5250" } },
            { lyricLine: "Second line", cueRange: { startTimeMilliseconds: "10500" } },
          ],
        };
      }
      throw new Error(`Unexpected URL: ${options.url}`);
    });

    const subtitles = await handleSubtitle({ id: "SyNcEd12345", type: "other", link: "ytm:song:SyNcEd12345" });
    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]?.title).toBe("YouTube Music（同步歌词）");
    expect(decodeDataUrl(subtitles[0]?.url || "")).toBe("[00:05.25]Hello world\n[00:10.50]Second line");
  });
});
