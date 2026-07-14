import { describe, expect, it, vi } from "vitest";
import type { Citation } from "@/lib/domain";
import {
  runStagedSearch,
  type SearchBackend,
} from "@/lib/search-router";

function citation(id: string, url = `https://example.com/${id}`): Citation {
  return {
    id,
    title: `Title ${id}`,
    url,
    sourceName: "Test source",
    sourceKind: "trusted_wiki",
    factStatus: "trusted_secondary",
    excerpt: `Evidence ${id}`,
    external: true,
    crossLanguage: false,
  };
}

function backend(
  id: string,
  tier: SearchBackend["tier"],
  search: SearchBackend["search"],
): SearchBackend {
  return { id, tier, search };
}

describe("staged search router", () => {
  it("runs direct backends concurrently and skips general web after async sufficiency", async () => {
    const started: string[] = [];
    let resolveA!: (items: Citation[]) => void;
    let resolveB!: (items: Citation[]) => void;
    const general = vi.fn(async () => [citation("general")]);
    const resultPromise = runStagedSearch(
      [
        backend("direct-a", "direct_reference", () => {
          started.push("a");
          return new Promise((resolve) => {
            resolveA = resolve;
          });
        }),
        backend("direct-b", "direct_reference", () => {
          started.push("b");
          return new Promise((resolve) => {
            resolveB = resolve;
          });
        }),
        backend("general", "general_web", general),
      ],
      {
        question: "test",
        language: "en",
        isSufficient: async (items) => items.length >= 2,
      },
    );

    await Promise.resolve();
    expect(started.sort()).toEqual(["a", "b"]);
    resolveA([citation("a")]);
    resolveB([citation("b")]);

    const result = await resultPromise;
    expect(result.citations.map((item) => item.id).sort()).toEqual(["a", "b"]);
    expect(general).not.toHaveBeenCalled();
  });

  it("falls through to general web when direct references are empty", async () => {
    const general = vi.fn(async () => [citation("general")]);
    const result = await runStagedSearch(
      [
        backend("direct", "direct_reference", async () => []),
        backend("general", "general_web", general),
      ],
      {
        question: "test",
        language: "en",
        isSufficient: (items) => items.length > 0,
      },
    );

    expect(general).toHaveBeenCalledOnce();
    expect(result.citations.map((item) => item.id)).toEqual(["general"]);
    expect(result.attempts.map((attempt) => attempt.status)).toEqual([
      "empty",
      "ok",
    ]);
  });

  it("records timeout and error attempts without dropping successful results", async () => {
    const timeout = Object.assign(new Error("slow"), { name: "TimeoutError" });
    const result = await runStagedSearch(
      [
        backend("timeout", "direct_reference", async () => {
          throw timeout;
        }),
        backend("error", "direct_reference", async () => {
          throw new Error("broken");
        }),
        backend("ok", "direct_reference", async () => [citation("ok")]),
      ],
      {
        question: "test",
        language: "en",
        isSufficient: () => true,
      },
    );

    expect(result.citations.map((item) => item.id)).toEqual(["ok"]);
    expect(
      Object.fromEntries(
        result.attempts.map((attempt) => [attempt.backendId, attempt.status]),
      ),
    ).toEqual({ timeout: "timeout", error: "error", ok: "ok" });
  });

  it("does not start the next tier after cancellation", async () => {
    const controller = new AbortController();
    const general = vi.fn(async () => [citation("general")]);
    const result = await runStagedSearch(
      [
        backend("direct", "direct_reference", async () => {
          controller.abort();
          return [];
        }),
        backend("general", "general_web", general),
      ],
      {
        question: "test",
        language: "en",
        signal: controller.signal,
        isSufficient: () => false,
      },
    );

    expect(general).not.toHaveBeenCalled();
    expect(result.citations).toEqual([]);
  });

  it("deduplicates equivalent URL, title, and excerpt results", async () => {
    const first = citation("one", "https://EXAMPLE.com/page#section");
    const duplicate = {
      ...citation("two", "https://example.com/page"),
      title: `  ${first.title.toUpperCase()}  `,
      excerpt: ` ${first.excerpt.toUpperCase()} `,
    };
    const result = await runStagedSearch(
      [
        backend("a", "direct_reference", async () => [first]),
        backend("b", "direct_reference", async () => [duplicate]),
      ],
      {
        question: "test",
        language: "en",
        isSufficient: () => true,
      },
    );

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.id).toBe("one");
  });

  it("records empty tiers without inventing attempts for missing backends", async () => {
    const result = await runStagedSearch([], {
      question: "test",
      language: "en",
      isSufficient: () => false,
    });

    expect(result).toEqual({ citations: [], attempts: [] });
  });
});
