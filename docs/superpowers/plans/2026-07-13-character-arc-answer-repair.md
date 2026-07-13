# Character Arc Answer Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make character-change questions produce coherent, cited Chinese summaries without misidentifying the character or leaking duplicated site chrome, raw HTML entities, and dialogue dumps.

**Architecture:** Add a reusable character-arc question pattern at the entity/understanding boundary, then centralize HTML decoding and page-noise scoring in a dependency-free web-text utility. Evidence selection, page enrichment, answer validation, and deterministic fallback will consume those shared signals so dirty text is stopped before generation and cannot leak when the model fails.

**Tech Stack:** TypeScript 5.7, Next.js 16, Vitest 3, existing `Citation`, `QuestionUnderstanding`, and grounded-generation modules.

## Global Constraints

- Do not hard-code a one-off answer for Jeht; fix the general evidence/answer path exposed by this query.
- Chinese answers must use coherent Chinese evidence and must not expose duplicated site chrome, raw HTML entities, or uncontextualized dialogue dumps.
- Preserve existing entity, citation, spoiler, language, source-authority, and latency safeguards.
- Preserve the completed clue-heading layout fix already present on the current branch.
- Do not add a runtime dependency for HTML decoding or text scoring.

---

## File Structure

- Create `lib/web-text-quality.ts`: dependency-free named/numeric HTML entity decoding, repeated-site detection, navigation/dialogue noise detection, and deterministic text quality comparison.
- Create `tests/web-text-quality.test.ts`: pure regression tests for entity decoding, repeated site chrome, navigation density, dialogue dumps, and excerpt preference.
- Modify `lib/entity-lexicon.ts`: extract the subject from general character-change sentence shapes before the broad predicate matcher runs.
- Modify `lib/question-understanding.ts`: classify character-change questions as story intent and add entity-anchored arc queries.
- Modify `lib/evidence-quality.ts`: reuse shared cleaning and reject unusable story evidence before generation.
- Modify `lib/external-search.ts`: reuse shared entity decoding and only replace a search snippet with a higher-quality fetched-page excerpt.
- Modify `lib/answer-quality.ts`: flag shared web-noise patterns in generated answer text.
- Modify `lib/answer-prompt.ts`: require start-to-turning-point-to-end-state structure for character-change questions.
- Modify `lib/generation.ts`: prevent external excerpt concatenation for open-ended story/character-arc failure paths.
- Modify `tests/entity-lexicon.test.ts`, `tests/question-understanding.test.ts`, `tests/evidence-quality.test.ts`, `tests/external-search.test.ts`, `tests/answer-quality.test.ts`, `tests/answer-prompt.test.ts`, and `tests/generation.test.ts`: cover each repaired boundary and the user-visible regression.

---

### Task 1: Recognize Character-Arc Questions and Anchor Searches

**Files:**
- Modify: `lib/entity-lexicon.ts:72-145`
- Modify: `lib/question-understanding.ts:71-120`
- Test: `tests/entity-lexicon.test.ts`
- Test: `tests/question-understanding.test.ts`

**Interfaces:**
- Produces: `isCharacterArcQuestion(question: string): boolean` from `lib/entity-lexicon.ts`.
- Produces: `detectQuestionEntities(question)` returning `{ canonical: "婕德", aliases: [], kind: "character" }` for both typo and standard character-change phrasings.
- Produces: `ruleUnderstandQuestion(question, language)` with `intent: "story"` and entity-anchored arc queries.
- Consumes: existing `QuestionEntity`, `SearchIntent`, `uniqueStrings`, and `queriesForEntities` behavior.

- [ ] **Step 1: Write failing entity extraction tests**

Append to `tests/entity-lexicon.test.ts`:

```ts
it.each([
  "婕德经历了怎么的变化？",
  "婕德经历了怎样的变化？",
  "婕德有什么成长？",
  "婕德是如何转变的？",
])("extracts only the character from a character-arc question: %s", (question) => {
  expect(detectQuestionEntities(question)).toEqual([
    { canonical: "婕德", aliases: [], kind: "character" },
  ]);
});
```

- [ ] **Step 2: Run the entity tests and confirm the current typo capture**

Run: `npm test -- tests/entity-lexicon.test.ts`

Expected: FAIL because the first question currently returns canonical `婕德经历了`, while other arc shapes are missing or incorrectly inferred.

- [ ] **Step 3: Add the reusable character-arc matcher before the broad predicate matcher**

Add to `lib/entity-lexicon.ts`:

```ts
const characterArcPattern =
  /^(.{1,12}?)(?:(?:经历了|发生了)(?:怎样|怎么|什么|哪些|何种)?的?(?:变化|成长|转变)|有(?:什么|哪些|怎样|怎么|何种)?的?(?:变化|成长|转变)|是如何(?:变化|成长|转变)(?:的)?)/u;

export function isCharacterArcQuestion(question: string) {
  return characterArcPattern.test(question.normalize("NFKC").replace(/\s+/gu, " ").trim());
}
```

In `inferQuestionEntities`, run the same pattern before `predicateMatch`, push capture group 1, and prevent the broad predicate branch from adding a second candidate:

```ts
const characterArcMatch = normalizedQuestion.match(characterArcPattern);
if (characterArcMatch) {
  pushCandidate(candidates, characterArcMatch[1] ?? "", { allowShort: true });
}

const predicateMatch = normalizedQuestion.match(
  /^(.{2,18}?)(?:是(?:不是)?|是不是|是谁|为什么|为何|怎么|如何|传说任务|故事|背景|身份|设定|死在|死亡|讲了什么|讲什么|说了什么)/u,
);
if (!hasRelationshipCandidates && !characterArcMatch && predicateMatch) {
  pushCandidate(candidates, predicateMatch[1] ?? "");
}
```

- [ ] **Step 4: Write failing intent and query tests**

Append to `tests/question-understanding.test.ts`:

```ts
it.each([
  "婕德经历了怎么的变化？",
  "婕德经历了怎样的变化？",
])("treats a character-arc question as story intent with arc queries: %s", (question) => {
  const result = ruleUnderstandQuestion(question, "zh-CN");

  expect(result.entities.map((entity) => entity.canonical)).toEqual(["婕德"]);
  expect(result.intent).toBe("story");
  expect(result.queries).toEqual(
    expect.arrayContaining(["婕德 剧情 经历", "婕德 结局 变化"]),
  );
  expect(result.queries.every((query) => query.includes("婕德"))).toBe(true);
});
```

- [ ] **Step 5: Run the understanding test and verify it fails on intent/query coverage**

Run: `npm test -- tests/question-understanding.test.ts`

Expected: FAIL because character-change vocabulary is not classified as `story` and the current query builder only repeats the raw question.

- [ ] **Step 6: Classify and plan character-arc searches**

Import `isCharacterArcQuestion` in `lib/question-understanding.ts`, update `inferIntent`, and pass intent into the query builder:

```ts
import {
  detectQuestionEntities,
  isCharacterArcQuestion,
  type QuestionEntity,
} from "@/lib/entity-lexicon";

function inferIntent(question: string, classification: EventClassification): SearchIntent {
  if (/关系|联系|relationship|connection/iu.test(question)) return "relationship";
  if (
    isCharacterArcQuestion(question) ||
    /传说任务|剧情|故事|story|quest|发生了什么|为什么.*(?:死|死亡|牺牲|离开)|死在|被.*杀|结局/iu.test(question)
  ) {
    return "story";
  }
  if (/pv|演示|预告|official media|teaser|trailer/iu.test(question)) {
    return "official_media";
  }
  if (/是谁|身份|是什么人|是(?:不是)?/u.test(question)) return "identity";
  if (classification.questionCategory === "character") return "current_status";
  return "general";
}

function queriesForEntities(
  question: string,
  entities: QuestionEntity[],
  intent: SearchIntent,
) {
  if (!entities.length) return [question];
  if (entities.length >= 2) {
    return [`${entities.map((entity) => entity.canonical).join(" ")} 关系`, question];
  }
  const entity = entities[0]!;
  if (intent === "story" && isCharacterArcQuestion(question)) {
    return uniqueStrings(
      [question, `${entity.canonical} 剧情 经历`, `${entity.canonical} 结局 变化`],
      4,
    );
  }
  return uniqueStrings(
    [
      question.includes(entity.canonical) ? question : `${entity.canonical} ${question}`,
      ...entity.aliases.map((alias) => `${alias} ${question}`),
    ],
    4,
  );
}
```

Update all `queriesForEntities` call sites to pass the resolved intent. In conflict reconciliation, pass `rule.intent` because the rule entity remains authoritative.

- [ ] **Step 7: Run both focused suites**

Run: `npm test -- tests/entity-lexicon.test.ts tests/question-understanding.test.ts`

Expected: both files PASS; the typo and standard forms produce the same entity, story intent, and anchored searches.

- [ ] **Step 8: Commit the question-understanding repair**

```powershell
git add lib/entity-lexicon.ts lib/question-understanding.ts tests/entity-lexicon.test.ts tests/question-understanding.test.ts
git commit -m "fix: recognize character arc questions"
```

---

### Task 2: Centralize Web Text Cleaning and Quality Signals

**Files:**
- Create: `lib/web-text-quality.ts`
- Create: `tests/web-text-quality.test.ts`

**Interfaces:**
- Produces: `decodeHtmlEntities(value: string): string`.
- Produces: `cleanWebText(value: string): string`.
- Produces: `hasRepeatedSiteChrome(value: string): boolean`.
- Produces: `isNavigationHeavy(value: string): boolean`.
- Produces: `looksLikeDialogueDump(value: string): boolean`.
- Produces: `containsUnrenderedHtmlEntity(value: string): boolean`.
- Produces: `webTextQualityScore(value: string): number` and `preferHigherQualityWebText(original: string, candidate: string): string`.
- Consumes: no project modules, preventing an `external-search` ↔ `evidence-quality` import cycle.

- [ ] **Step 1: Write failing pure text-quality tests**

Create `tests/web-text-quality.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  cleanWebText,
  containsUnrenderedHtmlEntity,
  hasRepeatedSiteChrome,
  isNavigationHeavy,
  looksLikeDialogueDump,
  preferHigherQualityWebText,
} from "@/lib/web-text-quality";

describe("web text quality", () => {
  it("decodes named and numeric HTML entities", () => {
    expect(cleanWebText("婕德&amp;旅行者&hellip;&#x4E00;&#20108;"))
      .toBe("婕德&旅行者…一二");
    expect(containsUnrenderedHtmlEntity("婕德&hellip;")).toBe(true);
    expect(containsUnrenderedHtmlEntity(cleanWebText("婕德&hellip;"))).toBe(false);
  });

  it("detects adjacent repeated site chrome", () => {
    const text =
      "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki";
    expect(hasRepeatedSiteChrome(text)).toBe(true);
  });

  it("detects navigation-heavy page text", () => {
    expect(
      isNavigationHeavy(
        "Created with Sketch 首页 新闻 公告 攻略 图鉴 角色 武器 圣遗物 社区 编辑 历史",
      ),
    ).toBe(true);
  });

  it("detects an uncontextualized speaker-label dialogue dump", () => {
    expect(
      looksLikeDialogueDump(
        "婕德：那个家伙让我不爽。婕德：现在安静了。婕德：她会孤独吗？婕德：真可惜。",
      ),
    ).toBe(true);
  });

  it("keeps a clean search snippet instead of a noisy fetched page excerpt", () => {
    const original = "婕德发现芭别尔的陷害后与塔尼特决裂，并决定选择自己的道路。";
    const page =
      "Created with Sketch 首页 新闻 公告 攻略 图鉴 角色 武器 圣遗物 社区 编辑 " +
      "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki";
    expect(preferHigherQualityWebText(original, page)).toBe(original);
  });
});
```

- [ ] **Step 2: Run the new test and verify the module is missing**

Run: `npm test -- tests/web-text-quality.test.ts`

Expected: FAIL with module resolution error for `@/lib/web-text-quality`.

- [ ] **Step 3: Implement deterministic decoding and noise detection**

Create `lib/web-text-quality.ts` with these public functions and private helpers:

```ts
const namedEntities: Record<string, string> = {
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  hellip: "…",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&([a-z]+);/giu, (entity, name: string) =>
      Object.prototype.hasOwnProperty.call(namedEntities, name.toLowerCase())
        ? namedEntities[name.toLowerCase()]!
        : entity,
    )
    .replace(/&#x([0-9a-f]+);/giu, (entity, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    })
    .replace(/&#(\d+);/gu, (entity, code: string) => {
      const point = Number.parseInt(code, 10);
      return Number.isFinite(point) && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    });
}

export function containsUnrenderedHtmlEntity(value: string) {
  return /&(?:[a-z][a-z0-9]+|#x[0-9a-f]+|#\d+);/iu.test(value);
}

function compactForComparison(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
}

export function hasRepeatedSiteChrome(value: string) {
  const compact = compactForComparison(value);
  const siteSignal = /wiki|平台|官网|观测枢|数据库|database|navigation/iu;
  for (let size = Math.min(80, Math.floor(compact.length / 2)); size >= 6; size -= 1) {
    for (let start = 0; start + size * 2 <= compact.length; start += 1) {
      const segment = compact.slice(start, start + size);
      if (siteSignal.test(segment) && segment === compact.slice(start + size, start + size * 2)) {
        return true;
      }
    }
  }
  return false;
}

export function isNavigationHeavy(value: string) {
  const text = value.normalize("NFKC");
  const tokens = text.match(
    /Created with Sketch|首页|新闻|公告|攻略|图鉴|角色|武器|圣遗物|社区|编辑|历史|Toggle|Contents?|Navigation|Gallery|Change History/giu,
  ) ?? [];
  return /Created with Sketch/iu.test(text) || new Set(tokens.map((token) => token.toLowerCase())).size >= 6;
}

export function looksLikeDialogueDump(value: string) {
  const labels = value.match(/(?:^|[。！？!?]\s*)([\p{L}\p{N}·]{1,16})\s*[:：]/gu) ?? [];
  return labels.length >= 3;
}

export function cleanWebText(value: string) {
  return decodeHtmlEntities(value)
    .normalize("NFKC")
    .replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060\ufeff]/gu, "")
    .replace(/\[(?:\d{1,3}|编辑|edit)\]/giu, "")
    .replace(/\bToggle\b(?:\s+\w+){0,3}/giu, "")
    .replace(/\bContents?\b(?:\s+\d+(?:\.\d+)*)*/giu, "")
    .replace(/\bGallery\b|\bChange History\b|\bReferences\b|\bNavigation\b/giu, "")
    .replace(/\s+/gu, " ")
    .replace(/^[。；，、,.!?：:\s]+/u, "")
    .trim();
}

export function webTextQualityScore(value: string) {
  const clean = cleanWebText(value);
  let score = Math.min(clean.length, 700);
  if (containsUnrenderedHtmlEntity(value)) score -= 180;
  if (hasRepeatedSiteChrome(value)) score -= 320;
  if (isNavigationHeavy(value)) score -= 320;
  if (looksLikeDialogueDump(value)) score -= 100;
  return score;
}

export function preferHigherQualityWebText(original: string, candidate: string) {
  if (!candidate.trim()) return original;
  return webTextQualityScore(candidate) > webTextQualityScore(original)
    ? candidate
    : original;
}
```

- [ ] **Step 4: Run the pure quality suite**

Run: `npm test -- tests/web-text-quality.test.ts`

Expected: PASS for entity decoding, repeated site detection, navigation/dialogue detection, and snippet preference.

- [ ] **Step 5: Commit the shared utility**

```powershell
git add lib/web-text-quality.ts tests/web-text-quality.test.ts
git commit -m "feat: add shared web text quality checks"
```

---

### Task 3: Reject Dirty Evidence and Prevent Noisy Page Enrichment

**Files:**
- Modify: `lib/evidence-quality.ts:1-140`
- Modify: `lib/external-search.ts:264-285,1307-1394`
- Test: `tests/evidence-quality.test.ts`
- Test: `tests/external-search.test.ts`

**Interfaces:**
- Consumes: `cleanWebText`, `hasRepeatedSiteChrome`, `isNavigationHeavy`, `looksLikeDialogueDump`, and `preferHigherQualityWebText` from Task 2.
- Preserves: `cleanEvidenceText(value)`, `selectAnswerEvidence(citations, input)`, `searchGeneralWeb`, and `searchWebEvidence` public signatures.
- Produces: clean evidence excerpts with stable citation re-numbering.

- [ ] **Step 1: Write failing evidence filtering tests using the reported payload**

Append to `tests/evidence-quality.test.ts`:

```ts
it("decodes HTML entities before evidence reaches generation", () => {
  expect(cleanEvidenceText("婕德：她会孤独吗&hellip;"))
    .toBe("婕德:她会孤独吗…");
});

it("rejects duplicated site chrome for a character-arc answer", () => {
  const selected = selectAnswerEvidence(
    [
      citation(
        "chrome",
        "旅行者创作平台-观测枢-原神wiki",
        "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki",
      ),
      citation(
        "arc",
        "因为她的罪恶滔天…",
        "婕德发现芭别尔的陷害后与塔尼特决裂，并决定选择自己的道路。",
      ),
    ],
    { question: "婕德经历了怎么的变化？", intent: "story", language: "zh-CN" },
  );

  expect(selected).toHaveLength(1);
  expect(selected[0]?.title).toBe("因为她的罪恶滔天…");
});

it("rejects a standalone dialogue dump for a character-arc answer", () => {
  const selected = selectAnswerEvidence(
    [
      citation(
        "dialogue",
        "婕德对话",
        "婕德：那个家伙让我不爽。婕德：现在安静了。婕德：她会孤独吗？婕德：真可惜。",
      ),
    ],
    { question: "婕德经历了怎样的变化？", intent: "story", language: "zh-CN" },
  );

  expect(selected).toEqual([]);
});
```

- [ ] **Step 2: Run evidence tests and verify the dirty citations survive today**

Run: `npm test -- tests/evidence-quality.test.ts`

Expected: FAIL because `&hellip;` remains encoded and both duplicated site chrome and dialogue dumps currently pass selection.

- [ ] **Step 3: Route evidence cleaning and story-quality gates through the shared utility**

In `lib/evidence-quality.ts`, import the Task 2 functions, replace the current cleaning chain, and add story-specific rejection:

```ts
import {
  cleanWebText,
  hasRepeatedSiteChrome,
  isNavigationHeavy,
  looksLikeDialogueDump,
} from "@/lib/web-text-quality";

export function cleanEvidenceText(value: string) {
  return cleanWebText(value);
}

function isUnusableWebEvidence(citation: Citation, intent: SearchIntent) {
  const text = `${citation.title} ${citation.excerpt}`;
  if (hasRepeatedSiteChrome(text) || isNavigationHeavy(text)) return true;
  if (intent === "story" && looksLikeDialogueDump(citation.excerpt)) return true;
  return false;
}
```

Call `isUnusableWebEvidence(citation, input.intent)` immediately after the empty-text guard in `selectAnswerEvidence`.

- [ ] **Step 4: Write a failing page-enrichment preference test**

Add an enrichment case to `tests/external-search.test.ts` using the existing `searchGeneralWeb` fetch stub pattern. Return one clean DuckDuckGo result for `https://example.com/jeht-arc`, then return a fetched HTML page whose body is navigation-heavy and contains the duplicated Observation Hub label:

```ts
it("does not replace a clean search snippet with noisy fetched page chrome", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        return new Response(
          `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fjeht-arc">婕德剧情变化</a>
           <div class="result__snippet">婕德发现芭别尔的陷害后与塔尼特决裂，并选择自己的道路。</div>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.hostname === "example.com") {
        return new Response(
          `<html><body>Created with Sketch 首页 新闻 公告 攻略 图鉴 角色 武器 圣遗物 社区 编辑
           旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki</body></html>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }),
  );

  const results = await searchGeneralWeb("婕德 剧情 变化");

expect(results).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      url: "https://example.com/jeht-arc",
      excerpt: "婕德发现芭别尔的陷害后与塔尼特决裂，并选择自己的道路。",
    }),
  ]),
);
});
```

- [ ] **Step 5: Run the enrichment test and verify fetched chrome replaces the snippet**

Run: `npm test -- tests/external-search.test.ts`

Expected: FAIL because `enrichWebCitationUncached` currently accepts any non-empty focused page excerpt when relationship-signal checks do not block it.

- [ ] **Step 6: Reuse entity decoding and require a quality improvement before replacement**

In `lib/external-search.ts`, import `decodeHtmlEntities` and `preferHigherQualityWebText`. Replace the duplicated named/numeric decoder body:

```ts
function decodeHtml(value: string) {
  return decodeHtmlEntities(stripHtml(value));
}
```

In `enrichWebCitationUncached`, preserve the existing relationship signal condition but compare text quality inside it:

```ts
const relationshipSignalsPreserved =
  originalInteractionSignals === 0 ||
  pageInteractionSignals >= originalInteractionSignals;
const excerpt = relationshipSignalsPreserved
  ? preferHigherQualityWebText(citation.excerpt, pageExcerpt)
  : citation.excerpt;
```

- [ ] **Step 7: Run the focused evidence and search suites**

Run: `npm test -- tests/web-text-quality.test.ts tests/evidence-quality.test.ts tests/external-search.test.ts`

Expected: PASS; clean snippets survive enrichment, dirty citations do not enter answer evidence, and existing relationship evidence behavior remains green.

- [ ] **Step 8: Commit the evidence boundary repair**

```powershell
git add lib/evidence-quality.ts lib/external-search.ts tests/evidence-quality.test.ts tests/external-search.test.ts
git commit -m "fix: block noisy web evidence from answers"
```

---

### Task 4: Make Generated Answers and Cold Fallbacks Safe

**Files:**
- Modify: `lib/answer-quality.ts:68-170,192-270`
- Modify: `lib/answer-prompt.ts:4-38`
- Modify: `lib/evidence-quality.ts:142-157`
- Modify: `lib/generation.ts:192-275,851-940`
- Test: `tests/answer-quality.test.ts`
- Test: `tests/answer-prompt.test.ts`
- Test: `tests/evidence-quality.test.ts`
- Test: `tests/generation.test.ts`

**Interfaces:**
- Consumes: `containsUnrenderedHtmlEntity`, `hasRepeatedSiteChrome`, `isNavigationHeavy`, and `isCharacterArcQuestion`.
- Preserves: `AnswerQualityFailure` union and `validateAnswerQuality` signature; shared noise maps to existing failure `web_noise`.
- Preserves: identity/current-status deterministic fallback for clean evidence.
- Changes: story and character-arc requests with only external evidence return `safeBoundaryAnswer` if generation fails instead of concatenating excerpts.

- [ ] **Step 1: Write failing generated-text noise tests**

Append to `tests/answer-quality.test.ts`:

```ts
it.each([
  "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki",
  "婕德后来明白了真相&hellip;",
  "Created with Sketch 首页 新闻 公告 攻略 图鉴 角色 武器 圣遗物 社区",
])("rejects leaked web noise in generated text: %s", (text) => {
  const failures = validateAnswerQuality({
    paragraphs: [{ text, citationIds: [] }],
    language: "zh-CN",
    question: "婕德经历了怎样的变化？",
    allowedSourceIds: new Set(),
  });

  expect(failures).toContain("web_noise");
});
```

- [ ] **Step 2: Run answer-quality tests and verify shared noise is not recognized**

Run: `npm test -- tests/answer-quality.test.ts`

Expected: FAIL for repeated Chinese site chrome and raw `&hellip;`; the current validator only recognizes a short English navigation list.

- [ ] **Step 3: Extend answer validation with shared web-noise checks**

Import the Task 2 helpers in `lib/answer-quality.ts` and replace `containsWebNoise`:

```ts
import {
  containsUnrenderedHtmlEntity,
  hasRepeatedSiteChrome,
  isNavigationHeavy,
} from "@/lib/web-text-quality";

function containsWebNoise(value: string) {
  return (
    /\[(?:\d{1,3}|编辑|edit)\]|\bToggle\b|\bContents?\b|\bNavigation\b|\bChange History\b/iu.test(value) ||
    containsUnrenderedHtmlEntity(value) ||
    hasRepeatedSiteChrome(value) ||
    isNavigationHeavy(value)
  );
}
```

- [ ] **Step 4: Add a prompt regression for character-arc structure**

Append to `tests/answer-prompt.test.ts`:

```ts
it("asks character-change answers to explain an arc instead of copying dialogue", () => {
  const prompt = answerSystemPrompt("zh-CN", false);
  expect(prompt).toContain("initial state");
  expect(prompt).toContain("turning point");
  expect(prompt).toContain("end state");
  expect(prompt).toContain("Do not substitute a dialogue dump");
});
```

Add this rule to `answerSystemPrompt` in `lib/answer-prompt.ts`:

```ts
For a character change, growth, or transformation question, synthesize the arc as initial state, key experience, turning point, and end state. Do not substitute a dialogue dump for that synthesis, and do not invent a stage that the evidence does not support.
```

- [ ] **Step 5: Write the exact dirty cold-fallback regression**

Append to `tests/generation.test.ts`. Reuse the file's existing environment cleanup and `Citation` type:

```ts
it("does not echo dirty external excerpts when a character-arc model call fails cold", async () => {
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://api.example.test";
  delete process.env.https_proxy;
  delete process.env.HTTPS_PROXY;
  delete process.env.http_proxy;
  delete process.env.HTTP_PROXY;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("cold_start_timeout");
  }));

  const dirty: Citation = {
    id: "external-1",
    title: "旅行者创作平台-观测枢-原神wiki",
    url: "https://example.com/jeht",
    sourceName: "观测枢",
    sourceKind: "trusted_wiki",
    credibility: "trusted_wiki",
    factStatus: "trusted_secondary",
    excerpt:
      "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki；婕德：她会孤独吗&hellip;婕德：真可惜没能一起去&hellip;",
    external: true,
    crossLanguage: false,
  };

  const result = await generateGroundedResponse({
    question: "婕德经历了怎么的变化？",
    language: "zh-CN",
    profile: "returning",
    entries: [],
    external: [dirty],
    understanding: ruleUnderstandQuestion("婕德经历了怎么的变化？", "zh-CN"),
  });

  expect(result.answer).toBe(
    "目前找到的资料还不足以稳妥回答“婕德”这个问题。派蒙先不把外部片段硬拼成结论，相关原文保留在下方来源里。",
  );
  expect(result.answer).not.toContain("旅行者创作平台");
  expect(result.answer).not.toContain("&hellip;");
  expect(result.answerParagraphs.flatMap((paragraph) => paragraph.citationIds)).toEqual([]);
});
```

Update `safeBoundaryAnswer` in `lib/evidence-quality.ts` to use “外部片段” for Chinese evidence so the boundary copy accurately describes both Chinese and foreign external sources.

Add `safeBoundaryAnswer` to the import in `tests/evidence-quality.test.ts` and append:

```ts
it("describes a Chinese external-evidence boundary without calling it foreign", () => {
  expect(safeBoundaryAnswer("zh-CN", "婕德", true)).toBe(
    "目前找到的资料还不足以稳妥回答“婕德”这个问题。派蒙先不把外部片段硬拼成结论，相关原文保留在下方来源里。",
  );
});
```

Add this import to `tests/generation.test.ts` before using prepared understanding:

```ts
import { ruleUnderstandQuestion } from "@/lib/question-understanding";
```

- [ ] **Step 6: Run the generation regression and confirm the raw fallback leak**

Run: `npm test -- tests/generation.test.ts -t "does not echo dirty external excerpts"`

Expected: FAIL because `coldSafeDeterministicAnswer` calls `directExternalEvidenceAnswer` whenever `external.length > 0`.

- [ ] **Step 7: Gate open-ended story fallback before direct excerpt concatenation**

Import `isCharacterArcQuestion` in `lib/generation.ts`. In `coldSafeDeterministicAnswer`, handle story-like questions before `directExternalEvidenceAnswer`:

```ts
const subject = detectQuestionEntities(input.question)[0]?.canonical;
const openEndedStoryQuestion =
  Boolean(input.deepStory) ||
  isCharacterArcQuestion(input.question) ||
  /传说任务|剧情|故事|梗概|概述|结局|story|quest|synopsis/iu.test(input.question);

if (input.external.length && openEndedStoryQuestion && !usableEntries.length) {
  return safeBoundaryAnswer(input.language, subject, true);
}

if (input.external.length) {
  return directExternalEvidenceAnswer({
    language: input.language,
    question: input.question,
    external: input.external,
  });
}
```

Also make `answerWorthyExternalCitation` reject shared site chrome, navigation-heavy text, and unrendered entities so clean identity fallbacks retain their current behavior while dirty non-story snippets are still blocked.

- [ ] **Step 8: Add a successful character-arc generation regression**

In `tests/generation.test.ts`, mock one strict JSON model response with two cited paragraphs and pass two clean Chinese citations plus prepared understanding:

```ts
it("keeps a coherent cited character-arc answer from clean Chinese evidence", async () => {
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://api.example.test";
  delete process.env.https_proxy;
  delete process.env.HTTPS_PROXY;
  delete process.env.http_proxy;
  delete process.env.HTTP_PROXY;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "api.example.test") {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    paragraphs: [
                      {
                        text: "婕德在失去父亲后渴望归属，因此加入塔尼特并把芭别尔视作家人。",
                        citationIds: ["external-1"],
                      },
                      {
                        text: "认清芭别尔的陷害后，她与虚假的家族决裂，决定以自己的名字选择道路。",
                        citationIds: ["external-2"],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.pathname.includes("api.php")) {
        return new Response(JSON.stringify({ query: { search: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }),
  );

  const citations: Citation[] = [
    {
      id: "arc-start",
      title: "永恒的葱茏之梦",
      url: "https://example.com/arc-start",
      sourceName: "剧情文本索引",
      sourceKind: "game_text",
      credibility: "official",
      factStatus: "official_explicit",
      excerpt: "失去父亲后，婕德渴望新的归属，并把塔尼特和芭别尔视为家人。",
      external: true,
      crossLanguage: false,
    },
    {
      id: "arc-end",
      title: "因为她的罪恶滔天…",
      url: "https://example.com/arc-end",
      sourceName: "剧情文本索引",
      sourceKind: "game_text",
      credibility: "official",
      factStatus: "official_explicit",
      excerpt: "婕德认清芭别尔的陷害后与塔尼特决裂，决定以自己的名字选择道路。",
      external: true,
      crossLanguage: false,
    },
  ];

  const question = "婕德经历了怎样的变化？";
  const result = await generateGroundedResponse({
    question,
    language: "zh-CN",
    profile: "returning",
    entries: [],
    external: citations,
    understanding: ruleUnderstandQuestion(question, "zh-CN"),
  });

expect(result.answer).toContain("失去父亲后渴望归属");
expect(result.answer).toContain("认清芭别尔的陷害");
expect(result.answer).toContain("选择自己的道路");
expect(result.answer).not.toContain("旅行者创作平台");
expect(result.citedSourceIds).toEqual(
  expect.arrayContaining(["external-1", "external-2"]),
);
});
```

The mocked response must use only facts present in the supplied citations; the test verifies orchestration and citation preservation, not a production Jeht template.

- [ ] **Step 9: Run prompt, validation, and generation suites**

Run: `npm test -- tests/answer-prompt.test.ts tests/answer-quality.test.ts tests/generation.test.ts`

Expected: PASS; dirty generated text is rejected, story fallback is a safe boundary answer, clean identity fallback still passes its existing tests, and a valid cited arc answer is preserved.

- [ ] **Step 10: Commit the safe generation behavior**

```powershell
git add lib/answer-quality.ts lib/answer-prompt.ts lib/evidence-quality.ts lib/generation.ts tests/answer-quality.test.ts tests/answer-prompt.test.ts tests/evidence-quality.test.ts tests/generation.test.ts
git commit -m "fix: keep story fallbacks from leaking web excerpts"
```

---

### Task 5: Full Verification and Live Jeht Regression

**Files:**
- Verify: all files changed in Tasks 1-4
- Update when results are known: `progress.md`

**Interfaces:**
- Consumes: the completed character-arc understanding, web-quality, evidence, and fallback changes.
- Produces: verified production build and one real `/api/chat` regression result.

- [ ] **Step 1: Run all focused repair suites together**

Run:

```powershell
npm test -- tests/entity-lexicon.test.ts tests/question-understanding.test.ts tests/web-text-quality.test.ts tests/evidence-quality.test.ts tests/external-search.test.ts tests/answer-prompt.test.ts tests/answer-quality.test.ts tests/generation.test.ts
```

Expected: all focused tests PASS with no skipped Jeht regression.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: all repository test files PASS; no previous relationship, Story Quest, language, citation, source-governance, or clue-heading regression fails.

- [ ] **Step 3: Run static verification**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: TypeScript exits 0 and Next.js production build completes successfully.

- [ ] **Step 4: Start the new production build on an isolated port**

Run:

```powershell
$env:PORT='3110'
$process = Start-Process -FilePath npm.cmd -ArgumentList @('run','start','--','-p','3110') -WorkingDirectory 'F:\PAIMON' -WindowStyle Hidden -PassThru
$process.Id
```

Expected: a new owned process ID is printed and `Get-NetTCPConnection -LocalPort 3110 -State Listen` shows that PID. Do not stop or reuse the user's existing port 3000 process.

- [ ] **Step 5: Exercise both reported phrasings through `/api/chat`**

Send `婕德经历了怎么的变化？` and `婕德经历了怎样的变化？` with the same profile/spoiler payload used by existing route regressions. For each streamed result, assert manually and in the captured output:

```text
entity: 婕德
intent: story
answer: coherent start -> loss/belonging -> manipulation/betrayal -> self-determination arc
forbidden: 婕德经历了 (as entity), 旅行者创作平台 duplicated label, &hellip;, Created with Sketch, navigation dumps, uncited raw dialogue
```

Expected: both phrasings return the same subject and a coherent cited Chinese arc when the model and evidence are available. If upstream generation is unavailable, the answer is the safe boundary message and still contains none of the forbidden strings.

- [ ] **Step 6: Stop only the owned port 3110 process**

Run:

```powershell
$listener = Get-NetTCPConnection -LocalPort 3110 -State Listen -ErrorAction SilentlyContinue
if ($listener -and $listener.OwningProcess -eq $process.Id) {
  Stop-Process -Id $process.Id -Force
}
```

Expected: port 3110 has no listener; the user's port 3000 process remains untouched.

- [ ] **Step 7: Record exact verification counts and inspect final scope**

Update `progress.md` with focused/full test counts, typecheck/build results, live-answer status, and any unavailable external provider. Then run:

```powershell
git status --short
git diff --check HEAD~3..HEAD
git log --oneline -5
```

Expected: only the planned files are changed or committed, diff check reports no whitespace errors, and unrelated user work is absent from the repair commits.

---

## Final Acceptance Checklist

- The typo form and standard form both identify `婕德`, never `婕德经历了`.
- Both forms use story intent and entity-anchored arc queries.
- `&hellip;`, repeated Observation Hub titles, navigation dumps, and raw dialogue dumps cannot become answer-bearing evidence.
- Fetched pages replace search snippets only when the shared deterministic quality score improves.
- Generated output containing shared web noise fails validation and gets one repair attempt.
- A failed model cannot concatenate external snippets for open-ended story or character-arc questions.
- Clean controlled-knowledge and identity fallback behavior remains covered by existing tests.
- No Jeht answer or lore text is hard-coded in production modules.
- Focused tests, full tests, typecheck, build, and isolated-port live regression all pass.
