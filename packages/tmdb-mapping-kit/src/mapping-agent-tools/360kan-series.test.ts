import { expect, rs, test } from "@rstest/core";
import { platformsFrom360Rows } from "./360kan-series.ts";

rs.mock("@rexnow/scraper-kit", async () => {
  const actual = await rs.importActual<typeof import("@rexnow/scraper-kit")>("@rexnow/scraper-kit");
  return {
    ...actual,
    parseProviderUrl: rs.fn(async (url: string) => {
      if (String(url).includes("iqiyi-throw")) {
        throw new Error("qiyi parse failed");
      }
      return actual.parseProviderUrl(url);
    }),
  };
});

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
});
