export const MANAGED_COOKIE_NAMES = ["MUSIC_U", "__csrf", "NMTID"] as const;
export type ManagedCookieName = (typeof MANAGED_COOKIE_NAMES)[number];

export interface ParsedCookieAuth {
  cookieHeader: string;
  cookies: Record<string, string>;
  hasMusicU: boolean;
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

export function parseCookiePairs(cookieHeader: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) {
    return map;
  }
  for (const part of cookieHeader.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }
    const name = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (!name || !value || /[\r\n]/.test(name) || /[\r\n]/.test(value)) {
      continue;
    }
    map[name] = value;
  }
  return map;
}

export function serializeCookiePairs(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([k, v]) => Boolean(k && v))
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Normalizes a NetEase Cloud Music Cookie input.
 * Accepts:
 * - A bare `MUSIC_U` token value (hex/alphanumeric string without `=`)
 * - A raw Cookie value (`MUSIC_U=...; __csrf=...`)
 * - A `Cookie: ...` header line or multi-line Request Headers
 * - `Copy as cURL` (bash / POSIX / Windows cmd) or `Copy as fetch`
 */
export function parseCookieAuthInput(rawInput: string): ParsedCookieAuth {
  const trimmed = (rawInput || "").trim();
  if (!trimmed) {
    return { cookieHeader: "", cookies: {}, hasMusicU: false };
  }

  let text = trimmed;
  if (/(?:^|\s)(?:curl\s+\^"|(?:-H|--header|-b|--cookie)\s+\^")/i.test(text)) {
    text = text.replace(/\^\r?\n/g, " ").replace(/\^([\s\S])/g, "$1");
  }

  let rawCookie = "";
  const bashCookieFlag = /(?:^|[\s\\])(?:-b|--cookie)\s+'((?:[^']|'\\'')*)'/.exec(text);
  if (bashCookieFlag?.[1]) {
    rawCookie = unescapeSingleQuotedBash(bashCookieFlag[1]);
  }
  if (!rawCookie) {
    const doubleQuotedCookieFlag = /(?:^|[\s\\])(?:-b|--cookie)\s+"((?:[^"\\]|\\.)*)"/.exec(text);
    if (doubleQuotedCookieFlag?.[1]) {
      rawCookie = unescapeDoubleQuoted(doubleQuotedCookieFlag[1]);
    }
  }
  if (!rawCookie) {
    rawCookie = extractHeaderFromText(text, "cookie");
  }
  if (!rawCookie && !/^\s*(?:curl\s+|fetch\s*\()/i.test(text)) {
    const flattened = text.replace(/\r?\n+/g, "; ").trim();
    // Allow pasting a bare MUSIC_U token directly without the `MUSIC_U=` prefix
    if (!flattened.includes("=") && !flattened.includes(";") && /^[A-Za-z0-9._-]{32,}$/.test(flattened)) {
      rawCookie = `MUSIC_U=${flattened}`;
    } else {
      rawCookie = flattened;
    }
  }

  const cookies = parseCookiePairs(rawCookie);
  const cookieHeader = serializeCookiePairs(cookies);
  return {
    cookieHeader,
    cookies,
    hasMusicU: Boolean(cookies.MUSIC_U),
  };
}

/**
 * Splits a combined `Set-Cookie` header string safely without breaking on
 * commas inside `Expires=Wed, 21 Oct 2026 07:28:00 GMT` attributes.
 */
export function splitSetCookieHeader(headerValue: string): string[] {
  if (!headerValue) {
    return [];
  }
  const cookies: string[] = [];
  let start = 0;
  let inExpires = false;

  for (let i = 0; i < headerValue.length; i++) {
    const ch = headerValue[i];
    if (ch === ";") {
      const rest = headerValue.slice(i + 1).trimStart();
      inExpires = /^expires\s*=/i.test(rest);
    } else if (ch === ",") {
      if (inExpires) {
        inExpires = false;
        continue;
      }
      const part = headerValue.slice(start, i).trim();
      if (part) {
        cookies.push(part);
      }
      start = i + 1;
    }
  }
  const tail = headerValue.slice(start).trim();
  if (tail) {
    cookies.push(tail);
  }
  return cookies;
}

export interface SetCookieUpdate {
  updates: Partial<Record<ManagedCookieName, string>>;
  deletes: ManagedCookieName[];
}

/**
 * Extracts managed cookie updates (`MUSIC_U`, `__csrf`, `NMTID`) from a `Set-Cookie` response header.
 */
export function extractManagedSetCookies(headers?: Record<string, string>, now = Date.now()): SetCookieUpdate {
  const updates: Partial<Record<ManagedCookieName, string>> = {};
  const deletes: ManagedCookieName[] = [];
  if (!headers) {
    return { updates, deletes };
  }

  let rawSetCookie = "";
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "set-cookie" && typeof value === "string") {
      rawSetCookie = rawSetCookie ? `${rawSetCookie}, ${value}` : value;
    }
  }
  if (!rawSetCookie) {
    return { updates, deletes };
  }

  for (const cookieStr of splitSetCookieHeader(rawSetCookie)) {
    const segments = cookieStr.split(";");
    const first = segments[0]?.trim() || "";
    const eq = first.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const name = first.slice(0, eq).trim() as ManagedCookieName;
    if (!(MANAGED_COOKIE_NAMES as readonly string[]).includes(name)) {
      continue;
    }
    const value = first.slice(eq + 1).trim();

    let expired = !value;
    for (const attr of segments.slice(1)) {
      const trimmed = attr.trim();
      const maxAgeMatch = /^max-age\s*=\s*(-?\d+)$/i.exec(trimmed);
      if (maxAgeMatch?.[1] && Number(maxAgeMatch[1]) <= 0) {
        expired = true;
      }
      const expiresMatch = /^expires\s*=\s*(.+)$/i.exec(trimmed);
      if (expiresMatch?.[1]) {
        const parsedTime = Date.parse(expiresMatch[1]);
        if (Number.isFinite(parsedTime) && parsedTime <= now) {
          expired = true;
        }
      }
    }

    if (expired) {
      delete updates[name];
      if (!deletes.includes(name)) {
        deletes.push(name);
      }
    } else {
      updates[name] = value;
      const delIdx = deletes.indexOf(name);
      if (delIdx >= 0) {
        deletes.splice(delIdx, 1);
      }
    }
  }

  return { updates, deletes };
}
