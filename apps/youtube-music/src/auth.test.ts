import crypto from "node:crypto";
import { describe, expect, test } from "@rstest/core";
import {
  buildAuthHeaders,
  extractCookieValue,
  getQueryParam,
  isYouTubeHostname,
  parseHttpsUrlParts,
  setQueryParams,
  sha1,
} from "./auth";
import { parseDetailLink } from "./constants";

describe("sha1 and SAPISIDHASH auth", () => {
  test("matches Node crypto SHA-1 for ASCII, multi-block, CJK, and emoji inputs", () => {
    const samples = [
      "",
      "abc",
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "1700000000 secret-token https://music.youtube.com",
      "你好世界 🎵 YouTube Music",
    ];
    for (const input of samples) {
      const expected = crypto.createHash("sha1").update(input, "utf8").digest("hex");
      expect(sha1(input)).toBe(expected);
    }
  });

  test("extracts cookie values and signs SAPISIDHASH preferring __Secure-3PAPISID", () => {
    const cookie = "PREF=tz=Asia.Shanghai; SAPISID=old_token; __Secure-3PAPISID=new_token/abc";
    expect(extractCookieValue(cookie, "SAPISID")).toBe("old_token");
    expect(extractCookieValue(cookie, "__Secure-3PAPISID")).toBe("new_token/abc");
    expect(extractCookieValue(cookie, "MISSING")).toBe("");

    const headers = buildAuthHeaders(cookie, "https://music.youtube.com", 1700000000);
    const expectedHash = crypto
      .createHash("sha1")
      .update("1700000000 new_token/abc https://music.youtube.com", "utf8")
      .digest("hex");
    expect(headers).toEqual({
      cookie,
      authorization: `SAPISIDHASH 1700000000_${expectedHash}`,
      "x-goog-authuser": "0",
    });
  });

  test("falls back to SAPISID and handles empty or unsigned cookies", () => {
    expect(buildAuthHeaders("")).toEqual({});
    expect(buildAuthHeaders("PREF=hl=en")).toEqual({ cookie: "PREF=hl=en" });

    const headers = buildAuthHeaders("SAPISID=fallback_sid", "https://s.youtube.com", 1700000001);
    const expectedHash = crypto
      .createHash("sha1")
      .update("1700000001 fallback_sid https://s.youtube.com", "utf8")
      .digest("hex");
    expect(headers.authorization).toBe(`SAPISIDHASH 1700000001_${expectedHash}`);
  });
});

describe("URL and detail link helpers", () => {
  test("parses HTTPS origin/hostname and validates YouTube hostnames", () => {
    expect(parseHttpsUrlParts("https://s.youtube.com/api/stats/playback?foo=1")).toEqual({
      origin: "https://s.youtube.com",
      hostname: "s.youtube.com",
    });
    expect(parseHttpsUrlParts("http://s.youtube.com/api/stats")).toBeNull();
    expect(isYouTubeHostname("s.youtube.com")).toBe(true);
    expect(isYouTubeHostname("youtube.com")).toBe(true);
    expect(isYouTubeHostname("evil-youtube.com")).toBe(false);
  });

  test("reads and updates query parameters without URLSearchParams", () => {
    const url = "https://s.youtube.com/api/stats/playback?cl=123&ver=1#frag";
    expect(getQueryParam(url, "cl")).toBe("123");
    expect(getQueryParam(url, "ver")).toBe("1");
    expect(getQueryParam(url, "missing")).toBeNull();

    const updated = setQueryParams(url, { ver: "2", c: "WEB_REMIX" });
    expect(updated).toBe("https://s.youtube.com/api/stats/playback?cl=123&ver=2&c=WEB_REMIX#frag");
  });

  test("parses ytm detail links and standard YouTube Music web URLs", () => {
    expect(parseDetailLink("ytm:song:ZRtdQ81jPUQ")).toEqual({ kind: "song", id: "ZRtdQ81jPUQ" });
    expect(parseDetailLink("ytm:album:MPREb_123")).toEqual({ kind: "album", id: "MPREb_123" });
    expect(parseDetailLink("ytm:playlist:VLPL123")).toEqual({ kind: "playlist", id: "PL123" });
    expect(parseDetailLink("https://music.youtube.com/watch?v=ZRtdQ81jPUQ&si=abc")).toEqual({
      kind: "song",
      id: "ZRtdQ81jPUQ",
    });
    expect(parseDetailLink("https://music.youtube.com/playlist?list=PL4fGSI1pDJn4y")).toEqual({
      kind: "playlist",
      id: "PL4fGSI1pDJn4y",
    });
    expect(parseDetailLink("https://music.youtube.com/browse/MPREb_abc123")).toEqual({
      kind: "album",
      id: "MPREb_abc123",
    });
    expect(parseDetailLink("invalid:link")).toBeNull();
  });
});
