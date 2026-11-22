import { YTM_SITE } from "./constants";

/**
 * Pure-JS UTF-8 encoder (Rex's JS runtime does not guarantee TextEncoder).
 */
export function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let codePoint = text.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Pure-JS UTF-8 Base64 encoder (Rex's JS runtime does not guarantee btoa or Buffer).
 */
export function utf8ToBase64(text: string): string {
  const bytes = utf8Bytes(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64_ALPHABET[(triple >>> 18) & 0x3f];
    out += BASE64_ALPHABET[(triple >>> 12) & 0x3f];
    out += has1 ? BASE64_ALPHABET[(triple >>> 6) & 0x3f] : "=";
    out += has2 ? BASE64_ALPHABET[triple & 0x3f] : "=";
  }
  return out;
}

/**
 * Pure-JS SHA-1 implementation for YouTube SAPISIDHASH signing.
 */
export function sha1(text: string): string {
  const bytes = utf8Bytes(text);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }
  // 64-bit big-endian bit length
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) {
    bytes.push((highBits >>> shift) & 0xff);
  }
  for (let shift = 24; shift >= 0; shift -= 8) {
    bytes.push((lowBits >>> shift) & 0xff);
  }

  const rotl = (value: number, bits: number) => (value << bits) | (value >>> (32 - bits));
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array<number>(80);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] =
        (bytes[offset + i * 4] << 24) |
        (bytes[offset + i * 4 + 1] << 16) |
        (bytes[offset + i * 4 + 2] << 8) |
        bytes[offset + i * 4 + 3];
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let [a, b, c, d, e] = h;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
  }

  return h.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
}

export function extractCookieValue(cookieHeader: string, name: string): string {
  if (!cookieHeader) {
    return "";
  }
  for (const part of cookieHeader.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }
    if (part.slice(0, eqIndex).trim() === name) {
      return part.slice(eqIndex + 1).trim();
    }
  }
  return "";
}

export interface ParsedCookieAuth {
  cookie: string;
  authUser: string;
  pageId?: string;
  hasSapisid: boolean;
}

function unescapeSingleQuotedBash(value: string): string {
  return value.replace(/'\\''/g, "'").trim();
}

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\(["\\])/g, "$1").trim();
}

function extractHeaderFromText(text: string, headerName: string): string {
  const escaped = headerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const singleQuoted = new RegExp(`(?:^|[\\s\\\\])(?:-H|--header)\\s+'${escaped}:\\s*((?:[^']|'\\\\'')*)'`, "i").exec(
    text,
  );
  if (singleQuoted?.[1]) {
    return unescapeSingleQuotedBash(singleQuoted[1]);
  }
  const doubleQuoted = new RegExp(`(?:^|[\\s\\\\])(?:-H|--header)\\s+"${escaped}:\\s*((?:[^"\\\\]|\\\\.)*)"`, "i").exec(
    text,
  );
  if (doubleQuoted?.[1]) {
    return unescapeDoubleQuoted(doubleQuoted[1]);
  }
  const jsonField = new RegExp(`"${escaped}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "i").exec(text);
  if (jsonField?.[1]) {
    return unescapeDoubleQuoted(jsonField[1]);
  }
  const rawLine = new RegExp(`^\\s*${escaped}:\\s*(.+)$`, "im").exec(text);
  if (rawLine?.[1]) {
    return rawLine[1].trim();
  }
  return "";
}

/**
 * Normalizes a YouTube Music Cookie input.
 * Accepts a raw Cookie value, a `Cookie: ...` header line, multi-line Request Headers,
 * `Copy as cURL` (bash / POSIX / Windows cmd), or `Copy as fetch (Node.js)`.
 */
export function parseCookieAuthInput(rawInput: string): ParsedCookieAuth {
  const trimmed = (rawInput || "").trim();
  if (!trimmed) {
    return { cookie: "", authUser: "0", hasSapisid: false };
  }

  let text = trimmed;
  if (/(?:^|\s)(?:curl\s+\^"|(?:-H|--header|-b|--cookie)\s+\^")/i.test(text)) {
    text = text.replace(/\^\r?\n/g, " ").replace(/\^([\s\S])/g, "$1");
  }

  let cookie = "";
  const bashCookieFlag = /(?:^|[\s\\])(?:-b|--cookie)\s+'((?:[^']|'\\'')*)'/.exec(text);
  if (bashCookieFlag?.[1]) {
    cookie = unescapeSingleQuotedBash(bashCookieFlag[1]);
  }
  if (!cookie) {
    const doubleQuotedCookieFlag = /(?:^|[\s\\])(?:-b|--cookie)\s+"((?:[^"\\]|\\.)*)"/.exec(text);
    if (doubleQuotedCookieFlag?.[1]) {
      cookie = unescapeDoubleQuoted(doubleQuotedCookieFlag[1]);
    }
  }
  if (!cookie) {
    cookie = extractHeaderFromText(text, "cookie");
  }
  if (!cookie && !/^\s*(?:curl\s+|fetch\s*\()/i.test(text)) {
    cookie = text.replace(/\r?\n+/g, "; ").trim();
  }

  const rawAuthUser = extractHeaderFromText(text, "x-goog-authuser");
  const authUser = /^\d+$/.test(rawAuthUser) ? rawAuthUser : "0";
  const rawPageId = extractHeaderFromText(text, "x-goog-pageid");
  const pageId = rawPageId && /^[A-Za-z0-9_-]+$/.test(rawPageId) ? rawPageId : undefined;
  const hasSapisid = Boolean(extractCookieValue(cookie, "__Secure-3PAPISID") || extractCookieValue(cookie, "SAPISID"));

  return {
    cookie,
    authUser,
    ...(pageId ? { pageId } : {}),
    hasSapisid,
  };
}

export function buildAuthHeaders(
  cookieHeader: string,
  origin = YTM_SITE,
  nowSeconds = Math.floor(Date.now() / 1000),
): Record<string, string> {
  const parsed = parseCookieAuthInput(cookieHeader);
  if (!parsed.cookie) {
    return {};
  }
  const sapisid =
    extractCookieValue(parsed.cookie, "__Secure-3PAPISID") || extractCookieValue(parsed.cookie, "SAPISID");
  if (!sapisid) {
    return {
      cookie: parsed.cookie,
    };
  }
  const digest = sha1(`${nowSeconds} ${sapisid} ${origin}`);
  return {
    cookie: parsed.cookie,
    authorization: `SAPISIDHASH ${nowSeconds}_${digest}`,
    "x-goog-authuser": parsed.authUser,
    ...(parsed.pageId ? { "x-goog-pageid": parsed.pageId } : {}),
  };
}

export function parseHttpsUrlParts(url: string): { origin: string; hostname: string } | null {
  const match = /^(https:\/\/([^/?#:]+)(?::\d+)?)(?:[/?#]|$)/i.exec((url || "").trim());
  if (!match) {
    return null;
  }
  return {
    origin: match[1],
    hostname: match[2].toLowerCase(),
  };
}

export function isYouTubeHostname(hostname: string): boolean {
  return /(^|\.)youtube\.com$/i.test(hostname);
}

export function getQueryParam(url: string, name: string): string | null {
  const queryStart = url.indexOf("?");
  if (queryStart < 0) {
    return null;
  }
  const hashStart = url.indexOf("#", queryStart);
  const query = hashStart >= 0 ? url.slice(queryStart + 1, hashStart) : url.slice(queryStart + 1);
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
    if (decodeURIComponent(rawKey) === name) {
      return eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : "";
    }
  }
  return null;
}

export function setQueryParams(url: string, updates: Record<string, string>): string {
  const hashIndex = url.indexOf("#");
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutHash.indexOf("?");
  const base = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const existingQuery = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";

  const entries: Array<[string, string]> = [];
  const indexByKey = new Map<string, number>();

  if (existingQuery) {
    for (const pair of existingQuery.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const key = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
      const value = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : "";
      if (indexByKey.has(key)) {
        const idx = indexByKey.get(key) as number;
        entries[idx] = [key, value];
      } else {
        indexByKey.set(key, entries.length);
        entries.push([key, value]);
      }
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (indexByKey.has(key)) {
      const idx = indexByKey.get(key) as number;
      entries[idx] = [key, value];
    } else {
      indexByKey.set(key, entries.length);
      entries.push([key, value]);
    }
  }

  const serialized = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return serialized ? `${base}?${serialized}${hash}` : `${base}${hash}`;
}
