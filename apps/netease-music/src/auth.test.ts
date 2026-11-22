import { describe, expect, test } from "@rstest/core";
import { extractManagedSetCookies, parseCookieAuthInput, splitSetCookieHeader } from "./auth";

describe("auth", () => {
  test("accepts a bare MUSIC_U token value", () => {
    const token = "a1b2c3d4e5f60718293a4b5c6d7e8f9011223344";
    const parsed = parseCookieAuthInput(token);
    expect(parsed.hasMusicU).toBe(true);
    expect(parsed.cookies.MUSIC_U).toBe(token);
    expect(parsed.cookieHeader).toBe(`MUSIC_U=${token}`);
  });

  test("parses raw cookie pairs and Cookie header lines", () => {
    const parsed = parseCookieAuthInput("Cookie: MUSIC_U=token123; __csrf=csrf456; NMTID=nmt789");
    expect(parsed.hasMusicU).toBe(true);
    expect(parsed.cookies).toEqual({
      MUSIC_U: "token123",
      __csrf: "csrf456",
      NMTID: "nmt789",
    });
  });

  test("extracts cookies from bash Copy as cURL with -b and -H", () => {
    const curl = `curl 'https://music.163.com/weapi/v1/user/detail' \\
      -H 'user-agent: Mozilla/5.0' \\
      -b 'MUSIC_U=abc_xyz_999; __csrf=csrf_val'`;
    const parsed = parseCookieAuthInput(curl);
    expect(parsed.hasMusicU).toBe(true);
    expect(parsed.cookies.MUSIC_U).toBe("abc_xyz_999");
    expect(parsed.cookies.__csrf).toBe("csrf_val");
  });

  test("extracts cookies from Windows cmd Copy as cURL", () => {
    const cmdCurl = `curl ^"https://music.163.com/api/v1/user^" ^
      -H ^"cookie: MUSIC_U=win_token; NMTID=win_nmt^"`;
    const parsed = parseCookieAuthInput(cmdCurl);
    expect(parsed.hasMusicU).toBe(true);
    expect(parsed.cookies.MUSIC_U).toBe("win_token");
    expect(parsed.cookies.NMTID).toBe("win_nmt");
  });

  test("splitSetCookieHeader preserves commas inside Expires dates", () => {
    const combined =
      "NMTID=00Oabc123; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/; Domain=.163.com, __csrf=xyz999; Max-Age=1296000; Path=/";
    const parts = splitSetCookieHeader(combined);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("NMTID=00Oabc123");
    expect(parts[0]).toContain("Expires=Wed, 21 Oct 2030 07:28:00 GMT");
    expect(parts[1]).toContain("__csrf=xyz999");
  });

  test("extractManagedSetCookies tracks updates and expired deletions", () => {
    const now = Date.parse("2026-11-21T00:00:00Z");
    const result = extractManagedSetCookies(
      {
        "Set-Cookie":
          "NMTID=fresh_nmt; Expires=Thu, 21 Nov 2030 00:00:00 GMT; Path=/, MUSIC_U=; Max-Age=0; Path=/, ignored=123; Path=/, __csrf=new_csrf; Path=/",
      },
      now,
    );
    expect(result.updates).toEqual({
      NMTID: "fresh_nmt",
      __csrf: "new_csrf",
    });
    expect(result.deletes).toEqual(["MUSIC_U"]);
  });
});
