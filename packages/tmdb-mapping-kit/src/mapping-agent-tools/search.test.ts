import { describe, expect, test } from "@rstest/core";
import { searchCatalog } from "./search.ts";

describe("searchCatalog", () => {
  test("defaults scope to all and keeps the other side when one source fails", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org")) {
        return {
          ok: true,
          json: async () => ({ results: [{ id: 9, name: "将夜", first_air_date: "2018-10-31" }] }),
        } as Response;
      }
      throw new Error("360 down");
    };
    const result = await searchCatalog({ query: "将夜", type: "tv" }, { TMDB_ACCESS_TOKEN: "token" }, fetchImpl);
    expect(result.tmdb[0]?.tmdbId).toBe(9);
    expect(result.platforms).toEqual([]);
  });

  test("scope tmdb never calls 360", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input));
      if (String(input).includes("api.themoviedb.org")) {
        return {
          ok: true,
          json: async () => ({ results: [{ id: 9, name: "将夜", first_air_date: "2018-10-31" }] }),
        } as Response;
      }
      throw new Error("unexpected fetch");
    };
    const result = await searchCatalog(
      { query: "将夜", type: "tv", scope: "tmdb" },
      { TMDB_ACCESS_TOKEN: "token" },
      fetchImpl,
    );
    expect(result.tmdb[0]?.tmdbId).toBe(9);
    expect(result.platforms).toEqual([]);
    expect(urls.some((url) => url.includes("api.so.360kan.com"))).toBe(false);
  });

  test("scope platforms returns empty tmdb", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("api.so.360kan.com")) {
        return {
          ok: true,
          json: async () => ({
            data: {
              longData: {
                rows: [
                  {
                    cat_id: "2",
                    titleTxt: "将夜",
                    playlinks: {
                      imgo: "https://www.mgtv.com/h/860862.html",
                    },
                  },
                ],
              },
            },
          }),
        } as Response;
      }
      throw new Error("unexpected fetch");
    };
    const result = await searchCatalog(
      { query: "将夜", type: "tv", scope: "platforms" },
      { TMDB_ACCESS_TOKEN: "token" },
      fetchImpl,
    );
    expect(result.tmdb).toEqual([]);
    expect(result.platforms).toEqual(
      expect.arrayContaining([{ provider: "mgtv", idString: "dramaId=860862", source: "360kan", title: "将夜" }]),
    );
  });
});
