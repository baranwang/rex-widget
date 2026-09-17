import { describe, expect, test } from "@rstest/core";
import { parseSubmitMapping } from "./submit.ts";

describe("parseSubmitMapping", () => {
  test("accepts ambiguous status", () => {
    expect(parseSubmitMapping({ status: "ambiguous", reason: "two cids" })).toEqual({
      status: "ambiguous",
      reason: "two cids",
    });
  });

  test("rejects invalid provider idString", () => {
    expect(() =>
      parseSubmitMapping({
        status: "confident",
        mapping: {
          type: "tv",
          tmdbId: 1,
          title: "X",
          providers: [{ season: 1, provider: "bilibili", idString: "nope" }],
        },
      }),
    ).toThrow("idString must be valid for the selected provider");
  });
});
