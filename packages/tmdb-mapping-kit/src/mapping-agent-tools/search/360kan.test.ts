import { parseProviderUrl } from "@rexnow/scraper-kit";
import { expect, rs, test } from "@rstest/core";
import { matchesQihooSeason, platformsFrom360Rows } from "./360kan.ts";

rs.mock("@rexnow/scraper-kit", { spy: true });

test("keeps series-level playlinks and strips episode coordinates", async () => {
  const platforms = await platformsFrom360Rows(
    [
      {
        cat_id: "2",
        titleTxt: "将夜",
        playlinks: {
          qq: "https://v.qq.com/x/cover/cid123/vid999.html",
          youku: "https://v.youku.com/v_show/id_X.html?showid=show42",
          imgo: "https://www.mgtv.com/h/860862.html",
          bilibili1: "https://www.bilibili.com/bangumi/play/ss45962",
        },
      },
    ],
    { query: "将夜", type: "tv" },
  );
  expect(platforms).toEqual(
    expect.arrayContaining([
      { provider: "tencent", idString: "cid=cid123", source: "360kan", title: "将夜" },
      { provider: "youku", idString: "showId=show42", source: "360kan", title: "将夜" },
      { provider: "mgtv", idString: "dramaId=860862", source: "360kan", title: "将夜" },
      { provider: "bilibili", idString: "seasonId=45962", source: "360kan", title: "将夜" },
    ]),
  );
  expect(platforms.some((item) => item.idString.includes("vid="))).toBe(false);
});

test("qiyi playlink keeps entityId only via parseProviderUrl", async () => {
  const platforms = await platformsFrom360Rows(
    [
      {
        cat_id: "2",
        titleTxt: "将夜",
        playlinks: {
          qiyi: "https://www.iqiyi.com/?entityId=entity42",
        },
      },
    ],
    { query: "将夜", type: "tv" },
  );
  expect(platforms).toEqual([{ provider: "iqiyi", idString: "entityId=entity42", source: "360kan", title: "将夜" }]);
  expect(platforms.some((item) => item.idString.includes("episodeId="))).toBe(false);
});

test("keeps other playlinks when a qiyi parseProviderUrl throws", async () => {
  rs.mocked(parseProviderUrl).mockRejectedValueOnce(new Error("qiyi parse failed"));
  try {
    const platforms = await platformsFrom360Rows(
      [
        {
          cat_id: "2",
          titleTxt: "将夜",
          playlinks: {
            qiyi: "https://www.iqiyi.com/iqiyi-throw",
            qq: "https://v.qq.com/x/cover/cid123.html",
            youku: "https://v.youku.com/v_show/id_X.html?showid=show42",
          },
        },
      ],
      { query: "将夜", type: "tv" },
    );
    expect(platforms).toEqual(
      expect.arrayContaining([
        { provider: "tencent", idString: "cid=cid123", source: "360kan", title: "将夜" },
        { provider: "youku", idString: "showId=show42", source: "360kan", title: "将夜" },
      ]),
    );
    expect(platforms.some((item) => item.provider === "iqiyi")).toBe(false);
  } finally {
    rs.mocked(parseProviderUrl).mockRestore();
  }
});

test("season 0 does not accept later-season 360 titles", async () => {
  expect(matchesQihooSeason("将夜第2季", 0)).toBe(false);
  expect(matchesQihooSeason("将夜", 0)).toBe(true);

  const platforms = await platformsFrom360Rows(
    [
      {
        cat_id: "2",
        titleTxt: "将夜",
        playlinks: { qq: "https://v.qq.com/x/cover/cidS0.html" },
      },
      {
        cat_id: "2",
        titleTxt: "将夜第2季",
        playlinks: { qq: "https://v.qq.com/x/cover/cidS2.html" },
      },
    ],
    { query: "将夜", type: "tv", season: 0 },
  );
  expect(platforms).toEqual([{ provider: "tencent", idString: "cid=cidS0", source: "360kan", title: "将夜" }]);
});
