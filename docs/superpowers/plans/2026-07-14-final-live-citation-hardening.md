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

---

## P1 Review Follow-up

### Task 4: Preserve reserved query encoding while decoding redirects

**Files:**
- Modify: `lib/search-result-url.ts`
- Modify: `tests/search-result-url.test.ts`

**Interfaces:**
- Refines: `normalizeSearchResultUrl(rawUrl: string): string | undefined`
- Preserves: already-valid absolute HTTP(S) candidates exactly through URL serialization

- [ ] **Step 1: Write failing Yahoo and DuckDuckGo regressions**

```ts
const target = "https://example.com/story?q=a%26b";
expect(normalizeSearchResultUrl(yahooRuFor(target))).toBe(target);
expect(normalizeSearchResultUrl(ddgRedirectFor(target))).toBe(target);
```

Include `%3D` in a second target or query value. Assert exact output, not decoded semantic equivalence.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/search-result-url.test.ts`

Expected: current two-pass decoding turns `%26` into `&` and fails exact equality.

- [ ] **Step 3: Stop at the first absolute HTTP(S) candidate**

Refactor `safeDecodeRedirectValue` so each loop performs one `decodeURIComponent`, then immediately checks:

```ts
function absoluteHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
```

Return the first valid absolute candidate; continue only when the candidate is still a wrapper encoding. Malformed decoding still returns no target.

- [ ] **Step 4: Verify GREEN**

Run the same one-file command. Expected: all URL tests pass.

### Task 5: Complete unresolved search-engine path coverage

**Files:**
- Modify: `lib/search-result-url.ts`
- Modify: `tests/search-result-url.test.ts`

**Interfaces:**
- Refines: internal `isSearchEnginePage(url: URL): boolean`

- [ ] **Step 1: Write exact failing rejection cases**

```ts
const unresolved = [
  "https://www.google.com/webhp",
  "https://www.google.co.uk/advanced_search",
  "https://www.bing.com/images/search?q=story",
  "https://cn.bing.com/videos/search?q=story",
  "https://tw.search.yahoo.com/",
  "https://images.search.yahoo.com/search/images?p=story",
];
for (const url of unresolved) {
  expect(normalizeSearchResultUrl(url)).toBeUndefined();
}
expect(normalizeSearchResultUrl("https://news.yahoo.com/story/123")).toBe(
  "https://news.yahoo.com/story/123",
);
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/search-result-url.test.ts`

Expected: the newly listed engine paths/hosts survive before the guard is expanded.

- [ ] **Step 3: Expand host/path predicates**

Add `/webhp` and `/advanced_search` to Google search paths, `/images/search` and `/videos/search` to Bing search paths, and treat hosts equal to or ending in `.search.yahoo.com` as unresolved search hosts. Keep `news.yahoo.com` and ordinary non-engine targets valid.

- [ ] **Step 4: Verify GREEN**

Run the same one-file command. Expected: exact engine cases reject and content controls pass.

### Task 6: Require an explicit collaborative edit relation

**Files:**
- Modify: `lib/web-text-quality.ts`
- Modify: `tests/web-text-quality.test.ts`
- Verify: `tests/evidence-quality.test.ts`

**Interfaces:**
- Refines: `looksLikeBrowserEditShell(value: string): boolean`

- [ ] **Step 1: Write exact clean false-positive controls**

```ts
expect(
  looksLikeBrowserEditShell(
    "欢迎阅读本页面的剧情分析，本文将帮助你理解角色的成长。",
  ),
).toBe(false);
expect(
  looksLikeBrowserEditShell(
    "Welcome to this page. This article will help readers understand the character arc.",
  ),
).toBe(false);
```

Retain the exact live fixture assertion as true and assert both clean controls remain usable.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/web-text-quality.test.ts tests/evidence-quality.test.ts`

Expected: both clean controls are currently classified as edit shells.

- [ ] **Step 3: Implement bounded ordered edit relations**

Use explicit ordered relations rather than independent token presence:

```ts
const chineseCollaborativeEdit =
  /(?:协助|帮助)[\s\S]{0,30}编辑[\s\S]{0,20}(?:条目|页面|词条)/u.test(text);
const englishCollaborativeEdit =
  /(?:assist|help)[\s\S]{0,40}edit[\s\S]{0,20}(?:entry|page)/iu.test(text);
```

Combine either relation with the existing welcome/read context. Keep the independent JavaScript/browser-settings pair unchanged.

- [ ] **Step 4: Run final verification and commit**

Run focused URL/text/evidence/external/generation tests, expanded pipeline tests, `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check`. Commit production and tests with `fix: close citation boundary review gaps`, then append counts and self-review to the ignored live-fix report.

---

## Definitive Live Evidence Follow-up

### Task 7: Balance character-arc first-tier query buckets

**Files:**
- Modify: `lib/external-search.ts`
- Modify: `tests/external-search.test.ts`
- Modify: `tests/chat-stream.test.ts`
- Modify: `tests/generation.test.ts`

**Interfaces:**
- Produces: a first-tier bucket selector for `character_arc`
- Consumes: `{ query: string; citations: Citation[] }[]`, original question, and the existing three-query plan
- Returns: at most 16 citations with unique canonical URLs

- [ ] **Step 1: Write failing deterministic tests**

Mock 14 shallow candidates for the original question and stage-bearing sources for `婕德 剧情 经历` and `婕德 结局 变化`. Include title variants sharing one canonical URL across buckets. For both exact phrasings assert:

```ts
expect(uniqueQueries).toEqual([question, "婕德 剧情 经历", "婕德 结局 变化"]);
expect(results.map((item) => new URL(item.url).toString())).toHaveLength(
  new Set(results.map((item) => new URL(item.url).toString())).size,
);
expect(results.some((item) => item.url.includes("arc-start"))).toBe(true);
expect(results.some((item) => item.url.includes("arc-end"))).toBe(true);
```

Route and generation regressions must return the four stage-bearing paragraphs and must not return the safe-boundary sentence.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/external-search.test.ts tests/generation.test.ts tests/chat-stream.test.ts`

Expected: shallow original results consume the 16-candidate assessment budget, mandatory stage sources disappear, canonical title variants survive, or route/generation falls back.

- [ ] **Step 3: Implement bucket-aware selection**

Change first-tier collection to retain query buckets. Canonicalize URL without title and dedupe each bucket using `webTextQualityScore(title + excerpt)`. Across buckets choose the mandatory-query occurrence before the original occurrence, then higher text quality, then stable bucket/item order.

Select original bucket `slice(0, 4)`, each mandatory bucket `slice(0, 6)`, then fill remaining global capacity from mandatory leftovers only. Pass this at-most-16 canonical-unique set into the existing assessment, enrichment, and ranking path. Other intents/scopes keep the existing flattening behavior.

- [ ] **Step 4: Verify GREEN**

Run the same three-file command. Expected: exact three queries, mandatory subset, canonical uniqueness, and answered four-stage route/generation all pass.

### Task 8: Reject short raw dialogue only for story evidence

**Files:**
- Modify: `lib/web-text-quality.ts`
- Modify: `lib/evidence-quality.ts`
- Modify: `tests/web-text-quality.test.ts`
- Modify: `tests/evidence-quality.test.ts`
- Modify: `tests/generation.test.ts`

**Interfaces:**
- Produces: `looksLikeShortRawDialogue(excerpt: string): boolean`
- Consumed by: story-only evidence filtering using `citation.excerpt`

- [ ] **Step 1: Write failing tests**

```ts
expect(looksLikeShortRawDialogue("派蒙:想念婕德和奔奔了... 冻梨:你还别说...")).toBe(true);
expect(looksLikeShortRawDialogue("派蒙：想念婕德和奔奔了……冻梨：你还别说……")).toBe(true);
expect(looksLikeShortRawDialogue("她想起那天说：我们还会再见。随后独自离开。")).toBe(false);
```

Evidence selection rejects both two-turn fixtures for story, allows them for relationship, and allows narrative with one quote. A cold generation fallback containing only the two-turn transcript returns empty external and cited IDs.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/web-text-quality.test.ts tests/evidence-quality.test.ts tests/generation.test.ts`

Expected: missing detector and retained story transcript fail.

- [ ] **Step 3: Implement minimal shape detection**

Require a speaker label at the start and count at least two label matches separated by whitespace or sentence/ellipsis punctuation. In `isUnusableWebEvidence`, call it only when `intent === "story"` and pass only `citation.excerpt`; retain the existing full-text long-dialogue guard.

- [ ] **Step 4: Verify GREEN**

Run the same three-file command. Expected: story rejects, relationship/narrative controls pass, generation IDs are empty.

### Task 9: Reject shared site-description shells

**Files:**
- Modify: `lib/web-text-quality.ts`
- Modify: `tests/web-text-quality.test.ts`
- Modify: `tests/evidence-quality.test.ts`

**Interfaces:**
- Produces: `looksLikeSiteDescriptionShell(value: string): boolean`
- Consumed by: `isUnusableWebText` and all downstream evidence consumers

- [ ] **Step 1: Write failing exact-shape and clean-control tests**

Reject:

```ts
"米游社-原神社区是米哈游旗下官方社区，提供游戏资讯、攻略、角色图鉴、活动内容与玩家交流。"
"星港论坛是由北辰互动运营的官方社区平台，提供新闻、攻略、图鉴与活动内容。"
"Starlight Hub is an official community operated by Northwind Media, offering news, guides, a catalog, and events."
```

Allow `社区分析认为，她仍在学习如何为自己做决定。` and `她加入的社区由居民共同运营，后来成为她短暂的归属。`. Evidence selection must remove the shell and retain a clean story citation.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/web-text-quality.test.ts tests/evidence-quality.test.ts`.

Expected: shell fixtures remain usable before the shared detector exists.

- [ ] **Step 3: Implement the source-neutral first-220-character detector**

Require all three gates: site identity noun; copular, ownership, or operation relation; and either explicit official-site identity or at least two distinct catalog/promotional terms. Support Chinese and English generic vocabulary only. Add it to `isUnusableWebText` before dialogue handling.

- [ ] **Step 4: Verify, commit, and report**

Run focused evidence/search/generation/route tests, expanded pipeline tests, `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check`. Commit implementation and tests with `fix: balance definitive character arc evidence`. Append RED/GREEN counts, final verification, commits, file list, self-review, and concerns to `.superpowers/sdd/character-arc-live-fix-report.md`.

### Task 10: Rank and filter complete query buckets before quota allocation

**Files:**
- Modify: `lib/external-search.ts`
- Modify: `tests/external-search.test.ts`

**Interfaces:**
- Consumes: `dedupeAndRank(citations, plan, question)` and `webTextQualityScore(title + excerpt)`
- Produces: `balanceCharacterArcCandidateBuckets(buckets, plan, question, limit?)`

- [ ] **Step 1: Write the failing pre-quota regression**

For each of `婕德经历了怎样的变化？` and `婕德经历了怎么的变化？`, give the raw bucket a distinct shallow candidate set. Give each mandatory bucket six leading candidates that are irrelevant, site-shell, browser-shell, or transcript noise, followed by a seventh clean candidate with decisive beginning or ending arc evidence. Assert that both clean candidates survive, all selected text has a finite shared text-quality score, raw results remain capped at four, canonical URLs are unique, and the result remains within sixteen.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/external-search.test.ts`

Expected: the seventh clean mandatory candidates are absent because provider insertion order consumes each six-slot reservation first.

- [ ] **Step 3: Move existing ranking and unusable filtering before quotas**

Change `balanceCharacterArcCandidateBuckets` to accept `plan` and `question`. For every complete bucket, first remove candidates whose `citationTextQuality` is `Number.NEGATIVE_INFINITY`, then call `dedupeAndRank(candidates, plan, question)`. Perform canonical cross-bucket winner selection and the existing 4/6/6 quota allocation only on those ranked finite candidates. Update `searchWebEvidence` and direct tests to pass the same normalized plan and user question. Do not add calls or alter the three query strings.

- [ ] **Step 4: Verify GREEN and existing route behavior**

Run: `npm test -- tests/external-search.test.ts tests/chat-stream.test.ts tests/generation.test.ts`

Expected: the new regression passes for both phrasings; exact three-query and four cited-stage route/generation tests remain green.

- [ ] **Step 5: Run final verification, commit, and append report**

Run `git diff --check`, the five-file focused suite, `npm test`, `npm run typecheck`, and `npm run build`. Verify PID 34240 remains alive. Commit only `lib/external-search.ts` and `tests/external-search.test.ts`, then append the P1 RED/GREEN evidence and final verification to the ignored live-fix report.

### Task 11: Prioritize arc context inside mandatory buckets

**Files:**
- Modify: `lib/external-search.ts`
- Modify: `tests/external-search.test.ts`

**Interfaces:**
- Consumes: finite, canonical-unique results already ordered by `dedupeAndRank`
- Produces: mandatory-bucket-only stable ordering by `characterArcRelevanceScore(citation, bucket.query, plan)`

- [ ] **Step 1: Write the failing finite-profile regression**

For each accepted phrasing, build a distinct raw bucket and a mandatory bucket whose first six candidates are finite curated-Wiki entity-title profile snippets such as `婕德人物资料与基础档案`. Put a finite community/web citation seventh with decisive loss, betrayal, realization, break, and self-determination evidence. Assert that the seventh citation survives the mandatory six-slot quota, while raw cap, canonical uniqueness, and total-sixteen invariants remain unchanged.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/external-search.test.ts`

Expected: two failures because curated-Wiki governance ranks all six shallow profiles ahead of the community/web arc citation.

- [ ] **Step 3: Implement mandatory-only stable arc ordering**

Add `characterArcRelevanceScore` using only generic Chinese and English vocabulary. Award matches for non-entity mandatory query terms and story-changing actions or turning points such as loss, belonging, joining/leaving, manipulation, betrayal, realization, decision, break, growth/change, and independent choice. After each bucket's existing `dedupeAndRank`, stable-sort only buckets with index greater than zero by descending arc score; preserve the existing ranked order for ties and preserve the raw bucket unchanged.

- [ ] **Step 4: Verify GREEN and unchanged route behavior**

Run: `npm test -- tests/external-search.test.ts tests/chat-stream.test.ts tests/generation.test.ts`

Expected: both new regressions pass and the exact-query/four-stage route/generation tests remain green.

- [ ] **Step 5: Complete and report**

Run the five-file focused suite, `npm test`, `npm run typecheck`, `npm run build`, and diff checks. Verify PID 34240. Commit only production and regression files, then append RED/GREEN counts, final commands, commit hashes, self-review, and concerns to the ignored live-fix report.

### Task 12: Reject promotional and engagement-listing shells

**Files:**
- Modify: `lib/web-text-quality.ts`
- Modify: `tests/web-text-quality.test.ts`
- Modify: `tests/evidence-quality.test.ts`
- Modify: `tests/generation.test.ts`

**Interfaces:**
- Produces: `looksLikePromotionalListingShell(value: string): boolean`
- Consumed by: `isUnusableWebText`, `webTextQualityScore`, evidence selection, and generation

- [ ] **Step 1: Write exact failing tests**

Use the exact delivery fixture beginning `更多原神实用攻略教学...热门原神游戏视频7*24小时持续更新...视频播放量 241、弹幕量 0、点赞数 6、投硬币枚数 0`. Add an invented-platform Chinese or English equivalent containing continuous availability plus promotional language and at least three generic engagement labels. Assert detector true, shared unusable true, and score negative infinity.

Add narrative controls containing only one legitimate play, view, like, or comment mention and assert detector false and shared text usable. Evidence selection must remove the exact shell while keeping a clean character-arc citation. A cold generation input containing the live-shaped shell must return no shell external citations, cited IDs, or paragraph citation IDs.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/web-text-quality.test.ts tests/evidence-quality.test.ts tests/generation.test.ts`

Expected: missing detector and retained shell failures.

- [ ] **Step 3: Implement the generic conjunction detector**

Normalize the input with NFKC. Detect continuous availability such as `7*24小时` together with at least one promotional term (`更多`, `热门`, `持续更新`, `尽在`, or generic English equivalents). Independently count distinct metric categories for views/play count, bullet comments/danmaku, likes, coins/tips, favorites/bookmarks, shares, and comments; reject at three or more categories. Do not include source, platform, publisher, game, or character names. Add the detector to `isUnusableWebText` before dialogue handling.

- [ ] **Step 4: Verify GREEN and retained safeguards**

Run the same three-file command, then the five-file character-arc focused suite. Expected: shell paths are removed, clean controls remain, and all prior balancing, route, and generation safeguards stay green.

- [ ] **Step 5: Complete and report**

Run `npm test`, `npm run typecheck`, `npm run build`, and diff checks; verify PID 34240. Commit the four scoped files and append RED/GREEN counts, final commands, commit hashes, self-review, and concerns to the ignored live-fix report.

### Task 13: Bypass model understanding for complete character-arc rules

**Files:**
- Modify: `lib/question-understanding.ts`
- Modify: `tests/question-understanding.test.ts`

- [ ] Add an `it.each` regression for both accepted phrasings with model understanding enabled and a global fetch spy; call `understandQuestion` and assert canonical `婕德`, `story`, exact mandatory queries, and zero fetch calls.
- [ ] Run `npm test -- tests/question-understanding.test.ts`; expect two failures because alias-empty story rules currently request the model.
- [ ] Add a complete-character-arc rule predicate and return false in `shouldUseModelQuestionUnderstanding` before the alias-empty story branch.
- [ ] Re-run the focused file and expect all tests pass.

### Task 14: Pin character-arc reconciliation and sanitize enrichment

**Files:**
- Modify: `lib/question-understanding.ts`
- Modify: `tests/question-understanding.test.ts`

- [ ] Add the exact reviewer regression: model entity canonical `婕德经历了`, aliases including `婕德`, `Jeht`, and another predicate-tailed term; model intent `identity`; identity queries. Assert rule canonical `婕德`, intent `story`, mandatory queries, `storyScope=character_arc`, no predicate-tailed alias/query, and retained clean `Jeht` alias.
- [ ] Verify RED in `tests/question-understanding.test.ts`.
- [ ] Add a character-arc reconciliation branch that pins rule canonical/entities and intent, accepts only safe aliases from overlapping model entities, rejects arc-predicate-tailed entity terms, accepts model queries only for model `story` intent and entity-anchored arc/story shape, preserves mandatory rule queries, and ignores model claim.
- [ ] Verify GREEN and preserve the existing clean-English-alias enrichment test.

### Task 15: Require count-shaped metric labels

**Files:**
- Modify: `lib/web-text-quality.ts`
- Modify: `tests/web-text-quality.test.ts`

- [ ] Add exact clean narrative `这篇剧情分析分享了角色的成长，读者评论了关键转折，也有人收藏这段故事。`; assert promotional detector false and shared text usable. Keep exact live count-shaped shell rejection.
- [ ] Verify RED in `tests/web-text-quality.test.ts` because three bare metric words currently meet the threshold.
- [ ] Replace bare metric patterns with explicit count/amount labels, numeric label-value syntax, or equivalent English count labels/values; keep distinct-category counting and the availability-plus-promotion branch.
- [ ] Verify GREEN.

### Task 16: Preserve path and query case in citation canonicalization

**Files:**
- Modify: `lib/external-search.ts`
- Modify: `tests/external-search.test.ts`

- [ ] Add two otherwise equivalent relevant citations whose URLs differ only by case-sensitive path/video ID and query value; assert both survive balancing/deduplication while host-case variants still dedupe.
- [ ] Verify RED in `tests/external-search.test.ts` because the whole URL is currently lowercased.
- [ ] Remove whole-string lowercasing from `canonicalCitationUrl`; normalize scheme and host only, preserve path/query case, and retain fragment/root-slash behavior.
- [ ] Verify GREEN.

### Task 17: Whole-branch verification and delivery

- [ ] Run focused question-understanding, external-search, web-text-quality, evidence, generation, and chat-stream suites.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, `git diff --check`, and staged diff checks; verify PID 34240.
- [ ] Commit scoped production/tests and append exact RED/GREEN counts, final commands, commits, self-review, and concerns to the ignored live-fix report.
