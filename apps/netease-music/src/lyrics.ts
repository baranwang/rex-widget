import { base64EncodeUtf8 } from "./crypto";

export interface NeteaseLyricResponse {
  lrc?: { lyric?: string };
  tlyric?: { lyric?: string };
  romalrc?: { lyric?: string };
  klyric?: { lyric?: string };
}

interface ParsedLrcLine {
  timeMs: number;
  timestamp: string;
  text: string;
}

const TIMESTAMP_TAG_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG_RE = /^\[(ti|ar|al|by|offset):[^\]]*\]$/i;

function formatLrcTimestamp(timeMs: number): string {
  const safeMs = Math.max(0, Math.round(timeMs));
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const hundredths = Math.floor((safeMs % 1000) / 10);
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}]`;
}

function parseFractionToMs(fraction?: string): number {
  if (!fraction) {
    return 0;
  }
  if (fraction.length === 1) {
    return Number(fraction) * 100;
  }
  if (fraction.length === 2) {
    return Number(fraction) * 10;
  }
  return Number(fraction.slice(0, 3));
}

export function cleanLrcText(raw?: string): string {
  if (typeof raw !== "string") {
    return "";
  }
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return "";
  }
  // Ignore NetEase's pure instrumental placeholder lines when no real lyrics exist
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 1 && /纯音乐[，,]?\s*请欣赏/.test(lines[0])) {
    return "";
  }
  return normalized;
}

export function parseLrcLines(lrc: string): { metadata: string[]; lines: ParsedLrcLine[] } {
  const metadata: string[] = [];
  const lines: ParsedLrcLine[] = [];

  for (const rawLine of lrc.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }
    if (META_TAG_RE.test(trimmed)) {
      metadata.push(trimmed);
      continue;
    }

    const matches = Array.from(trimmed.matchAll(TIMESTAMP_TAG_RE));
    if (!matches.length) {
      continue;
    }
    const text = trimmed.replace(TIMESTAMP_TAG_RE, "").trim();
    if (!text) {
      continue;
    }
    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const ms = parseFractionToMs(match[3]);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(ms)) {
        continue;
      }
      const timeMs = minutes * 60000 + seconds * 1000 + ms;
      lines.push({
        timeMs,
        timestamp: formatLrcTimestamp(timeMs),
        text,
      });
    }
  }

  lines.sort((a, b) => a.timeMs - b.timeMs);
  return { metadata, lines };
}

/**
 * Merges original LRC and translated LRC by timestamp (within +/-250ms tolerance)
 * so bilingual lyrics stay synced line-by-line in Rex's player.
 */
export function mergeBilingualLrc(originalLrc: string, translatedLrc: string): string {
  const orig = parseLrcLines(originalLrc);
  const trans = parseLrcLines(translatedLrc);
  if (!orig.lines.length || !trans.lines.length) {
    return "";
  }

  const out: string[] = [...orig.metadata];
  let transIdx = 0;

  for (const line of orig.lines) {
    out.push(`${line.timestamp}${line.text}`);
    while (transIdx < trans.lines.length && trans.lines[transIdx].timeMs < line.timeMs - 250) {
      transIdx++;
    }
    let matchedText = "";
    let bestDiff = 251;
    let probe = transIdx;
    while (probe < trans.lines.length && trans.lines[probe].timeMs <= line.timeMs + 250) {
      const diff = Math.abs(trans.lines[probe].timeMs - line.timeMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        matchedText = trans.lines[probe].text;
      }
      probe++;
    }
    if (matchedText && matchedText !== line.text) {
      out.push(`${line.timestamp}${matchedText}`);
    }
  }

  return out.join("\n");
}

export function toLrcDataUri(lrcText: string): string {
  return `data:text/plain;charset=utf-8;base64,${base64EncodeUtf8(lrcText)}`;
}

export function buildLyricSubtitleItems(songId: string, response: NeteaseLyricResponse): SubtitleItem[] {
  const original = cleanLrcText(response.lrc?.lyric);
  const translated = cleanLrcText(response.tlyric?.lyric);
  const romaji = cleanLrcText(response.romalrc?.lyric);

  const items: SubtitleItem[] = [];

  if (original && translated) {
    const bilingual = mergeBilingualLrc(original, translated);
    if (bilingual) {
      items.push({
        id: `ncm:lyric:${songId}:bilingual`,
        title: Widget.i18n("双语歌词（原文 + 译文）"),
        lang: "zh-CN",
        url: toLrcDataUri(bilingual),
      });
    }
  }

  if (original) {
    items.push({
      id: `ncm:lyric:${songId}:orig`,
      title: Widget.i18n("原文歌词"),
      lang: translated ? "und" : "zh-CN",
      url: toLrcDataUri(original),
    });
  }

  if (translated) {
    items.push({
      id: `ncm:lyric:${songId}:tlyric`,
      title: Widget.i18n("中文翻译歌词"),
      lang: "zh-CN",
      url: toLrcDataUri(translated),
    });
  }

  if (romaji) {
    items.push({
      id: `ncm:lyric:${songId}:romalrc`,
      title: Widget.i18n("罗马音歌词"),
      lang: "und",
      url: toLrcDataUri(romaji),
    });
  }

  return items;
}
