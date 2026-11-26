import { describe, expect, test } from "@rstest/core";
import { Utf8TextDecoder, Utf8TextEncoder } from "./text-encoding";

const samples = ["", "abc", "咒术回战 第2季", "é ß ü", "🎬🍿 emoji", "\u{10ffff}", "﻿BOM 开头"];

describe("Utf8 text encoding polyfill", () => {
  test.each(samples)("与 Node 内置实现一致：%j", (text) => {
    const bytes = new Utf8TextEncoder().encode(text);
    expect(bytes).toEqual(new TextEncoder().encode(text));
    const ignoreBom = { ignoreBOM: true };
    expect(new Utf8TextDecoder("utf-8", ignoreBom).decode(bytes)).toBe(
      new TextDecoder("utf-8", ignoreBom).decode(bytes),
    );
    expect(new Utf8TextDecoder().decode(bytes)).toBe(new TextDecoder().decode(bytes));
  });

  test("落单的代理项编码为 U+FFFD", () => {
    expect(new Utf8TextEncoder().encode("a\ud800b")).toEqual(new TextEncoder().encode("a\ud800b"));
  });

  test.each([[[0xff]], [[0xc0, 0x80]], [[0xe4, 0xb8]], [[0xed, 0xa0, 0x80]]])(
    "非法 UTF-8 %j：fatal 抛错，否则替换为 U+FFFD",
    (raw) => {
      const bytes = new Uint8Array(raw);
      expect(() => new Utf8TextDecoder("utf-8", { fatal: true }).decode(bytes)).toThrow(TypeError);
      expect(new Utf8TextDecoder().decode(bytes)).toContain("�");
    },
  );

  test("encodeInto 写入目标数组", () => {
    const dest = new Uint8Array(8);
    expect(new Utf8TextEncoder().encodeInto("中a", dest)).toEqual({ read: 2, written: 4 });
    expect([...dest.subarray(0, 4)]).toEqual([0xe4, 0xb8, 0xad, 0x61]);
  });
});
