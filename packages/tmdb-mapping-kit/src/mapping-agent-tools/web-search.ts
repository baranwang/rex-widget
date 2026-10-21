const EXA_MCP_URL = "https://mcp.exa.ai/mcp";

export type WebSearchHit = {
  title: string | null;
  url: string;
  publishedDate: string | null;
};

async function callExaMcp(name: string, args: Record<string, unknown>, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(EXA_MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": "tmdb-mapping-agent",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Exa MCP ${response.status}`);
  }
  const raw = await response.text();
  const payload = raw.trimStart().startsWith("{")
    ? raw
    : raw
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .at(-1)
        ?.slice("data: ".length);
  if (!payload) {
    throw new Error("Exa MCP empty response");
  }
  const data = JSON.parse(payload) as {
    error?: { message?: string };
    result?: { isError?: boolean; content?: Array<{ text?: string }> };
  };
  if (data.error) {
    throw new Error(data.error.message || "Exa MCP error");
  }
  const text = (data.result?.content ?? []).map((item) => item.text ?? "").join("\n");
  if (data.result?.isError) {
    throw new Error(text || "Exa MCP tool error");
  }
  return text;
}

// shortcut: hosted MCP returns prose, not JSON. Switch when tools/call adds structuredContent.
export function parseExaSearch(text: string): WebSearchHit[] {
  return text
    .split(/\n---\n/)
    .flatMap((block) => {
      const title = block.match(/^Title: (.*)$/m)?.[1]?.trim();
      const url = block.match(/^URL: (\S+)$/m)?.[1];
      const published = block.match(/^Published: (.*)$/m)?.[1]?.trim();
      if (!url) return [];
      return [
        {
          title: title && title !== "N/A" ? title : null,
          url,
          publishedDate: published && published !== "N/A" ? published : null,
        },
      ];
    })
    .slice(0, 5);
}

export async function webSearch(query: string, fetchImpl: typeof fetch = fetch): Promise<WebSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const text = await callExaMcp("web_search_exa", { query: trimmed, objective: trimmed, numResults: 5 }, fetchImpl);
  return parseExaSearch(text);
}

export type WebPage = {
  title: string | null;
  url: string;
  text: string | null;
};

export function parseExaPages(text: string): WebPage[] {
  const matches = [...text.matchAll(/(?:^|\n\n)# ([^\n]+)\nURL: (\S+)\n\n/g)];
  return matches.flatMap((match, index) => {
    const url = match[2];
    if (!url) return [];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const page = text.slice(start, end).trim();
    return [{ title: match[1] ?? null, url, text: page ? page.slice(0, 1500) : null }];
  });
}

export async function webFetch(urls: string[], fetchImpl: typeof fetch = fetch): Promise<WebPage[]> {
  const limited = urls
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (limited.length === 0) return [];
  const text = await callExaMcp("web_fetch_exa", { urls: limited, maxCharacters: 1500 }, fetchImpl);
  return parseExaPages(text);
}
