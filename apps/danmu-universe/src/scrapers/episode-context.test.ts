import { describe, expect, test } from "@rstest/core";
import { MediaType } from "../libs/constants";
import { initializeFetchAdapter } from "../libs/fetch";
import { Scraper } from ".";

describe("danmu detail episode context", () => {
  test("keeps the variety title and air date when resolving an exact anime id", async () => {
    const manager = new Scraper();
    const originalGetEpisodes = manager.scraperMap.tencent.getEpisodes;
    let received:
      | {
          idString: string;
          episodeNumber?: number;
          context?: { episodeName?: string; airDate?: string };
        }
      | undefined;

    manager.scraperMap.tencent.getEpisodes = async (idString, episodeNumber, context) => {
      received = { idString, episodeNumber, context };
      return [];
    };

    try {
      await manager.getDetailWithAnimeId("tencent:cid=mzc002005etgzma&vid=n41020iq5oi", MediaType.TV, "8", {
        episodeName: "第四期下",
        airDate: "2026-07-19",
      });
    } finally {
      manager.scraperMap.tencent.getEpisodes = originalGetEpisodes;
    }

    expect(received).toEqual({
      idString: "cid=mzc002005etgzma&vid=n41020iq5oi",
      episodeNumber: 8,
      context: {
        episodeName: "第四期下",
        airDate: "2026-07-19",
      },
    });
  });

  test("still runs 360 matching when provider-native searches return no dramas", async () => {
    const manager = new Scraper();
    const restorations: Array<() => void> = [];
    for (const provider of Object.values(manager.scraperMap)) {
      if (!provider.search) continue;
      const originalSearch = provider.search;
      provider.search = async () => [];
      restorations.push(() => {
        provider.search = originalSearch;
      });
    }

    initializeFetchAdapter({
      async get<T>(url: string) {
        if (!url.startsWith("https://api.so.360kan.com/index?")) {
          throw new Error(`Unexpected GET request: ${url}`);
        }
        return {
          data: {
            data: {
              longData: {
                rows: [
                  {
                    cat_id: "3",
                    id: "294717",
                    en_id: "ZcIqbHN382c3Ez",
                    cat_name: "综艺",
                    titleTxt: "地球超新鲜 第2季",
                    year: "2026",
                    playlinks: {
                      qq: [
                        {
                          url: "https://v.qq.com/x/cover/mzc002005etgzma/n41020iq5oi.html",
                          name: "第4期下：高空滑翔伞",
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
        manager.getEpisodeParams({
          seriesName: "地球超新鲜",
          type: "tv",
          season: 2,
          episode: 8,
          episodeName: "第四期下",
          qihooSearch: "true",
        }),
      ).resolves.toContainEqual({
        provider: "tencent",
        idString: "cid=mzc002005etgzma&vid=n41020iq5oi",
        episodeNumber: 8,
        episodeName: "第四期下",
        airDate: undefined,
      });
    } finally {
      restorations.forEach((restore) => {
        restore();
      });
      initializeFetchAdapter({
        get: Widget.http.get.bind(Widget.http),
        post: Widget.http.post.bind(Widget.http),
      });
    }
  });
});
