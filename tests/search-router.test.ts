import { describe, expect, it } from "vitest";
import type { Citation } from "@/lib/domain";
import {
  runStagedSearch,
  type SearchBackend,
} from "@/lib/search-router";

const citation = (id: string): Citation => ({
  id,
  title: id,
  url: `https://example.test/${id}`,
  sourceName: "fixture",
  sourceKind: "trusted_wiki",
  credibility: "trusted_wiki",
  factStatus: "trusted_secondary",
  excerpt: "冰之女皇领导愚人众执行官。",
  external: true,
  crossLanguage: false,
});

describe("staged search routing", () => {
  it("stops before general web when direct references are sufficient", async () => {
    let generalCalls = 0;
    const backends: SearchBackend[] = [
      {
        id: "reference",
        tier: "direct_reference",
        search: async () => [citation("reference-1"), citation("reference-2")],
      },
      {
        id: "general",
        tier: "general_web",
        search: async () => {
          generalCalls += 1;
          return [citation("general-1")];
        },
      },
    ];

    const result = await runStagedSearch(backends, {
      question: "冰之女皇与愚人众执行官之间是什么关系？",
      language: "zh-CN",
      isSufficient: (items) => items.length >= 2,
    });

    expect(generalCalls).toBe(0);
    expect(result.citations).toHaveLength(2);
    expect(result.attempts[0]?.status).toBe("ok");
  });

  it("isolates one failed backend and continues to the next tier", async () => {
    const backends: SearchBackend[] = [
      {
        id: "reference",
        tier: "direct_reference",
        search: async () => {
          throw new Error("provider unavailable");
        },
      },
      {
        id: "general",
        tier: "general_web",
        search: async () => [citation("general-1")],
      },
    ];

    const result = await runStagedSearch(backends, {
      question: "冰之女皇与愚人众执行官之间是什么关系？",
      language: "zh-CN",
      isSufficient: (items) => items.length >= 1,
    });

    expect(result.citations.map((item) => item.id)).toContain("general-1");
    expect(result.attempts.map((item) => item.status)).toEqual([
      "error",
      "ok",
    ]);
  });

  it("deduplicates copies returned by independent backends", async () => {
    const shared = citation("shared");
    const backends: SearchBackend[] = [
      {
        id: "reference-a",
        tier: "direct_reference",
        search: async () => [shared],
      },
      {
        id: "reference-b",
        tier: "direct_reference",
        search: async () => [{ ...shared, id: "duplicate" }],
      },
    ];

    const result = await runStagedSearch(backends, {
      question: "冰之女皇与愚人众执行官之间是什么关系？",
      language: "zh-CN",
      isSufficient: () => false,
    });

    expect(result.citations).toHaveLength(1);
    expect(result.attempts).toHaveLength(2);
  });
});
