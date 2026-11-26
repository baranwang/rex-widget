import { afterEach, describe, expect, rs, test } from "@rstest/core";
import "./index";
import { DoubanMatcher } from "./matchers/douban";
import { scraper } from "./scrapers";

describe("searchDanmu episode filtering", () => {
  afterEach(() => {
    rs.restoreAllMocks();
  });

  test("keeps generic episode filtering for non-local search results", async () => {
    rs.spyOn(DoubanMatcher.prototype, "getEpisodeParams").mockResolvedValueOnce({
      doubanIds: [],
      videoPlatformInfo: [{ provider: "bilibili", idString: "seasonId=generic" }],
    });
    const getEpisodes = rs.spyOn(scraper, "getEpisodes").mockResolvedValueOnce([
      {
        provider: "bilibili",
        episodeId: "bilibili:episode-3",
        episodeTitle: "第 3 集",
        episodeNumber: 3,
      },
      {
        provider: "bilibili",
        episodeId: "bilibili:episode-4",
        episodeTitle: "第 4 集",
        episodeNumber: 4,
      },
    ]);

    const result = await searchDanmu({
      type: "tv",
      tmdbId: "123456",
      season: "1",
      episode: "3",
      fuzzyMatch: "never",
    } as SearchDanmuParams);

    expect(getEpisodes).toHaveBeenCalledWith({ provider: "bilibili", idString: "seasonId=generic", episodeNumber: 3 });
    expect(result?.animes).toEqual([{ animeId: "bilibili:episode-3", animeTitle: "[哔哩哔哩] 第 3 集" }]);
  });

  test("an ordinary Tencent TV match does not trigger fuzzy fallback", async () => {
    rs.spyOn(DoubanMatcher.prototype, "getEpisodeParams").mockResolvedValueOnce({
      doubanIds: ["ordinary-tv"],
      videoPlatformInfo: [
        {
          provider: "tencent",
          idString: "cid=ordinary-drama&vid=vendor-default",
        },
      ],
    });
    const searchEpisodes = rs.spyOn(scraper, "getEpisodeParams");
    const getEpisodes = rs.spyOn(scraper, "getEpisodes").mockResolvedValueOnce([
      {
        provider: "tencent",
        episodeId: "tencent:cid=ordinary-drama&vid=drama-12",
        episodeTitle: "第12集",
        episodeNumber: 12,
        episodePart: "whole",
        episodeEdition: "main",
      },
    ]);

    const result = await searchDanmu({
      title: "普通电视剧",
      seriesName: "普通电视剧",
      type: "tv",
      season: "1",
      episode: "12",
      episodeName: "第十二集",
      fuzzyMatch: "auto",
    } as SearchDanmuParams);

    expect(getEpisodes).toHaveBeenCalledOnce();
    expect(getEpisodes).toHaveBeenCalledWith({
      provider: "tencent",
      idString: "cid=ordinary-drama",
      episodeNumber: 12,
      episodeName: "第十二集",
    });
    expect(searchEpisodes).not.toHaveBeenCalled();
    expect(result?.animes).toEqual([
      {
        animeId: "tencent:cid=ordinary-drama&vid=drama-12",
        animeTitle: "[腾讯视频] 第12集",
      },
    ]);
  });

  test("a Tencent movie keeps its exact vendor vid and does not trigger fuzzy fallback", async () => {
    rs.spyOn(DoubanMatcher.prototype, "getEpisodeParams").mockResolvedValueOnce({
      doubanIds: ["ordinary-movie"],
      videoPlatformInfo: [
        {
          provider: "tencent",
          idString: "cid=movie-cid&vid=movie-vid",
        },
      ],
    });
    const searchEpisodes = rs.spyOn(scraper, "getEpisodeParams");
    const getEpisodes = rs.spyOn(scraper, "getEpisodes").mockResolvedValueOnce([
      {
        provider: "tencent",
        episodeId: "tencent:cid=movie-cid&vid=movie-vid",
        episodeTitle: "普通电影",
        episodeNumber: 1,
      },
    ]);

    const result = await searchDanmu({
      title: "普通电影",
      type: "movie",
      fuzzyMatch: "auto",
    } as SearchDanmuParams);

    expect(getEpisodes).toHaveBeenCalledWith({
      provider: "tencent",
      idString: "cid=movie-cid&vid=movie-vid",
    });
    expect(searchEpisodes).not.toHaveBeenCalled();
    expect(result?.animes).toEqual([
      {
        animeId: "tencent:cid=movie-cid&vid=movie-vid",
        animeTitle: "[腾讯视频] 普通电影",
      },
    ]);
  });

  test("falls back after a TV vendor collection cannot resolve the requested variety episode", async () => {
    rs.spyOn(DoubanMatcher.prototype, "getEpisodeParams").mockResolvedValueOnce({
      doubanIds: ["37815127"],
      videoPlatformInfo: [
        {
          provider: "tencent",
          idString: "cid=mzc00200x8zylq0&vid=c4102tnbp6u",
        },
      ],
    });
    const searchEpisodes = rs.spyOn(scraper, "getEpisodeParams").mockResolvedValueOnce([
      {
        provider: "tencent",
        idString: "cid=mzc00200x8zylq0&vid=g4102s4xcx5",
        episodeNumber: 8,
        episodeName: "第8期下",
      },
    ]);
    const getEpisodes = rs
      .spyOn(scraper, "getEpisodes")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          provider: "tencent",
          episodeId: "tencent:cid=mzc00200x8zylq0&vid=g4102s4xcx5",
          episodeTitle: "第8期下",
          episodeNumber: 8,
          episodePart: "lower",
          episodeEdition: "main",
        },
      ]);

    const result = await searchDanmu({
      title: "半熟恋人5",
      seriesName: "半熟恋人5",
      type: "tv",
      season: "1",
      episode: "8",
      episodeName: "第8期下",
      fuzzyMatch: "auto",
    } as SearchDanmuParams);

    expect(getEpisodes).toHaveBeenNthCalledWith(1, {
      provider: "tencent",
      idString: "cid=mzc00200x8zylq0",
      episodeNumber: 8,
      episodeName: "第8期下",
    });
    expect(searchEpisodes).toHaveBeenCalledOnce();
    expect(result?.animes).toEqual([
      {
        animeId: "tencent:cid=mzc00200x8zylq0&vid=g4102s4xcx5",
        animeTitle: "[腾讯视频] 第8期下",
      },
    ]);
  });
});
