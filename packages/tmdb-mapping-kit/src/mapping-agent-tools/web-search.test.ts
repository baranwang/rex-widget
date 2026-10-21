import { describe, expect, test } from "@rstest/core";
import { webFetch, webSearch } from "./web-search.ts";

describe("webSearch", () => {
  test("calls the public Exa MCP and parses title, url, and date", async () => {
    let url = "";
    let body = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      url = String(input);
      body = String(init?.body);
      return {
        ok: true,
        text: async () =>
          `event: message\ndata: ${JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              content: [
                {
                  type: "text",
                  text: "Title: 嫁金钗\nURL: https://v.youku.com/v_show/id_abc.html\nPublished: 2026-10-16\n---\nTitle: N/A\nURL: https://example.com/other\nPublished: N/A\n",
                },
              ],
            },
          })}`,
      } as Response;
    };

    const results = await webSearch("嫁金钗", fetchImpl);
    const request = JSON.parse(body) as { method: string; params: { name: string; arguments: { numResults: number } } };

    expect(url).toBe("https://mcp.exa.ai/mcp");
    expect(request.method).toBe("tools/call");
    expect(request.params.name).toBe("web_search_exa");
    expect(request.params.arguments.numResults).toBe(5);
    expect(results).toEqual([
      {
        title: "嫁金钗",
        url: "https://v.youku.com/v_show/id_abc.html",
        publishedDate: "2026-10-16",
      },
      { title: null, url: "https://example.com/other", publishedDate: null },
    ]);
  });
});

describe("webFetch", () => {
  test("fetches at most 3 pages and trims text to 1500 characters", async () => {
    let body = "";
    const fetchImpl: typeof fetch = async (_input, init) => {
      body = String(init?.body);
      const page = "x".repeat(2000);
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              content: [{ type: "text", text: `# 嫁金钗\nURL: https://v.youku.com/v_show/id_abc.html\n\n${page}` }],
            },
          }),
      } as Response;
    };

    const results = await webFetch(
      [" https://v.youku.com/v_show/id_abc.html ", "", "https://b.example", "https://c.example", "https://d.example"],
      fetchImpl,
    );
    const request = JSON.parse(body) as {
      params: { name: string; arguments: { urls: string[]; maxCharacters: number } };
    };

    expect(request.params.name).toBe("web_fetch_exa");
    expect(request.params.arguments).toEqual({
      urls: ["https://v.youku.com/v_show/id_abc.html", "https://b.example", "https://c.example"],
      maxCharacters: 1500,
    });
    expect(results).toEqual([
      { title: "嫁金钗", url: "https://v.youku.com/v_show/id_abc.html", text: "x".repeat(1500) },
    ]);
  });
});
