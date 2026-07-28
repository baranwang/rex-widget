import { describe, expect, test } from "@rstest/core";
import { initializeFetchAdapter } from "../libs/fetch";
import {
  buildQihooSearchAttempts,
  matchesQihooSeason,
  parseQihooMgtvUrl,
  parseQihooYoukuUrl,
  QihooMatcher,
  qihooSearchResponseSchema,
  qihooVarietyEpisodeResponseSchema,
  selectQihooPlaylinkUrl,
} from "./360kan";

const wrapRow = (row: unknown) => ({
  data: {
    longData: {
      rows: [row],
    },
  },
});

describe("360 variety playlinks", () => {
  test("keeps legacy string playlinks", () => {
    const result = qihooSearchResponseSchema.parse(
      wrapRow({
        cat_id: "2",
        id: "1",
        en_id: "legacy",
        cat_name: "电视剧",
        titleTxt: "示例剧",
        playlinks: {
          qq: "https://v.qq.com/x/cover/cid.html",
        },
      }),
    );

    expect(result[0]?.playlinks?.qq).toBe("https://v.qq.com/x/cover/cid.html");
  });

  test("parses exact Youku and MGTV playlink path and query identities", () => {
    expect(parseQihooYoukuUrl("https://v.youku.com/v_show/id_XNjA.html?s=show-42")).toEqual({
      showId: "show-42",
      vid: "XNjA",
    });
    expect(parseQihooMgtvUrl("https://www.mgtv.com/b/496452/18368257.html")).toEqual({
      dramaId: "496452",
      videoId: "18368257",
    });
  });

  test("does not treat an unverified scalar playlink as the requested episode", () => {
    const scalar = "https://v.qq.com/x/cover/default-show/default-video.html";
    const collection = "https://v.qq.com/x/cover/collection.html";

    expect(selectQihooPlaylinkUrl(scalar)).toBe(scalar);
    expect(selectQihooPlaylinkUrl(collection, 8, { episodeName: "第4期下" })).toBe(collection);
    expect(
      selectQihooPlaylinkUrl(scalar, 8, {
        episodeName: "第4期下",
      }),
    ).toBeUndefined();
  });

  test("accepts 360's empty-array shape for a search miss", () => {
    expect(
      qihooSearchResponseSchema.parse({
        data: {
          longData: [],
        },
      }),
    ).toEqual([]);
  });

  test("builds bounded year-aware fallbacks for a renamed variety season", () => {
    expect(buildQihooSearchAttempts("中国新说唱", 9, "2026-07-18", "第四期中")).toEqual([
      { keyword: "中国新说唱 9" },
      { keyword: "新说唱 2026", fallbackToken: "新说唱", year: "2026" },
      { keyword: "说唱 2026", fallbackToken: "说唱", year: "2026" },
    ]);
    expect(buildQihooSearchAttempts("普通电视剧", 9, "2026-07-18", "第十一集")).toEqual([{ keyword: "普通电视剧 9" }]);
    expect(buildQihooSearchAttempts("中国新说唱", 9)).toEqual([{ keyword: "中国新说唱 9" }]);
  });

  test("keeps variety episode-link arrays instead of dropping the whole result", () => {
    const result = qihooSearchResponseSchema.parse(
      wrapRow({
        cat_id: "3",
        id: "292778",
        en_id: "variety",
        cat_name: "综艺",
        titleTxt: "开始推理吧 第3季",
        playlinks: {
          qq: [
            {
              url: "https://v.qq.com/x/cover/mzc002008rxvoxh/o4101s5e63o.html",
              name: "第1期上：血染糖果厂",
              pubdate: "2025-05-01",
              period: "2025-05-01期",
            },
          ],
        },
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.playlinks?.qq).toEqual([
      {
        url: "https://v.qq.com/x/cover/mzc002008rxvoxh/o4101s5e63o.html",
        name: "第1期上：血染糖果厂",
        pubdate: "2025-05-01",
        period: "2025-05-01期",
      },
    ]);
  });

  test("selects the requested main issue instead of the first bonus link", () => {
    const links = [
      {
        url: "https://v.qq.com/bonus-5",
        name: "加更第5期：饭桌游戏",
        pubdate: "2025-05-01",
      },
      {
        url: "https://v.qq.com/main-1",
        name: "第1期上：血染糖果厂",
        pubdate: "2025-04-18",
      },
      {
        url: "https://v.qq.com/main-1-lower",
        name: "第1期下：推团继续调查",
        pubdate: "2025-04-18",
      },
    ];

    expect(selectQihooPlaylinkUrl(links, 1, { episodeName: "第1期下" })).toBe("https://v.qq.com/main-1-lower");
  });

  test("maps a sequential client episode to an explicit source issue and part", () => {
    const links = [
      {
        url: "https://v.qq.com/x/cover/cid/v410293xxkh.html",
        name: "第4期上：憋笑分贝挑战",
      },
      {
        url: "https://v.qq.com/x/cover/cid/n41020iq5oi.html",
        name: "第4期下：高空滑翔伞",
      },
    ];

    expect(selectQihooPlaylinkUrl(links, 8, { episodeName: "第四期下" })).toBe(
      "https://v.qq.com/x/cover/cid/n41020iq5oi.html",
    );
  });

  test("parses the complete variety episode response used after an index-summary miss", () => {
    const result = qihooVarietyEpisodeResponseSchema.parse({
      data: {
        total: 52,
        list: [
          {
            url: "https://v.qq.com/x/cover/mzc002005etgzma/n41020iq5oi.html",
            name: "第4期下：高空滑翔伞",
            pubdate: "2026-06-27",
          },
        ],
      },
    });

    expect(result.total).toBe(52);
    expect(result.list[0]?.url).toContain("n41020iq5oi");
  });

  test("does not fall back to a different explicit issue or edition", () => {
    const links = [
      {
        url: "https://www.iqiyi.com/v_first.html",
        name: "第1期：首期正片",
      },
    ];

    expect(selectQihooPlaylinkUrl(links, 999)).toBeUndefined();
    expect(selectQihooPlaylinkUrl(links, 1, { episodeName: "第1期加更" })).toBeUndefined();
    expect(
      selectQihooPlaylinkUrl(
        [
          {
            url: "https://www.iqiyi.com/v_preview.html",
            name: "第1期预告",
          },
        ],
        1,
        { episodeName: "第1期" },
      ),
    ).toBeUndefined();
    expect(
      selectQihooPlaylinkUrl(
        [
          {
            url: "https://www.iqiyi.com/v_unknown.html",
          },
        ],
        8,
        { episodeName: "第4期" },
      ),
    ).toBeUndefined();
    expect(
      selectQihooPlaylinkUrl(
        [
          {
            url: "https://www.iqiyi.com/v_unknown_client_episode.html",
          },
        ],
        8,
      ),
    ).toBeUndefined();
  });

  test("requires the exact air date when validating a renamed-show fallback", () => {
    const links = [
      {
        url: "https://www.iqiyi.com/v_target.html",
        name: "第4期中：Rapeter替爷爷写下跨时空情书",
        pubdate: "2026-07-18",
      },
    ];

    expect(
      selectQihooPlaylinkUrl(links, 11, {
        episodeName: "第4期中 Rapeter替爷爷写下跨时空情书",
        airDate: "2026-07-18",
        requireAirDate: true,
      }),
    ).toBe("https://www.iqiyi.com/v_target.html");
    expect(
      selectQihooPlaylinkUrl(links, 11, {
        episodeName: "第4期中 Rapeter替爷爷写下跨时空情书",
        airDate: "2026-07-19",
        requireAirDate: true,
      }),
    ).toBeUndefined();
  });

  test("uses air date when 360 titles have no source issue number", () => {
    const links = [
      {
        url: "https://www.youku.com/v_first.html",
        name: "本周正片",
        pubdate: "2026-07-11",
      },
      {
        url: "https://www.youku.com/v_target.html",
        name: "本周正片",
        pubdate: "2026-07-18",
      },
    ];

    expect(
      selectQihooPlaylinkUrl(links, 8, {
        airDate: "2026-07-18",
      }),
    ).toBe("https://www.youku.com/v_target.html");
  });

  test("requires evidence for season two and later", () => {
    expect(matchesQihooSeason("开始推理吧 第3季", 3)).toBe(true);
    expect(matchesQihooSeason("开始推理吧 第4季", 3)).toBe(false);
    expect(matchesQihooSeason("妻子的浪漫旅行2026", 6)).toBe(false);
    expect(matchesQihooSeason("首季标题可省略季号", 1)).toBe(true);
  });

  test("does not let an exact title bypass missing season evidence for season two and later", async () => {
    Widget.storage.clear();
    initializeFetchAdapter({
      async get<T>(url: string) {
        const parsedUrl = new URL(url);
        expect(parsedUrl.pathname).toBe("/index");
        return {
          data: {
            data: {
              longData: {
                rows: [
                  {
                    cat_id: "3",
                    id: "wrong-season",
                    en_id: "wrong-season",
                    cat_name: "综艺",
                    titleTxt: "地球超新鲜",
                    year: "2025",
                    playlinks: {
                      qq: [
                        {
                          url: "https://v.qq.com/x/cover/wrong/episode.html",
                          name: "第4期下",
                        },
                      ],
                    },
                  },
                ],
              },
            },
          } as T,
          statusCode: 200,
          headers: {},
        };
      },
      async post<_T>() {
        throw new Error("Unexpected POST request");
      },
    });

    try {
      await expect(
        new QihooMatcher().getEpisodeParams({
          seriesName: "地球超新鲜",
          type: "tv",
          season: 2,
          episode: 8,
          episodeName: "第四期下",
        }),
      ).resolves.toEqual([]);
    } finally {
      Widget.storage.clear();
      initializeFetchAdapter({
        get: Widget.http.get.bind(Widget.http),
        post: Widget.http.post.bind(Widget.http),
      });
    }
  });

  test("matches a compact current title to its provider season title and keeps the exact episode vid", async () => {
    Widget.storage.clear();
    initializeFetchAdapter({
      async get<T>(url: string) {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname !== "/index") {
          throw new Error(`Unexpected GET request: ${url}`);
        }
        return {
          data: {
            data: {
              longData: {
                rows: [
                  {
                    cat_id: "3",
                    id: "294419",
                    en_id: "half-mature-lovers-5",
                    cat_name: "综艺",
                    titleTxt: "半熟恋人 第5季",
                    year: "2026",
                    playlinks_total: {
                      qq: 104,
                    },
                    playlinks: {
                      qq: [
                        {
                          url: "https://v.qq.com/x/cover/mzc00200x8zylq0/g4102s4xcx5.html?traceid=12_360&no_refer=1",
                          name: "第8期下：爆灯抉择！牵着小手看人生档案",
                          pubdate: "2026-06-01",
                        },
                      ],
                    },
                  },
                ],
              },
            },
          } as T,
          statusCode: 200,
          headers: {},
        };
      },
      async post<_T>() {
        throw new Error("Unexpected POST request");
      },
    });

    try {
      await expect(
        new QihooMatcher().getEpisodeParams({
          seriesName: "半熟恋人5",
          type: "tv",
          season: 1,
          episode: 8,
          episodeName: "第8期下",
        }),
      ).resolves.toEqual([
        {
          provider: "tencent",
          idString: "cid=mzc00200x8zylq0&vid=g4102s4xcx5",
          episodeNumber: 8,
          episodeName: "第8期下",
          airDate: undefined,
        },
      ]);
    } finally {
      Widget.storage.clear();
      initializeFetchAdapter({
        get: Widget.http.get.bind(Widget.http),
        post: Widget.http.post.bind(Widget.http),
      });
    }
  });

  test("finds an exact iQiyi episode through renamed-title fallback and full variety pagination", async () => {
    const requests: string[] = [];
    Widget.storage.clear();
    initializeFetchAdapter({
      async get<T>(url: string) {
        requests.push(url);
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname === "/index") {
          const keyword = parsedUrl.searchParams.get("kw");
          if (keyword !== "说唱 2026") {
            return {
              data: {
                data: {
                  longData: [],
                },
              } as T,
              statusCode: 200,
              headers: {},
            };
          }
          return {
            data: {
              data: {
                longData: {
                  rows: [
                    {
                      cat_id: "3",
                      id: "294715",
                      en_id: "renamed-variety",
                      cat_name: "综艺",
                      titleTxt: "说唱巅峰对决2026",
                      year: "2026",
                      playlinks_total: {
                        qiyi: 27,
                      },
                      playlinks: {
                        qiyi: [
                          {
                            url: "https://www.iqiyi.com/v_newer.html",
                            name: "第5期上：摘要中的新一期",
                            pubdate: "2026-07-25",
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            } as T,
            statusCode: 200,
            headers: {},
          };
        }
        if (parsedUrl.pathname === "/episodeszongyi") {
          expect(parsedUrl.searchParams.get("site")).toBe("qiyi");
          return {
            data: {
              data: {
                total: 27,
                list: [
                  {
                    url: "https://www.iqiyi.com/v_2e3b6nv7asw.html",
                    name: "第4期中：Rapeter替爷爷写下跨时空情书 早安击碎所有不被看好",
                    pubdate: "2026-07-18",
                  },
                ],
              },
            } as T,
            statusCode: 200,
            headers: {},
          };
        }
        throw new Error(`Unexpected GET request: ${url}`);
      },
      async post<_T>() {
        throw new Error("Unexpected POST request");
      },
    });

    try {
      await expect(
        new QihooMatcher().getEpisodeParams({
          seriesName: "中国新说唱",
          type: "tv",
          season: 9,
          episode: 11,
          episodeName: "第4期中 Rapeter替爷爷写下跨时空情书",
          airDate: "2026-07-18",
        }),
      ).resolves.toEqual([
        {
          provider: "iqiyi",
          idString: "entityId=8837160335043100&episodeId=8837160335043100",
          episodeNumber: 11,
          episodeName: "第4期中 Rapeter替爷爷写下跨时空情书",
          airDate: "2026-07-18",
        },
      ]);
      expect(requests.filter((url) => url.includes("/index?"))).toHaveLength(3);
      expect(requests.filter((url) => url.includes("/episodeszongyi?"))).toHaveLength(1);
    } finally {
      Widget.storage.clear();
      initializeFetchAdapter({
        get: Widget.http.get.bind(Widget.http),
        post: Widget.http.post.bind(Widget.http),
      });
    }
  });

  test("ignores a scalar summary and continues pagination when only the episode response reports the total", async () => {
    const offsets: number[] = [];
    Widget.storage.clear();
    initializeFetchAdapter({
      async get<T>(url: string) {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname === "/index") {
          return {
            data: {
              data: {
                longData: {
                  rows: [
                    {
                      cat_id: "3",
                      id: "pagination-variety",
                      en_id: "pagination-variety",
                      cat_name: "综艺",
                      titleTxt: "分页综艺",
                      year: "2026",
                      playlinks: {
                        qq: "https://v.qq.com/x/cover/default-show/default-video.html",
                      },
                    },
                  ],
                },
              },
            } as T,
            statusCode: 200,
            headers: {},
          };
        }
        if (parsedUrl.pathname === "/episodeszongyi") {
          const offset = Number(parsedUrl.searchParams.get("offset"));
          offsets.push(offset);
          return {
            data: {
              data: {
                total: 40,
                list:
                  offset === 20
                    ? [
                        {
                          url: "https://v.qq.com/x/cover/show/target.html",
                          name: "第4期下",
                        },
                      ]
                    : [
                        {
                          url: "https://v.qq.com/x/cover/show/newer.html",
                          name: "第5期",
                        },
                      ],
              },
            } as T,
            statusCode: 200,
            headers: {},
          };
        }
        throw new Error(`Unexpected GET request: ${url}`);
      },
      async post<_T>() {
        throw new Error("Unexpected POST request");
      },
    });

    try {
      await expect(
        new QihooMatcher().getEpisodeParams({
          seriesName: "分页综艺",
          type: "tv",
          season: 1,
          episode: 8,
          episodeName: "第4期下",
        }),
      ).resolves.toEqual([
        {
          provider: "tencent",
          idString: "cid=show&vid=target",
          episodeNumber: 8,
          episodeName: "第4期下",
          airDate: undefined,
        },
      ]);
      expect(offsets).toEqual([0, 20]);
    } finally {
      Widget.storage.clear();
      initializeFetchAdapter({
        get: Widget.http.get.bind(Widget.http),
        post: Widget.http.post.bind(Widget.http),
      });
    }
  });
});
