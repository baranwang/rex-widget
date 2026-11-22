import { describe, expect, test } from "@rstest/core";
import { buildLyricSubtitleItems, cleanLrcText, mergeBilingualLrc, parseLrcLines, toLrcDataUri } from "./lyrics";

function decodeDataUri(uri: string): string {
  const prefix = "data:text/plain;charset=utf-8;base64,";
  expect(uri.startsWith(prefix)).toBe(true);
  return Buffer.from(uri.slice(prefix.length), "base64").toString("utf8");
}

describe("lyrics", () => {
  test("cleanLrcText strips empty and pure-instrumental placeholders", () => {
    expect(cleanLrcText("")).toBe("");
    expect(cleanLrcText("  [00:00.00]纯音乐，请欣赏  ")).toBe("");
    expect(cleanLrcText("[00:01.00]第一句\r\n[00:05.00]第二句")).toBe("[00:01.00]第一句\n[00:05.00]第二句");
  });

  test("parseLrcLines handles multi-timestamps, metadata, and millisecond precision", () => {
    const parsed = parseLrcLines("[ti:Lemon]\n[00:10.5][01:02.345]夢ならばどれほどよかったでしょう\n[00:05.20]Intro");
    expect(parsed.metadata).toEqual(["[ti:Lemon]"]);
    expect(parsed.lines).toEqual([
      { timeMs: 5200, timestamp: "[00:05.20]", text: "Intro" },
      { timeMs: 10500, timestamp: "[00:10.50]", text: "夢ならばどれほどよかったでしょう" },
      { timeMs: 62345, timestamp: "[01:02.34]", text: "夢ならばどれほどよかったでしょう" },
    ]);
  });

  test("mergeBilingualLrc aligns original and translation within timestamp tolerance", () => {
    const orig = "[ti:Lemon]\n[00:01.00]夢ならばどれほどよかったでしょう\n[00:06.50]未だにあなたのことを夢にみる";
    const trans = "[00:01.12]如果这一切都是梦境该有多好\n[00:06.40]至今仍能在梦中与你相见";

    const merged = mergeBilingualLrc(orig, trans);
    expect(merged).toBe(
      [
        "[ti:Lemon]",
        "[00:01.00]夢ならばどれほどよかったでしょう",
        "[00:01.00]如果这一切都是梦境该有多好",
        "[00:06.50]未だにあなたのことを夢にみる",
        "[00:06.50]至今仍能在梦中与你相见",
      ].join("\n"),
    );
  });

  test("buildLyricSubtitleItems emits bilingual, original, translation, and romaji data URIs", () => {
    const items = buildLyricSubtitleItems("536622304", {
      lrc: { lyric: "[00:01.00]夢ならばどれほどよかったでしょう" },
      tlyric: { lyric: "[00:01.00]如果这一切都是梦境该有多好" },
      romalrc: { lyric: "[00:01.00]yume naraba dore hodo yokatta deshou" },
    });

    expect(items.map((item) => item.id)).toEqual([
      "ncm:lyric:536622304:bilingual",
      "ncm:lyric:536622304:orig",
      "ncm:lyric:536622304:tlyric",
      "ncm:lyric:536622304:romalrc",
    ]);
    expect(decodeDataUri(items[0].url)).toContain("如果这一切都是梦境该有多好");
    expect(decodeDataUri(toLrcDataUri("[00:00.00]你好🎵"))).toBe("[00:00.00]你好🎵");
  });
});
