import { expect, test } from "@rstest/core";
import { Scraper } from ".";
import type { ProviderCommentItem } from "./base";

// Exercise the public request path while restoring every provider method, including on failure.
async function withComments(comments: ProviderCommentItem[], run: (scraper: Scraper) => Promise<void>) {
  const scraper = new Scraper();
  const restorations: Array<() => void> = [];
  for (const provider of ["tencent", "bilibili"]) {
    const source = scraper.scraperMap[provider];
    const originalGetSegments = source.getSegments;
    const originalGetComments = source.getComments;
    source.getSegments = async () => [{ provider, segmentId: "s1", startTime: 0 }];
    source.getComments = async () => comments;
    restorations.push(() => {
      source.getSegments = originalGetSegments;
      source.getComments = originalGetComments;
    });
  }
  try {
    await run(scraper);
  } finally {
    restorations.forEach((restore) => {
      restore();
    });
  }
}

const colors = [16711680, 139, 16776960, 0, 16777215];
const comments: ProviderCommentItem[] = colors.map((color, index) => ({
  id: String(index),
  timestamp: index + 1,
  mode: 1,
  color,
  content: `颜色 ${index}`,
}));

test("preserveDanmakuColor keeps original colors by default and when enabled", async () => {
  await withComments(comments, async (scraper) => {
    for (const params of [{}, { "global.content.preserveDanmakuColor": "true" }]) {
      scraper.setGlobalParams(params as BaranwangDanmuUniversal.GlobalParams);
      const result = await scraper.getDanmuWithSegmentTimeByVideoId("tencent:test", 0);
      expect(result.map((item) => Number(item.p.split(",")[2]))).toEqual(colors);
    }
  });
});

test("preserveDanmakuColor returns white across providers and modes", async () => {
  const modes = [1, 4, 5] as const;
  await withComments(
    comments.map((item, index) => ({ ...item, mode: modes[index % modes.length] })),
    async (scraper) => {
      for (const provider of ["tencent", "bilibili"]) {
        scraper.setGlobalParams({
          "global.content.preserveDanmakuColor": "true",
        } as BaranwangDanmuUniversal.GlobalParams);
        const original = await scraper.getDanmuWithSegmentTimeByVideoId(`${provider}:test`, 0);
        scraper.setGlobalParams({
          "global.content.preserveDanmakuColor": "false",
        } as BaranwangDanmuUniversal.GlobalParams);
        const white = await scraper.getDanmuWithSegmentTimeByVideoId(`${provider}:test`, 0);
        expect(white).toEqual(
          original.map((item) => {
            const fields = item.p.split(",");
            fields[2] = "16777215";
            return { ...item, p: fields.join(",") };
          }),
        );
        expect(white.map((item) => item.p.split(",")[2])).toEqual(colors.map(() => "16777215"));
      }
    },
  );
});

test("preserveDanmakuColor restores colors without mutating source comments", async () => {
  const before = structuredClone(comments);
  await withComments(comments, async (scraper) => {
    for (const value of ["false", "true", "false", undefined]) {
      scraper.setGlobalParams(
        (value === undefined
          ? {}
          : {
              "global.content.preserveDanmakuColor": value,
            }) as BaranwangDanmuUniversal.GlobalParams,
      );
      const result = await scraper.getDanmuWithSegmentTimeByVideoId("tencent:test", 0);
      expect(result.map((item) => Number(item.p.split(",")[2]))).toEqual(
        value === "false" ? colors.map(() => 16777215) : colors,
      );
      expect(comments).toEqual(before);
    }
  });
});

test("preserveDanmakuColor preserves aggregation groups", async () => {
  const duplicates: ProviderCommentItem[] = [
    { id: "red-2", timestamp: 2, mode: 1, color: 16711680, content: "相同文本" },
    { id: "red-1", timestamp: 1, mode: 1, color: 16711680, content: "相同文本" },
    { id: "blue", timestamp: 3, mode: 1, color: 139, content: "相同文本" },
  ];
  await withComments(duplicates, async (scraper) => {
    for (const color of ["true", "false"]) {
      for (const aggregation of ["true", "false"]) {
        scraper.setGlobalParams({
          "global.content.preserveDanmakuColor": color,
          "global.content.aggregation": aggregation,
        } as BaranwangDanmuUniversal.GlobalParams);
        const result = await scraper.getDanmuWithSegmentTimeByVideoId("tencent:test", 0);
        expect(result.map((item) => item.m)).toEqual(
          aggregation === "true" ? ["相同文本 × 2", "相同文本"] : duplicates.map((item) => item.content),
        );
        expect(result.map((item) => item.p.split(",")[0])).toEqual(
          aggregation === "true" ? ["1.00", "3.00"] : ["2.00", "1.00", "3.00"],
        );
      }
    }
  });
});

test("preserveDanmakuColor keeps empty and partial-success behavior", async () => {
  await withComments(comments, async (scraper) => {
    scraper.setGlobalParams({ "global.content.preserveDanmakuColor": "false" } as BaranwangDanmuUniversal.GlobalParams);
    scraper.scraperMap.tencent.getSegments = async () => [];
    await expect(scraper.getDanmuWithSegmentTimeByVideoId("tencent:test", 0)).resolves.toEqual([]);
    scraper.scraperMap.tencent.getSegments = async () => [{ provider: "tencent", segmentId: "s1", startTime: 0 }];
    scraper.scraperMap.tencent.getComments = async () => {
      throw new Error("provider failed");
    };
    const result = await scraper.getDanmuWithSegmentTimeByVideoId("tencent:test,bilibili:test", 0);
    expect(result).toHaveLength(comments.length);
    expect(result.map((item) => item.p.split(",").slice(2))).toEqual(comments.map(() => ["16777215", "[bilibili]"]));
  });
});
