import { describe, expect, test } from "@rstest/core";
import { toolJson } from "./json-result.ts";
import { getTmdb, searchTmdb } from "./tmdb.ts";

describe("toolJson", () => {
  test("truncates long JSON", () => {
    const text = toolJson({ items: "x".repeat(20_000) }, 100);
    expect(text.length).toBeLessThanOrEqual(120);
    expect(text).toContain("truncated");
  });
});

describe("getTmdb", () => {
  test("returns movie title, year, and url", async () => {
    const fetchImpl: typeof fetch = async () =>
      ({
        ok: true,
        json: async () => ({ title: "哪吒之魔童闹海", release_date: "2025-01-29" }),
      }) as Response;
    await expect(
      getTmdb({ tmdbId: 980477, type: "movie" }, { TMDB_ACCESS_TOKEN: "token" }, fetchImpl),
    ).resolves.toEqual({
      tmdbId: 980477,
      type: "movie",
      title: "哪吒之魔童闹海",
      year: 2025,
      url: "https://www.themoviedb.org/movie/980477",
    });
  });

  test("includes TV season episodes when season is set", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/season/1")) {
        return {
          ok: true,
          json: async () => ({
            episodes: [{ episode_number: 1, name: "第1集", air_date: "2018-10-31" }],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ name: "将夜", first_air_date: "2018-10-31" }) } as Response;
    };
    const details = await getTmdb({ tmdbId: 282136, type: "tv", season: 1 }, { TMDB_ACCESS_TOKEN: "token" }, fetchImpl);
    expect(details.seasonEpisodes).toEqual([{ episodeNumber: 1, name: "第1集", airDate: "2018-10-31" }]);
  });
});

describe("searchTmdb", () => {
  test("maps search hits and caps the limit", async () => {
    const fetchImpl: typeof fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          results: [
            { id: 1, name: "A", first_air_date: "2020-01-01" },
            { id: 2, name: "B", first_air_date: "2021-01-01" },
          ],
        }),
      }) as Response;
    const hits = await searchTmdb({ query: "将夜", type: "tv", limit: 1 }, { TMDB_ACCESS_TOKEN: "token" }, fetchImpl);
    expect(hits).toEqual([{ tmdbId: 1, type: "tv", title: "A", year: 2020, url: "https://www.themoviedb.org/tv/1" }]);
  });

  test("searches movie and TV before applying the untyped limit", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input));
      if (String(input).includes("/search/movie")) {
        return {
          ok: true,
          json: async () => ({
            results: Array.from({ length: 8 }, (_, index) => ({
              id: index + 1,
              title: `M${index + 1}`,
              release_date: "2020-01-01",
            })),
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ results: [{ id: 282136, name: "将夜", first_air_date: "2018-10-31" }] }),
      } as Response;
    };
    const hits = await searchTmdb({ query: "将夜", limit: 8 }, { TMDB_ACCESS_TOKEN: "token" }, fetchImpl);
    expect(urls.some((url) => url.includes("/search/movie"))).toBe(true);
    expect(urls.some((url) => url.includes("/search/tv"))).toBe(true);
    expect(hits.some((hit) => hit.type === "tv" && hit.tmdbId === 282136)).toBe(true);
    expect(hits).toHaveLength(8);
  });
});
