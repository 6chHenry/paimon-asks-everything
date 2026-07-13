# Final Live Citation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove browser/edit shells and unresolved search-result destinations from every answer citation while preserving clean evidence and correct provenance.

**Architecture:** Add one text-quality detector to the existing hard-rejection chain and one dependency-free URL boundary shared by search ingestion and evidence selection. Search enrichment may drop a citation and always rebuilds provenance from a changed final destination.

**Tech Stack:** TypeScript, Next.js 16, Vitest, existing source-governance and citation pipeline.

## Global Constraints

- Do not add fetches, search calls, model calls, runtime dependencies, or title-derived URLs.
- Do not add source-, character-, or lore-specific text patterns.
- URL output is an absolute HTTP(S) destination or no citation.
- Valid Yahoo `RU` and DuckDuckGo `uddg` targets decode; unresolved/malformed engine URLs do not survive.
- A changed response host atomically replaces source name, source kind, credibility, fact status, and assessment.
- Preserve port 3000 and unrelated worktree state.

---

### Task 1: Browser/edit-shell hard rejection

**Files:**
- Modify: `lib/web-text-quality.ts`
- Modify: `tests/web-text-quality.test.ts`
- Modify: `tests/evidence-quality.test.ts`

**Interfaces:**
- Produces: `looksLikeBrowserEditShell(value: string): boolean`
- Consumed by: `isUnusableWebText`, `webTextQualityScore`, and transitively `selectAnswerEvidence`

- [ ] **Step 1: Write failing tests**

Use the exact live excerpt in both suites:

```ts
const liveShell =
  "This site requires JavaScript enabled. Please check your browser settings... 欢迎正在阅读这个条目的旅行者协助 编辑本条目...萌娘百科祝各位旅行者在本站度过愉快的时光!";

expect(looksLikeBrowserEditShell(liveShell)).toBe(true);
expect(isNavigationHeavy(liveShell)).toBe(true);
expect(isUnusableWebText(liveShell)).toBe(true);
expect(webTextQualityScore(liveShell)).toBe(Number.NEGATIVE_INFINITY);
expect(looksLikeBrowserEditShell("婕德失去父亲后寻找归属，最终决定自己选择未来。")).toBe(false);
```

Evidence selection must return `[]` for a citation carrying `liveShell` and retain a clean story citation.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/web-text-quality.test.ts tests/evidence-quality.test.ts`

Expected: failures for the missing detector and retained live shell; existing tests remain green.

- [ ] **Step 3: Implement the detector**

Add a generic conjunction-based detector:

```ts
export function looksLikeBrowserEditShell(value: string) {
  const text = value.normalize("NFKC");
  const scriptAndBrowser =
    /(?:requires?|enable|disabled?).{0,40}javascript|javascript.{0,40}(?:requires?|enable|disabled?)/iu.test(text) &&
    /browser.{0,30}(?:settings?|configuration)|(?:settings?|configuration).{0,30}browser/iu.test(text);
  const collaborativeEditShell =
    /欢迎|welcome|正在阅读|reading/iu.test(text) &&
    /协助|帮助|assist|help|编辑|edit/iu.test(text) &&
    /条目|页面|词条|entry|page/iu.test(text);
  return scriptAndBrowser || collaborativeEditShell;
}
```

Call it from `isNavigationHeavy` so `isUnusableWebText` and hard scoring inherit the result.

- [ ] **Step 4: Verify GREEN**

Run the same two-file command. Expected: both files pass.

---

### Task 2: Shared search-result URL boundary

**Files:**
- Create: `lib/search-result-url.ts`
- Create: `tests/search-result-url.test.ts`
- Modify: `lib/external-search.ts`
- Modify: `lib/evidence-quality.ts`
- Modify: `tests/external-search.test.ts`

**Interfaces:**
- Produces: `normalizeSearchResultUrl(rawUrl: string): string | undefined`
- Produces: `isUnresolvedSearchResultUrl(rawUrl: string): boolean`
- Consumed by: `makeWebCitation`, enrichment, and `selectAnswerEvidence`

- [ ] **Step 1: Write failing utility and ingestion tests**

Cover these exact classes:

```ts
expect(normalizeSearchResultUrl(validYahooRu)).toBe("https://www.miyoushe.com/ys/article/35324992");
expect(normalizeSearchResultUrl("https://www.yahoo.com/")).toBeUndefined();
expect(normalizeSearchResultUrl(malformedYahooRu)).toBeUndefined();
expect(normalizeSearchResultUrl(malformedDdgRedirect)).toBeUndefined();
expect(isUnresolvedSearchResultUrl("https://search.yahoo.com/search?p=jeht")).toBe(true);
```

In `external-search.test.ts`, return a Yahoo result whose Miyoushe-shaped title/snippet links to `https://www.yahoo.com/`; assert it is absent. Return a valid `RU` link; assert the citation URL is decoded and its source name/kind/assessment agree with the destination. Mock a readable-page response whose `response.url` changes host; assert all provenance fields match the final URL and no stale source name remains.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/search-result-url.test.ts tests/external-search.test.ts tests/evidence-quality.test.ts`

Expected: the utility module/import is missing and unresolved/cross-host cases fail.

- [ ] **Step 3: Implement dependency-free URL normalization**

In `lib/search-result-url.ts`, parse DDG-relative hrefs against `https://duckduckgo.com`, safely decode at most two redirect layers, require `http:` or `https:`, and reject known search-engine root/result/interstitial hosts and paths. Yahoo `r.search.yahoo.com` requires a valid `/RU=<encoded-target>/` segment; DuckDuckGo redirect endpoints require a valid `uddg` target. Never return the raw input after a parse/decode failure.

- [ ] **Step 4: Wire ingestion and defense in depth**

Replace the private normalizer in `external-search.ts`. `makeWebCitation` first calls `normalizeSearchResultUrl`; no normalized destination means `[]`. In `selectAnswerEvidence`, reject when `isUnresolvedSearchResultUrl(citation.url)` is true.

Update enrichment to return `Citation | undefined`. Validate `response.url || citation.url` with the shared normalizer before returning. Adapt both enrichment collectors to omit undefined results.

Add a provenance builder that derives classification and governance from the final URL:

```ts
function citationWithProvenance(citation: Citation, url: string, excerpt: string, pageHtml?: string) {
  const classification = classifyWebSource(url);
  const assessment = assessSourceRule({ url, title: citation.title, excerpt, pageHtml });
  const legacy = legacySourceFields(assessment);
  return {
    ...citation,
    url,
    excerpt,
    sourceName: classification.sourceName,
    sourceKind: legacy.sourceKind,
    credibility: legacy.credibility,
    factStatus: legacy.factStatus,
    assessment,
  };
}
```

Official publisher identity may refine the new classification, but must never fall back to `citation.sourceName` after a host change.

- [ ] **Step 5: Verify GREEN**

Run the same three-file command. Expected: all pass.

---

### Task 3: End-to-end generation boundary and verification

**Files:**
- Modify: `tests/generation.test.ts`
- Modify: `.superpowers/sdd/character-arc-live-fix-report.md` (ignored working report, not staged)

**Interfaces:**
- Consumes: text hard rejection and unresolved URL guard from Tasks 1-2
- Produces: deterministic regression that neither live failure reaches `external` or `citedSourceIds`

- [ ] **Step 1: Write the failing generation regression before production implementation**

Supply one citation with the exact browser/edit shell and one with the exact Yahoo-root title/URL mismatch. Force the existing cold fallback. Assert:

```ts
expect(result.external).toEqual([]);
expect(result.citedSourceIds).toEqual([]);
expect(result.answerParagraphs.flatMap((paragraph) => paragraph.citationIds)).toEqual([]);
```

- [ ] **Step 2: Verify RED, then GREEN with Tasks 1-2**

RED command: `npm test -- tests/web-text-quality.test.ts tests/evidence-quality.test.ts tests/search-result-url.test.ts tests/external-search.test.ts tests/generation.test.ts`

After implementation, the identical command must pass.

- [ ] **Step 3: Run expanded and full verification**

Run:

```powershell
npm test -- tests/agent.test.ts tests/chat-stream.test.ts tests/question-understanding.test.ts tests/web-text-quality.test.ts tests/evidence-quality.test.ts tests/search-result-url.test.ts tests/external-search.test.ts tests/answer-quality.test.ts tests/generation.test.ts
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: every command exits 0, 15/15 static pages build, and port 3000 remains on PID 34240.

- [ ] **Step 4: Commit and report**

Stage only the production/tests from Tasks 1-3 and commit with `fix: harden live citation boundaries`. Append RED/GREEN counts, full verification, commit, files, self-review, and concerns to the ignored live-fix report.
