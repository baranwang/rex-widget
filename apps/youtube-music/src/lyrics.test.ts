import { beforeEach, describe, expect, test } from "@rstest/core";
import {
  detectLyricsLanguage,
  extractYouTubeLyricsFromBrowse,
  formatLrcTimestamp,
  handleSubtitle,
  toLyricsDataUrl,
} from "./lyrics";

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

describe("YouTube Music lyrics formatting and extraction", () => {
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

  test("detects lyrics language and encodes UTF-8 data URIs", () => {
    expect(detectLyricsLanguage("無敵の笑顔で荒らすメディア")).toBe("ja");
    expect(detectLyricsLanguage("故事的小黃花")).toBe("zh");
    expect(detectLyricsLanguage("We both know how the story ends")).toBe("en");
    expect(decodeDataUrl(toLyricsDataUrl("你好 🎵"))).toBe("你好 🎵");
  });
});

describe("handleSubtitle (YouTube Music native lyrics only)", () => {
  beforeEach(() => {
    setupWidgetEnv();
  });

  test("ignores movies, TV shows, and non-YouTube items with zero network calls", async () => {
    let calls = 0;
    setupWidgetEnv(() => {
      calls++;
      return {};
    });

    expect(await handleSubtitle({ id: "12345", type: "movie", title: "Inception", tmdbId: "27205" })).toEqual([]);
    expect(await handleSubtitle({ id: "12345", type: "tv", seriesName: "Breaking Bad" })).toEqual([]);
    expect(await handleSubtitle({ id: "non-ytm", type: "other", title: "Some Other Track" })).toEqual([]);
    expect(calls).toBe(0);
  });

  test("returns synced LRC when YouTube Music provides cueRange timestamps and caches result", async () => {
    let calls = 0;
    setupWidgetEnv((options) => {
      calls++;
      if (options.url.includes("/youtubei/v1/next")) {
        return {
          tabs: [{ tabRenderer: { endpoint: { browseEndpoint: { browseId: "MPLYt_sync" } } } }],
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
    expect(subtitles[0]?.lang).toBe("en");
    expect(decodeDataUrl(subtitles[0]?.url || "")).toBe("[00:05.25]Hello world\n[00:10.50]Second line");

    const callsAfterFirst = calls;
    const cached = await handleSubtitle({ id: "SyNcEd12345", type: "other", link: "ytm:song:SyNcEd12345" });
    expect(cached).toEqual(subtitles);
    expect(calls).toBe(callsAfterFirst);
  });

  test("returns untimed YouTube Music lyrics from timedLyricsData without cueRange", async () => {
    setupWidgetEnv((options) => {
      if (options.url.includes("/youtubei/v1/next")) {
        return {
          tabs: [{ tabRenderer: { endpoint: { browseEndpoint: { browseId: "MPLYt_idol" } } } }],
        };
      }
      if (options.url.includes("/youtubei/v1/browse")) {
        return {
          timedLyricsData: [{ lyricLine: "無敵の笑顔で荒らすメディア" }, { lyricLine: "知りたいその秘密ミステリアス" }],
        };
      }
      throw new Error(`Unexpected URL: ${options.url}`);
    });

    const subtitles = await handleSubtitle({ id: "ZRtdQ81jPUQ", type: "other", link: "ytm:song:ZRtdQ81jPUQ" });
    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]?.title).toBe("YouTube Music（纯文本歌词）");
    expect(subtitles[0]?.lang).toBe("ja");
    expect(decodeDataUrl(subtitles[0]?.url || "")).toBe("無敵の笑顔で荒らすメディア\n知りたいその秘密ミステリアス");
  });

  test("falls back to WEB_REMIX musicDescriptionShelfRenderer when ANDROID_MUSIC returns no lyrics", async () => {
    let browseAttempts = 0;
    setupWidgetEnv((options) => {
      if (options.url.includes("/youtubei/v1/next")) {
        return {
          tabs: [{ tabRenderer: { endpoint: { browseEndpoint: { browseId: "MPLYt_MSsiopJvbjq-4" } } } }],
        };
      }
      if (options.url.includes("/youtubei/v1/browse")) {
        browseAttempts++;
        const payload = options.data as { context?: { client?: { clientName?: string } } };
        if (payload.context?.client?.clientName === "ANDROID_MUSIC") {
          return { contents: { elementRenderer: { model: { musicMessageModel: { text: "Lyrics not available" } } } } };
        }
        return {
          contents: {
            sectionListRenderer: {
              contents: [
                {
                  musicDescriptionShelfRenderer: {
                    description: { runs: [{ text: "第一句歌词\n第二句歌词" }] },
                  },
                },
              ],
            },
          },
        };
      }
      throw new Error(`Unexpected URL: ${options.url}`);
    });

    const subtitles = await handleSubtitle({
      id: "VklllEUq4ow",
      type: "other",
      link: "ytm:song:VklllEUq4ow",
      cookie: "HSID=h1; SAPISID=tok/1",
    });
    expect(browseAttempts).toBe(2);
    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]?.title).toBe("YouTube Music（纯文本歌词）");
    expect(subtitles[0]?.lang).toBe("zh");
    expect(decodeDataUrl(subtitles[0]?.url || "")).toBe("第一句歌词\n第二句歌词");
  });
});
