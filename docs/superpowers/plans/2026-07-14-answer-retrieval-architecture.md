# Answer Retrieval Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PAIMON answer stable lore questions reliably through spoiler-safe local facts, resilient staged search, and a clearly labeled model-knowledge fallback when every evidence route is unavailable.

**Architecture:** Keep question understanding and answer validation intact, but insert two focused boundaries: atomic local faction evidence and a staged search router with per-backend diagnostics. The agent prefers verified evidence, falls back to partial evidence when appropriate, and only uses uncited model knowledge for stable low-risk lore that passes an explicit eligibility policy.

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19, DeepSeek OpenAI-compatible Chat Completions API, Vitest.

## Global Constraints

- Do not add Agent Reach, `mcporter`, Exa MCP, browser cookies, or a paid search key as a production dependency.
- Preserve the spoiler confirmation gate, bilingual output, citation markers, event recording, and reading recommendations.
- A basic organizational fact must not inherit a deeper entry's spoiler level.
- Search snippets are discovery clues until retained by the existing assessment and enrichment rules.
- A failed search backend must not reject the whole search operation.
- Model knowledge must never invent citations and must always use `confidence: "low"` plus `verificationStatus: "model_knowledge"`.
- Model knowledge is forbidden for release timing, current implementation status, leaks, safety refusals, and categorical claims that content or relationships do not exist.
- Player-facing UI must not expose backend ids, raw exceptions, credentials, or private reasoning.
- Each task ends with focused passing tests and its own commit.

---

### Task 1: Preserve Spoiler-Safe Faction Evidence

**Files:**
- Create: `data/faction-knowledge.ts`
- Modify: `data/knowledge.ts`
- Modify: `tests/retrieval.test.ts`

**Interfaces:**
- Consumes: `KnowledgeEntry`, `Language`, and the existing `retrieveControlled()` scorer.
- Produces: `factionKnowledgeEntries: KnowledgeEntry[]` containing atomic bilingual faction facts.

- [ ] **Step 1: Write the failing retrieval regression**

Add this test to `tests/retrieval.test.ts`:

```ts
it("keeps the Tsaritsa-Harbinger organization fact under low spoilers", () => {
  const result = retrieveControlled({
    question: "冰之女皇与愚人众执行官之间是什么关系？",
    language: "zh-CN",
    progress: "mondstadt",
    spoilerPreference: "low",
    focus: ["story", "character"],
  });

  expect(result.entries[0]?.conceptId).toBe("tsaritsa-harbingers-command");
  expect(result.entries[0]?.spoilerLevel).toBeLessThanOrEqual(1);
  expect(result.entries[0]?.summary).toContain("领导");
  expect(result.entries[0]?.summary).toContain("执行官");
});
```

- [ ] **Step 2: Run the test and verify the current defect**

Run: `npx vitest run tests/retrieval.test.ts`

Expected: FAIL because the query currently returns no low-spoiler local entry.

- [ ] **Step 3: Add the atomic bilingual faction entry**

Create `data/faction-knowledge.ts` with one reviewed concept expanded into Chinese and English entries:

```ts
import type { KnowledgeEntry, Language } from "@/lib/domain";

const factionFacts = [
  {
    conceptId: "tsaritsa-harbingers-command",
    zh: {
      title: "冰之女皇领导愚人众执行官",
      content:
        "冰之女皇是至冬与愚人众的最高领导者。愚人众执行官是组织核心成员，受命在各国执行任务；多位执行官明确把女皇称为自己的效忠对象，但各自加入组织的个人动机并不完全相同。",
      summary: "冰之女皇领导愚人众，执行官受命贯彻其意志，但个人动机各不相同。",
      aliases: ["冰之女皇", "女皇", "愚人众", "愚人众执行官", "执行官"],
    },
    en: {
      title: "The Tsaritsa leads the Fatui Harbingers",
      content:
        "The Tsaritsa is the supreme leader of Snezhnaya and the Fatui. The Fatui Harbingers are core members who carry out missions across Teyvat; several explicitly name the Tsaritsa as the object of their loyalty, while their personal reasons for joining are not identical.",
      summary:
        "The Tsaritsa leads the Fatui, and the Harbingers carry out her will while retaining different personal motives.",
      aliases: ["Tsaritsa", "Fatui", "Fatui Harbingers", "Harbingers", "Cryo Archon"],
    },
    tags: ["fatui", "harbingers", "relationship", "organization"],
    contentType: "character" as const,
    spoilerLevel: 1 as const,
    minimumProgress: "mondstadt" as const,
    factStatus: "trusted_secondary" as const,
    source: {
      title: "愚人众（游戏文本索引）",
      url: "https://wiki.biligame.com/ys/%E6%84%9A%E4%BA%BA%E4%BC%97",
      sourceName: "原神WIKI_BWIKI",
      sourceKind: "trusted_wiki" as const,
    },
  },
];

export const factionKnowledgeEntries: KnowledgeEntry[] = factionFacts.flatMap(
  (fact) =>
    (["zh-CN", "en"] as Language[]).map((language) => {
      const localized = language === "zh-CN" ? fact.zh : fact.en;
      return {
        id: `${fact.conceptId}-${language === "zh-CN" ? "zh" : "en"}`,
        conceptId: fact.conceptId,
        language,
        ...localized,
        tags: fact.tags,
        contentType: fact.contentType,
        spoilerLevel: fact.spoilerLevel,
        minimumProgress: fact.minimumProgress,
        factStatus: fact.factStatus,
        source: fact.source,
        reviewed: true,
      };
    }),
);
```

Import and append `factionKnowledgeEntries` in `data/knowledge.ts`.

- [ ] **Step 4: Run focused retrieval and audit tests**

Run: `npx vitest run tests/retrieval.test.ts tests/knowledge-audit.test.ts`

Expected: PASS, including the new low-spoiler relationship case.

- [ ] **Step 5: Commit the feature**

```powershell
git add data/faction-knowledge.ts data/knowledge.ts tests/retrieval.test.ts
git commit -m "fix: preserve spoiler-safe faction evidence"
```

### Task 2: Add Resilient Staged Search Routing

**Files:**
- Create: `lib/search-router.ts`
- Create: `tests/search-router.test.ts`
- Modify: `lib/external-search.ts`
- Modify: `lib/generation.ts`
- Modify: `tests/external-search.test.ts`

**Interfaces:**
- Produces: `SearchBackend`, `SearchAttempt`, `SearchRoutingResult`, and `runStagedSearch()`.
- Produces: `searchWebEvidenceWithDiagnostics(question, language, options)` while preserving `searchWebEvidence()` as a compatibility wrapper.
- Consumes: existing MediaWiki and general-web candidate functions, source assessment, enrichment, and ranking.

- [ ] **Step 1: Write router failure-isolation and early-stop tests**

Create `tests/search-router.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runStagedSearch, type SearchBackend } from "@/lib/search-router";
import type { Citation } from "@/lib/domain";

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
      signal: undefined,
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
      signal: undefined,
      isSufficient: (items) => items.length >= 1,
    });

    expect(result.citations.map((item) => item.id)).toContain("general-1");
    expect(result.attempts.map((item) => item.status)).toEqual(["error", "ok"]);
  });
});
```

- [ ] **Step 2: Run the router test and verify it fails**

Run: `npx vitest run tests/search-router.test.ts`

Expected: FAIL because `lib/search-router.ts` does not exist.

- [ ] **Step 3: Implement the provider-neutral router**

Create `lib/search-router.ts` with these exported types and behavior:

```ts
import type { Citation, Language } from "@/lib/domain";

export type SearchTier = "direct_reference" | "general_web";
export type SearchAttemptStatus = "ok" | "empty" | "timeout" | "error";

export interface SearchBackendRequest {
  question: string;
  language: Language;
  signal?: AbortSignal;
}

export interface SearchBackend {
  id: string;
  tier: SearchTier;
  search(request: SearchBackendRequest): Promise<Citation[]>;
}

export interface SearchAttempt {
  backendId: string;
  tier: SearchTier;
  status: SearchAttemptStatus;
  durationMs: number;
  resultCount: number;
}

export interface SearchRoutingResult {
  citations: Citation[];
  attempts: SearchAttempt[];
}

function dedupe(citations: Citation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.url.toLowerCase()}::${citation.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runStagedSearch(
  backends: SearchBackend[],
  request: SearchBackendRequest & {
    isSufficient(citations: Citation[]): boolean;
  },
): Promise<SearchRoutingResult> {
  const citations: Citation[] = [];
  const attempts: SearchAttempt[] = [];
  for (const tier of ["direct_reference", "general_web"] as const) {
    const tierBackends = backends.filter((backend) => backend.tier === tier);
    const settled = await Promise.all(
      tierBackends.map(async (backend) => {
        const started = Date.now();
        try {
          const items = await backend.search(request);
          return {
            items,
            attempt: {
              backendId: backend.id,
              tier,
              status: items.length ? ("ok" as const) : ("empty" as const),
              durationMs: Date.now() - started,
              resultCount: items.length,
            },
          };
        } catch (error) {
          const timeout =
            error instanceof DOMException && error.name === "TimeoutError";
          return {
            items: [],
            attempt: {
              backendId: backend.id,
              tier,
              status: timeout ? ("timeout" as const) : ("error" as const),
              durationMs: Date.now() - started,
              resultCount: 0,
            },
          };
        }
      }),
    );
    for (const result of settled) {
      citations.push(...result.items);
      attempts.push(result.attempt);
    }
    const unique = dedupe(citations);
    citations.splice(0, citations.length, ...unique);
    if (request.isSufficient(citations)) break;
  }
  return { citations, attempts };
}
```

- [ ] **Step 4: Expose diagnostics from external search**

Keep `SearchAttempt` in `lib/search-router.ts` and import it as a type from `lib/generation.ts`. In `lib/external-search.ts`, introduce `searchWebEvidenceWithDiagnostics()` and keep the existing function as:

```ts
export async function searchWebEvidence(
  question: string,
  language: Language,
  options: SearchWebEvidenceOptions = {},
) {
  return (await searchWebEvidenceWithDiagnostics(question, language, options))
    .citations;
}
```

Build direct-reference and general-web adapters from the existing provider functions. Direct-reference adapters run the bounded primary queries against MediaWiki providers. The general-web adapter runs only when the direct stage does not retain sufficient evidence. Keep story-quest localization and source-governance assessment after routing so current specialized tests remain valid.

Bound relationship expansion to six second-stage queries, always retaining both core entities. Remove unconditional execution of unrelated character-story and single-entity community queries for relationship intent.

- [ ] **Step 5: Thread attempts through grounded generation**

Extend `GroundedGenerationResult`:

```ts
searchAttempts: SearchAttempt[];
```

Every generation return path supplies the attempt list. Existing callers continue receiving `external`, `citedSourceIds`, and `searchPlan` unchanged.

- [ ] **Step 6: Run focused router and search tests**

Run: `npx vitest run tests/search-router.test.ts tests/external-search.test.ts tests/generation.test.ts`

Expected: PASS with existing story, identity, and relationship search behavior preserved.

- [ ] **Step 7: Commit the feature**

```powershell
git add lib/search-router.ts lib/external-search.ts lib/generation.ts tests/search-router.test.ts tests/external-search.test.ts
git commit -m "feat: add resilient search capability routing"
```

### Task 3: Add the Model-Knowledge Answer Fallback

**Files:**
- Create: `lib/model-knowledge.ts`
- Create: `tests/model-knowledge.test.ts`
- Modify: `lib/domain.ts`
- Modify: `lib/agent.ts`
- Modify: `components/answer-card.tsx`
- Modify: `app/globals.css`
- Modify: `tests/agent.test.ts`
- Modify: `tests/ui-redesign-source.test.ts`

**Interfaces:**
- Produces: `VerificationStatus` and `ChatResult.verificationStatus`.
- Produces: `canUseModelKnowledgeFallback()` and `generateModelKnowledgeAnswer()`.
- Consumes: the configured `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` without introducing new credentials.

- [ ] **Step 1: Write eligibility-policy tests**

Create `tests/model-knowledge.test.ts` with stable-lore allow cases and current/high-risk deny cases:

```ts
import { describe, expect, it } from "vitest";
import { canUseModelKnowledgeFallback } from "@/lib/model-knowledge";

describe("model knowledge fallback policy", () => {
  it("allows a stable faction relationship question", () => {
    expect(
      canUseModelKnowledgeFallback({
        question: "冰之女皇与愚人众执行官之间是什么关系？",
        category: "story",
        confirmedHighRisk: false,
      }),
    ).toBe(true);
  });

  it.each([
    "7.1版本什么时候上线？",
    "这个角色现在实装了吗？",
    "内鬼爆料的新角色技能是什么？",
    "官方从未让这两个人对话过吗？",
  ])("rejects time-sensitive or categorical-negative question: %s", (question) => {
    expect(
      canUseModelKnowledgeFallback({
        question,
        category: "story",
        confirmedHighRisk: false,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the policy tests and verify they fail**

Run: `npx vitest run tests/model-knowledge.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement eligibility and structured generation**

Create `lib/model-knowledge.ts`. Export the policy and a generator that uses `response_format: { type: "json_object" }`, `thinking: { type: "disabled" }`, temperature `0.2`, and a strict `{ paragraphs: [{ text }] }` output contract. The system instruction must say:

```text
Answer from stable Genshin knowledge already known to the model because live source verification is unavailable. Give the direct answer first. Separate broadly established setting from uncertain interpretation. Do not claim current release status, quote exact dialogue, assert that something never happened, or fabricate citations. Return JSON only.
```

Normalize the output into `AnswerParagraph[]` with empty `citationIds`. Return `null` on missing configuration, non-2xx responses, invalid JSON, wrong language, empty paragraphs, timeout, or abort.

- [ ] **Step 4: Add verification state to the domain and agent**

Add to `lib/domain.ts`:

```ts
export type VerificationStatus =
  | "verified"
  | "partially_verified"
  | "model_knowledge";
```

Make `verificationStatus` required on `ChatResult` and set it on every `runAgent()` result:

- refused and spoiler confirmation: `verified`;
- answered with controlled or high-quality external evidence: `verified`;
- answered from weak but retained evidence: `partially_verified`;
- uncited model fallback: `model_knowledge`;
- insufficient evidence: `partially_verified`.

Immediately before the current zero-entry/zero-external insufficient-evidence return, call the model fallback when `canUseModelKnowledgeFallback()` permits it. A successful fallback returns `status: "answered"`, empty claims/citations, `usedExternalSources: false`, `confidence: "low"`, and the generated paragraphs. If the fallback returns `null`, preserve the existing limited response.

- [ ] **Step 5: Render the player-facing verification note**

In `components/answer-card.tsx`, insert a note after `.answer-kicker` only for non-verified answers:

```tsx
{result.verificationStatus !== "verified" ? (
  <p className={`verification-note ${result.verificationStatus}`} role="status">
    {result.verificationStatus === "model_knowledge"
      ? t(
          language,
          "这次没能完成来源核验，以下为派蒙依据已有知识整理的暂定回答。",
          "Source verification was unavailable, so this is a provisional answer from Paimon's existing knowledge.",
        )
      : t(
          language,
          "现有线索只核实了部分内容，未确认之处会保留边界。",
          "The available clues verify only part of this answer; uncertain points remain qualified.",
        )}
  </p>
) : null}
```

Style it as a small ornamental note without recoloring the answer body or source cards.

- [ ] **Step 6: Test the agent fallback and UI source**

Mock all search responses as empty and mock the DeepSeek response as a valid model-knowledge paragraph. Assert that the agent returns `answered`, `model_knowledge`, low confidence, zero citations, and a substantive relationship answer. Add source assertions for both Chinese and English notice copy.

Run: `npx vitest run tests/model-knowledge.test.ts tests/agent.test.ts tests/ui-redesign-source.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the feature**

```powershell
git add lib/model-knowledge.ts lib/domain.ts lib/agent.ts components/answer-card.tsx app/globals.css tests/model-knowledge.test.ts tests/agent.test.ts tests/ui-redesign-source.test.ts
git commit -m "feat: add model-knowledge answer fallback"
```

### Task 4: Add Cross-Architecture Regression Coverage

**Files:**
- Create: `tests/answer-architecture.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `runAgent()` and mocked provider/model responses.
- Produces: deterministic regression cases for verification state, spoiler behavior, citations, and prohibited fallback behavior.

- [ ] **Step 1: Add a table-driven answer regression suite**

Create fixtures for:

```ts
const cases = [
  {
    question: "冰之女皇与愚人众执行官之间是什么关系？",
    spoilerPreference: "low",
    expectedStatus: "verified",
    required: ["女皇", "执行官"],
  },
  {
    question: "雷电将军和雷电影是什么关系？",
    spoilerPreference: "full",
    expectedStatus: "model_knowledge",
    required: ["雷电"],
  },
  {
    question: "这个角色现在实装了吗？",
    spoilerPreference: "full",
    expectedStatus: "partially_verified",
    prohibited: ["已经实装"],
  },
] as const;
```

Mock the network per case so the suite deterministically exercises local evidence, model fallback, and forbidden-fallback behavior. Assert that model-knowledge cases have no citations and that verified local cases retain citations.

- [ ] **Step 2: Document the answer strategy**

Add a concise README architecture note describing the three verification states and the staged search order. Document that optional future search adapters belong behind the router rather than inside prompts.

- [ ] **Step 3: Run the regression and complete test suite**

Run: `npx vitest run tests/answer-architecture.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all test files pass.

- [ ] **Step 4: Commit regression coverage**

```powershell
git add tests/answer-architecture.test.ts README.md
git commit -m "test: add answer architecture regression coverage"
```

### Task 5: Verify the Real Application and Publish

**Files:**
- Modify only when verification reveals a scoped defect.

**Interfaces:**
- Consumes: `POST /api/chat` and `POST /api/chat/stream`.
- Produces: a pushed branch whose real low-spoiler answer is substantive and correctly labeled.

- [ ] **Step 1: Run static and production validation**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: successful Next.js production build.

- [ ] **Step 2: Run live API smoke checks**

Start the app on an unused port and submit:

1. `冰之女皇与愚人众执行官之间是什么关系？` with Mondstadt progress and low spoilers.
2. `雷电将军和雷电影是什么关系？` through the normal live path, then compare its verification state with the deterministic mocked regression test.
3. A current-status question to confirm model knowledge is not used.
4. An existing Sandrone/Alain or Pantalone/Dottore relationship regression.

Expected: the reported question is answered from local evidence even when web providers fail; stable uncited fallback is labeled; current-status questions retain an evidence boundary.

- [ ] **Step 3: Inspect repository state**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short --branch`

Expected: clean branch with only the intended commits ahead of its upstream base.

- [ ] **Step 4: Push the branch**

Run: `git push -u origin codex/answer-retrieval-architecture`

Expected: remote branch created and tracking configured.
