import type { TmdbHit } from "../tmdb.ts";

export type SearchScope = "tmdb" | "platforms" | "all";

export type SearchInput = {
  query: string;
  scope?: SearchScope;
  type?: "movie" | "tv";
  year?: number;
  season?: number;
  providers?: string[];
  limit?: number;
};

export type SearchOutput = {
  tmdb: TmdbHit[];
  platforms: Array<{
    provider: string;
    idString: string;
    source: "360kan" | "mgtv" | "renren";
    title?: string;
  }>;
};
