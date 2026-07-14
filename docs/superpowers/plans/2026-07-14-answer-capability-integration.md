# Answer Capability Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Direction A's question understanding and evidence-quality pipeline while adding Direction B's reviewed local facts, staged backend isolation, accurate verification states, and tightly bounded model-knowledge fallback so the fixed capability suite reaches 12/12 without regressing Jeht.

**Architecture:** `runAgent` remains the single orchestrator. Controlled retrieval is evaluated before any network request; insufficient questions continue through Direction A's existing query planning, cleanup, entity gates, evidence selection, and generation validation. The new router schedules backends but never judges trust. Verification is derived only after the final answer paragraphs and accepted citations are known. Model knowledge runs last, only for stable identity/organization/basic-relation questions, and can never acquire citations or a verified state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, Vitest 3, OpenAI-compatible DeepSeek API, undici, PowerShell.

## Global Constraints

- Keep these Direction A modules semantically authoritative: `lib/question-understanding.ts`, `lib/entity-lexicon.ts`, `lib/web-text-quality.ts`, `lib/evidence-quality.ts`, `lib/answer-quality.ts`, and `lib/search-result-url.ts`.
- Do not cherry-pick or merge Direction B's versions of `lib/external-search.ts`, `lib/generation.ts`, or `lib/agent.ts`.
- Every external candidate must still pass Direction A's decode, cleanup, relevance, stage-coverage, and `selectAnswerEvidence` gates.
- A source domain, Wiki label, or non-empty citation count is never sufficient by itself for `verified`.
- `model_knowledge` answers always have `confidence: "low"`, `citations: []`, `claims: []`, and no fabricated source markers.
- `spoiler_confirmation_required`, `refused`, and `insufficient_evidence` never carry a verification status.
- Preserve all 338 Direction A tests; add focused tests before implementation and commit each task separately.
- Stage only the task's named files. `docs/` is ignored in this repository, so use `git add -f` only for the intended plan/spec files.
- Do not merge to `main` until unit tests, typecheck, production build, fixed evaluation, and repeated live acceptance all pass.

---

## Task 1: Reviewed Faction Fact and Local Evidence Sufficiency

**Files:**

- Create: `data/faction-knowledge.ts`
- Create: `lib/local-evidence.ts`
- Create: `tests/faction-knowledge.test.ts`
- Create: `tests/local-evidence.test.ts`
- Modify: `data/knowledge.ts`
- Modify: `lib/generation.ts`
- Modify: `tests/generation.test.ts`
- Modify: `tests/retrieval.test.ts`

- [ ] **Step 1: Add failing tests for the bilingual Tsaritsa fact**

Create `tests/faction-knowledge.test.ts` with assertions that:

```ts
import { describe, expect, it } from "vitest";
import { factionKnowledgeEntries } from "@/data/faction-knowledge";

describe("faction knowledge", () => {
  it("provides one reviewed bilingual atomic fact for the Tsaritsa relationship", () => {
    expect(factionKnowledgeEntries).toHaveLength(2);
    expect(factionKnowledgeEntries.map((entry) => entry.language).sort()).toEqual([
      "en",
      "zh-CN",
    ]);
    for (const entry of factionKnowledgeEntries) {
      expect(entry.reviewed).toBe(true);
      expect(entry.tags).toEqual(expect.arrayContaining([
        "relationship",
        "organization",
        "atomic-fact",
      ]));
      expect(entry.spoilerLevel).toBeLessThanOrEqual(1);
      expect(entry.source.sourceKind).toBe("trusted_wiki");
    }
  });
});
```

Add a retrieval test using the normal Chinese request profile and assert that the result contains `tsaritsa-harbingers-command-zh` but not the English twin.

- [ ] **Step 2: Run the focused tests and confirm the missing-module failure**

Run:

```powershell
npx vitest run tests/faction-knowledge.test.ts tests/retrieval.test.ts
```

Expected: FAIL because `data/faction-knowledge.ts` does not exist and the fact is not part of `knowledgeEntries`.

- [ ] **Step 3: Add the reviewed bilingual fact and register it**

Create `data/faction-knowledge.ts` from Direction B's vetted seed, keeping this semantic payload:

```ts
const factionFacts = [{
  conceptId: "tsaritsa-harbingers-command",
  zh: {
    title: "冰之女皇领导愚人众执行官",
    content:
      "冰之女皇是至冬与愚人众的最高领导者。愚人众执行官是组织核心成员，受命在各国执行任务；多位执行官明确把女皇称为自己的效忠对象，但各自加入组织的个人动机并不完全相同。",
    summary:
      "冰之女皇领导愚人众，执行官受命贯彻其意志，但个人动机各不相同。",
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
  tags: ["fatui", "harbingers", "relationship", "organization", "atomic-fact"],
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
}];
```

Map it into two `KnowledgeEntry` objects exactly as other bilingual seeds do. Import and spread `factionKnowledgeEntries` at the end of `data/knowledge.ts`.

- [ ] **Step 4: Add failing local-sufficiency policy tests**

Create `tests/local-evidence.test.ts` covering all four decisions:

```ts
expect(assessLocalEvidenceSufficiency(tsaritsaInput)).toMatchObject({
  sufficient: true,
  reason: "atomic_relationship",
});
expect(assessLocalEvidenceSufficiency(catchUpInput)).toMatchObject({
  sufficient: true,
  reason: "controlled_catch_up",
});
expect(assessLocalEvidenceSufficiency(genericPuzzleInput)).toMatchObject({
  sufficient: true,
  reason: "layered_hint",
});
expect(assessLocalEvidenceSufficiency(jehtArcInput)).toEqual({
  sufficient: false,
  reason: "character_arc_requires_stage_coverage",
});
```

The Jeht fixture must include one otherwise relevant local character entry so the test proves that a single profile card cannot short-circuit a character arc.

- [ ] **Step 5: Implement the local-sufficiency policy as an independent pure function**

Create `lib/local-evidence.ts` with this public contract:

```ts
import type { KnowledgeEntry, QuestionCategory } from "@/lib/domain";
import type { SearchPlan } from "@/lib/external-search";

export type LocalEvidenceReason =
  | "atomic_relationship"
  | "controlled_catch_up"
  | "layered_hint"
  | "character_arc_requires_stage_coverage"
  | "insufficient";

export interface LocalEvidenceDecision {
  sufficient: boolean;
  reason: LocalEvidenceReason;
}

export function assessLocalEvidenceSufficiency(input: {
  question: string;
  category: QuestionCategory;
  entries: KnowledgeEntry[];
  plan: SearchPlan;
}): LocalEvidenceDecision {
  if (input.plan.storyScope === "character_arc") {
    return { sufficient: false, reason: "character_arc_requires_stage_coverage" };
  }
  const reviewed = input.entries.filter((entry) => entry.reviewed);
  const atomicRelationship =
    input.plan.intent === "relationship" &&
    reviewed.some((entry) =>
      entry.tags.includes("atomic-fact") &&
      entry.tags.includes("relationship"),
    );
  if (atomicRelationship) {
    return { sufficient: true, reason: "atomic_relationship" };
  }
  const catchUp =
    input.category === "version_overview" &&
    /回归|补课|停在|看懂|catch\s*up|stopped\s+after|context.*need/iu.test(input.question) &&
    reviewed.some((entry) => entry.tags.includes("catch-up"));
  if (catchUp) {
    return { sufficient: true, reason: "controlled_catch_up" };
  }
  const genericPuzzle =
    input.category === "gameplay" &&
    /机关|解谜|提示|puzzle|mechanism|hint/iu.test(input.question) &&
    reviewed.some((entry) =>
      ["gameplay", "puzzle", "hint"].every((tag) => entry.tags.includes(tag)),
    );
  if (genericPuzzle) {
    return { sufficient: true, reason: "layered_hint" };
  }
  return { sufficient: false, reason: "insufficient" };
}
```

If the existing classifier labels the catch-up case differently from `version_overview`, adjust the policy to the observed category plus the explicit catch-up tag; do not weaken it to “any local entry exists.”

- [ ] **Step 6: Short-circuit generation before LLM or web search only when the policy says sufficient**

Add `category?: QuestionCategory` to `generateGroundedResponse`. In `lib/agent.ts`, pass `eventClassification.questionCategory`. Immediately after building `fallbackSearchPlan`, evaluate local sufficiency. On success, return the existing `generationFallback` result with `external: []`, its paragraph citation IDs, and the unchanged A search plan:

```ts
const localDecision = assessLocalEvidenceSufficiency({
  question: input.question,
  category: input.category ?? "story",
  entries: input.entries,
  plan: fallbackSearchPlan,
});
if (localDecision.sufficient) {
  const local = generationFallback({ ...input, external: [] });
  return {
    ...local,
    external: [],
    citedSourceIds: local.answerParagraphs.flatMap((paragraph) => paragraph.citationIds),
    searchPlan: fallbackSearchPlan,
  };
}
```

Add generation tests that mock `global.fetch` to throw if called. Assert no fetch for the Tsaritsa, Chinese catch-up, and generic Chinese puzzle inputs; assert Jeht still enters the evidence path.

- [ ] **Step 7: Run focused and existing generation/retrieval tests**

Run:

```powershell
npx vitest run tests/faction-knowledge.test.ts tests/local-evidence.test.ts tests/retrieval.test.ts tests/generation.test.ts tests/agent.test.ts
```

Expected: PASS. The Tsaritsa result uses one local-language citation and no network call; Jeht behavior remains Direction A behavior.

- [ ] **Step 8: Commit Task 1**

```powershell
git add data/faction-knowledge.ts data/knowledge.ts lib/local-evidence.ts lib/generation.ts lib/agent.ts tests/faction-knowledge.test.ts tests/local-evidence.test.ts tests/generation.test.ts tests/retrieval.test.ts
git commit -m "feat: prefer sufficient reviewed local evidence"
```

---

## Task 2: Staged Search Router, Failure Isolation, and Diagnostics

**Files:**

- Create: `lib/search-router.ts`
- Create: `tests/search-router.test.ts`
- Modify: `lib/external-search.ts`
- Modify: `tests/external-search.test.ts`
- Modify: `lib/trace.ts` only if its public detail type must be widened

- [ ] **Step 1: Add failing router unit tests**

Cover these cases with deterministic fake backends:

1. Two direct-reference backends run in parallel and a sufficient accepted set prevents general-web calls.
2. An empty direct tier falls through to general web.
3. One timeout and one thrown error are recorded without discarding another backend's results.
4. An aborted request does not start the next tier.
5. Equivalent URL/title/excerpt results are deduplicated.
6. The sufficiency callback may be asynchronous so Direction A can assess evidence before the router stops.

Use deferred promises to prove same-tier concurrency; do not assert timing thresholds.

- [ ] **Step 2: Run the router tests and confirm the missing-module failure**

```powershell
npx vitest run tests/search-router.test.ts
```

Expected: FAIL because `lib/search-router.ts` does not exist.

- [ ] **Step 3: Implement the router without evidence-quality policy**

Create the module with these interfaces:

```ts
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

export async function runStagedSearch(
  backends: SearchBackend[],
  request: SearchBackendRequest & {
    isSufficient(citations: Citation[]): boolean | Promise<boolean>;
  },
): Promise<SearchRoutingResult>;
```

Within each tier use `Promise.all` around individually caught backend calls. Classify `TimeoutError` and `AbortError` as `timeout`, all other throws as `error`, append successful items, dedupe, then `await request.isSufficient(citations)`. Check `request.signal?.aborted` before starting each tier. The router must not import source-governance or evidence-quality modules.

- [ ] **Step 4: Route the three general-web engines through isolated backends**

Replace `searchGeneralWeb`'s raw `Promise.allSettled` block with:

```ts
const routed = await runStagedSearch(
  [
    { id: "duckduckgo", tier: "general_web", search: ({ signal }) => searchDuckDuckGoWeb(query, signal) },
    { id: "yahoo", tier: "general_web", search: ({ signal }) => searchYahooWeb(query, signal) },
    { id: "sogou", tier: "general_web", search: ({ signal }) => searchSogouWeb(query, signal) },
  ],
  {
    question: query,
    language: containsCjk(query) ? "zh-CN" : "en",
    signal: options.signal,
    isSufficient: () => false,
  },
);
const citations = routed.citations;
```

This first integration adds backend fault isolation without changing A's provider order or final acceptance semantics.

- [ ] **Step 5: Add direct-reference-before-general routing inside each prepared query**

Refactor `runQueries` so `searchProviders` is a `direct_reference` backend and `searchGeneralWeb` is a `general_web` backend. Its async `isSufficient` callback must call the existing A assessment/ranking helpers and may stop early only for `identity` or `current_status` when at least one clean, entity-relevant direct reference survives. It must return `false` for `relationship`, `story`, and every `character_arc` query so A's relationship expansions and stage coverage remain intact.

```ts
isSufficient: async (citations) => {
  if (!(["identity", "current_status"] as SearchIntent[]).includes(plan.intent)) {
    return false;
  }
  const accepted = await assessCandidates(citations, false, false);
  return dedupeAndRank(accepted, plan, question).some((citation) =>
    planEntities.some((entity) => includesEntity(
      `${citation.title} ${citation.excerpt}`,
      entity,
    )),
  );
},
```

Move local helper declarations as needed to avoid forward-reference problems; do not duplicate or simplify `assessSources`, `dedupeAndRank`, character-arc bucket balancing, English-clue localization, or Chinese confirmation.

- [ ] **Step 6: Emit attempt diagnostics without exposing backend internals in the answer**

For every completed routing call, emit trace details such as `duckduckgo=timeout; yahoo=ok(2); sogou=empty`. Keep diagnostics in trace only; do not add them to `Citation`, answer text, or verification logic.

- [ ] **Step 7: Add external-search regression tests**

Extend `tests/external-search.test.ts` to assert:

- a clean identity result from a direct reference prevents general-web fetches;
- a relationship query still reaches supplemental queries;
- a character-arc query still runs all three prepared first-tier queries and retains stage balancing;
- a failed Yahoo request does not suppress clean Sogou/BWIKI evidence;
- all returned citations still pass A's existing navigation and entity-relevance expectations.

- [ ] **Step 8: Run the router and A search-quality suites**

```powershell
npx vitest run tests/search-router.test.ts tests/external-search.test.ts tests/evidence-quality.test.ts tests/web-text-quality.test.ts tests/search-result-url.test.ts tests/source-governance.test.ts
```

Expected: PASS, including existing Jeht character-arc search tests.

- [ ] **Step 9: Commit Task 2**

```powershell
git add lib/search-router.ts lib/external-search.ts lib/trace.ts tests/search-router.test.ts tests/external-search.test.ts
git commit -m "feat: isolate staged search backends"
```

Omit `lib/trace.ts` from staging if no edit was required.

---

## Task 3: Evidence-Coverage Verification Status and Answer UI

**Files:**

- Create: `lib/verification.ts`
- Create: `tests/verification.test.ts`
- Modify: `lib/domain.ts`
- Modify: `lib/agent.ts`
- Modify: `components/answer-card.tsx`
- Modify: `components/answer-card.module.css`
- Modify: `tests/agent.test.ts`
- Modify: `tests/ui-redesign-source.test.ts`
- Modify: `tests/chat-stream.test.ts`

- [ ] **Step 1: Add failing domain and verification tests**

Add to `lib/domain.ts`:

```ts
export type VerificationStatus =
  | "verified"
  | "partially_verified"
  | "model_knowledge";
```

Add `verificationStatus?: VerificationStatus` to `ChatResult`, then create tests for:

- all non-empty paragraphs cite accepted final citations -> `verified`;
- at least one supported paragraph but another paragraph lacks support -> `partially_verified`;
- citation IDs not present in the final citation list do not count;
- navigation-heavy rejected candidates never reach this function because it only receives final accepted citations;
- non-answered status -> `undefined`;
- explicit model-origin answer -> `model_knowledge`.

- [ ] **Step 2: Implement coverage-based verification**

Create `lib/verification.ts` with this public function:

```ts
export function determineVerificationStatus(input: {
  status: ChatResult["status"];
  answerParagraphs?: AnswerParagraph[];
  citations: Citation[];
  origin?: "evidence" | "model_knowledge";
}): VerificationStatus | undefined {
  if (input.status !== "answered") return undefined;
  if (input.origin === "model_knowledge") return "model_knowledge";
  const acceptedIds = new Set(input.citations.map((citation) => citation.id));
  const paragraphs = (input.answerParagraphs ?? []).filter((paragraph) =>
    paragraph.text.trim(),
  );
  const supported = paragraphs.filter((paragraph) =>
    paragraph.citationIds.length > 0 &&
    paragraph.citationIds.every((id) => acceptedIds.has(id)),
  );
  if (paragraphs.length > 0 && supported.length === paragraphs.length) {
    return "verified";
  }
  if (supported.length > 0) return "partially_verified";
  return undefined;
}
```

Do not infer verification from `sourceKind`, hostname, `entries.length`, or citation count alone.

- [ ] **Step 3: Attach status only after the accepted evidence and answer paragraphs exist**

In `lib/agent.ts`, add `verificationStatus` to the evidence-backed `baseResult` by calling `determineVerificationStatus` with `generated.answerParagraphs` and the final `citations`. Leave all earlier refusal/spoiler/insufficient returns without the field.

Add tests proving:

- Tsaritsa local atomic answer -> `verified`;
- a clean fully cited external answer -> `verified`;
- a partially cited answer -> `partially_verified`;
- Jeht with rejected dirty evidence -> not `verified`;
- spoiler/refused/insufficient objects have `verificationStatus === undefined`.

- [ ] **Step 4: Render restrained bilingual verification labels**

In `components/answer-card.tsx`, map status to compact labels:

```ts
const verificationLabel = result.verificationStatus === "verified"
  ? result.language === "zh-CN" ? "线索已核验" : "Evidence verified"
  : result.verificationStatus === "partially_verified"
    ? result.language === "zh-CN" ? "部分线索已核验" : "Partially verified"
    : result.verificationStatus === "model_knowledge"
      ? result.language === "zh-CN" ? "模型已有知识·未实时核验" : "Model knowledge · not live-verified"
      : undefined;
```

Render it beside the existing confidence/kicker metadata, not inside the restored clue-heading grid. Use neutral styling; do not recolor answer body, citations, or primary reading surfaces.

- [ ] **Step 5: Verify streamed results do not claim verification early**

Extend `tests/chat-stream.test.ts` so no intermediate trace event contains a final verification label and the completed answer event carries the same status as the final JSON result.

- [ ] **Step 6: Run domain, agent, stream, and UI tests**

```powershell
npx vitest run tests/verification.test.ts tests/agent.test.ts tests/chat-stream.test.ts tests/ui-redesign-source.test.ts
npm run typecheck
```

Expected: PASS. Existing clue-heading-layout test remains green.

- [ ] **Step 7: Commit Task 3**

```powershell
git add lib/domain.ts lib/verification.ts lib/agent.ts components/answer-card.tsx components/answer-card.module.css tests/verification.test.ts tests/agent.test.ts tests/chat-stream.test.ts tests/ui-redesign-source.test.ts
git commit -m "feat: report evidence coverage status"
```

---

## Task 4: Strict Model-Knowledge Fallback

**Files:**

- Create: `lib/model-knowledge.ts`
- Create: `tests/model-knowledge.test.ts`
- Modify: `lib/agent.ts`
- Modify: `tests/agent.test.ts`
- Modify: `lib/answer-prompt.ts` only if a shared boundary phrase is extracted

- [ ] **Step 1: Add the allow/deny matrix as failing tests**

The policy tests must include:

| Question | Category / scope | Expected |
|---|---|---|
| `雷电将军与雷电影是什么关系？` | character / relationship | allow |
| `冰之女皇领导谁？` | character / identity | allow |
| `婕德经历了怎样的成长？` | character / character_arc | deny |
| `讲讲婕德的完整剧情和结局` | story | deny |
| `爱可菲现在实装了吗？` | character / current_status | deny |
| `下个卡池是谁？` | character | deny |
| `爆料里说了什么？` | story | deny |
| `两人从未见过吗？` | character / relationship | deny |
| confirmed high-risk request | any | deny |

Also test parser rejection of wrong-language text, URL/source markers, empty paragraphs, more than four paragraphs, and malformed JSON.

- [ ] **Step 2: Implement a positive allowlist plus explicit denylists**

Adapt Direction B's independent API client, but make eligibility stricter:

```ts
export function canUseModelKnowledgeFallback(input: {
  question: string;
  category: QuestionCategory;
  intent: SearchIntent;
  storyScope?: StorySearchScope;
  confirmedHighRisk: boolean;
}) {
  if (input.confirmedHighRisk || input.storyScope === "character_arc") return false;
  if (!(["character", "story"] as QuestionCategory[]).includes(input.category)) return false;
  if (!(["identity", "relationship", "general"] as SearchIntent[]).includes(input.intent)) return false;
  if (!/(?:是谁|身份|属于|隶属|领导|什么关系|关系是|who\s+is|identity|belongs?\s+to|leads?|relationship)/iu.test(input.question)) {
    return false;
  }
  return ![
    timeSensitivePattern,
    leakPattern,
    categoricalNegativePattern,
    plotSummaryOrEndingPattern,
  ].some((pattern) => pattern.test(input.question));
}
```

Keep the response format `{ "paragraphs": [{ "text": "..." }] }`, language validation, no-URL/no-source-marker validation, proxy support, request cancellation, and a 45-second timeout. The system prompt must say this is a tentative answer from stable model knowledge, forbid current-release claims, exact dialogue, strong negatives, and fabricated citations.

- [ ] **Step 3: Integrate fallback only after accepted local and external evidence are both empty**

In `lib/agent.ts`, immediately before the existing `insufficient_evidence` return:

1. Exit directly if `options.signal?.aborted`.
2. Evaluate policy using `eventClassification`, `generated.searchPlan.intent`, `generated.searchPlan.storyScope`, and `options.confirmedHighRisk`.
3. Call `generateModelKnowledgeAnswer` only when allowed.
4. If generation succeeds, return an `answered` result with joined paragraphs, `answerMode: "limited_answer"`, empty claims/citations, `usedExternalSources: false`, `confidence: "low"`, and `verificationStatus: "model_knowledge"`.
5. If generation fails validation or the API fails, keep Direction A's current `insufficient_evidence` response.

Do not append the model result to an evidence-backed partial answer and do not let it fill missing Jeht stages.

- [ ] **Step 4: Add orchestrator tests with mocked API responses**

Add tests proving:

- zero-evidence Raiden relation returns `answered`, `model_knowledge`, low confidence, no citations;
- current implementation, character arc, ending, leak, and strong-negative questions never call the model-knowledge endpoint;
- abort prevents the fallback call;
- invalid model JSON returns the unchanged safe boundary;
- an accepted external citation always wins and model knowledge is not called.

- [ ] **Step 5: Run focused policy and orchestrator tests**

```powershell
npx vitest run tests/model-knowledge.test.ts tests/agent.test.ts tests/generation.test.ts tests/question-understanding.test.ts
npm run typecheck
```

Expected: PASS. Jeht remains evidence-only; Raiden demonstrates the bounded fallback.

- [ ] **Step 6: Commit Task 4**

```powershell
git add lib/model-knowledge.ts lib/agent.ts lib/answer-prompt.ts tests/model-knowledge.test.ts tests/agent.test.ts
git commit -m "feat: add bounded model knowledge fallback"
```

Omit `lib/answer-prompt.ts` if unchanged.

---

## Task 5: Fixed Capability Quality Gates and the Two Known Failures

**Files:**

- Modify: `data/evaluation.ts`
- Modify: `lib/evaluation.ts`
- Modify: `tests/evaluation-detail.test.ts`
- Modify: `tests/agent.test.ts`
- Modify: `tests/generation.test.ts` only if the local deterministic rendering needs correction
- Modify: `lib/generation.ts` only if the tests reveal local rendering defects

- [ ] **Step 1: Extend evaluation expectations beyond status and citation count**

Add optional fields:

```ts
expected: {
  status?: string;
  controlled?: boolean;
  external?: boolean;
  citation?: boolean;
  category?: string;
  verificationStatus?: VerificationStatus;
  mustIncludeAny?: string[];
  forbiddenAnswerTerms?: string[];
}
```

In `runEvaluation`, add checks:

```ts
verification:
  !testCase.expected.verificationStatus ||
  result.verificationStatus === testCase.expected.verificationStatus,
mustInclude:
  !testCase.expected.mustIncludeAny?.length ||
  testCase.expected.mustIncludeAny.some((term) => result.answer.includes(term)),
forbiddenAnswer:
  !(testCase.expected.forbiddenAnswerTerms ?? []).some((term) =>
    result.answer.toLowerCase().includes(term.toLowerCase()),
  ),
```

Return `verificationStatus`, `confidence`, and `answerMode` in each evaluation result for human review.

- [ ] **Step 2: Encode the two known Chinese quality contracts**

For `zh-catch-up`, require local controlled evidence and forbid terms representing the observed pollution: navigation/editing strings plus unrelated botany, food, and Remus material. Use the exact bad substrings captured in the previous evaluation output, not broad words that could reject legitimate prose.

For `layered-hint-zh`, require at least one of `观察`, `颜色`, `运动规律`, `能量`, or `顺序`; forbid the exact enemy/mechanics phrases previously observed; assert `answerMode: layered_hint` in the agent test.

- [ ] **Step 3: Add failing evaluation-detail and end-to-end agent tests**

Mock web/LLM functions so the tests demonstrate that the local sufficiency short circuit prevents polluted external content from entering either answer. Assert:

- Chinese catch-up citations are all controlled and answer text excludes every forbidden term.
- Generic Chinese puzzle help contains the local layered method and does not mention a named enemy.
- Both answers are `verified` only when their returned paragraphs cite final controlled citations.

- [ ] **Step 4: Fix deterministic local rendering only if tests fail**

Prefer using the existing controlled-entry summaries and `buildHints`. If the generic puzzle answer still reads like a refusal, add a gameplay-specific deterministic branch that renders the reviewed local entry plus the three existing hints. Do not search for or invent a specific mechanism when the user did not name one.

If catch-up still includes unrelated local entries, filter the deterministic input to the entries that caused the sufficiency decision rather than changing global retrieval ranking. Extend `LocalEvidenceDecision` with `entryIds: string[]` and use only those entries for the local response.

- [ ] **Step 5: Run the fixed suite through the evaluation API in test mode**

```powershell
npx vitest run tests/evaluation-detail.test.ts tests/agent.test.ts tests/generation.test.ts tests/local-evidence.test.ts
```

Expected: PASS, including explicit content assertions for the two previously failing Chinese cases.

- [ ] **Step 6: Commit Task 5**

```powershell
git add data/evaluation.ts lib/evaluation.ts lib/local-evidence.ts lib/generation.ts tests/evaluation-detail.test.ts tests/agent.test.ts tests/generation.test.ts tests/local-evidence.test.ts
git commit -m "fix: enforce fixed answer quality contracts"
```

Stage only files actually changed.

---

## Task 6: Cross-Architecture Regression, Live Acceptance, and Delivery Notes

**Files:**

- Create: `tests/answer-capability-integration.test.ts`
- Create: `docs/answer-capability-evaluation.md`
- Modify: `README.md` only if verification semantics are user-facing documentation
- Modify: `docs/superpowers/specs/2026-07-14-answer-capability-integration-design.md` only if implementation intentionally differs from the approved design

- [ ] **Step 1: Add one integration test file for the approved acceptance matrix**

`tests/answer-capability-integration.test.ts` must cover:

- Tsaritsa relation: local fact, `answered`, high confidence, `verified`, exactly one controlled same-language citation, zero external search.
- Jeht standard wording: classified `character_arc`; dirty/incomplete evidence returns the safe boundary and never `verified`.
- Jeht typo variant: same classification and safety behavior.
- Jeht clean four-stage fixture: `deep_story`, coherent cited answer, no navigation/list/transcript noise, verification derived from complete paragraph coverage.
- Raiden relation with all evidence routes empty: `model_knowledge`, low confidence, empty citations.
- current-release question with all evidence routes empty: no model-knowledge fallback.
- Chinese catch-up and generic mechanism hint: the exact content contracts from Task 5.

- [ ] **Step 2: Run the entire deterministic verification suite**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: all existing 338 Direction A tests plus new tests pass; typecheck exits 0; Next.js production build exits 0.

- [ ] **Step 3: Start a dedicated acceptance preview**

```powershell
npm run dev -- --port 3110
```

Keep this process in its own PowerShell window or hidden background process and record its PID. Confirm `http://localhost:3110` responds before live evaluation.

- [ ] **Step 4: Run the fixed 12-case evaluation against the real configured API**

```powershell
$fixed = Invoke-RestMethod -Method Post -Uri 'http://localhost:3110/api/evaluation' -ContentType 'application/json' -Body '{}'
$fixed | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 '.answer-capability-fixed-evaluation.json'
if ($fixed.passed -ne 12) { throw "Fixed capability evaluation failed: $($fixed.passed)/12" }
```

Expected: `12/12`. Inspect answer text as well as boolean checks.

- [ ] **Step 5: Repeat the three sensitive questions twice each**

POST the normal `chatRequestSchema` payload to `/api/chat` for:

1. `婕德经历了怎样的成长？`
2. the agreed typo variant used in unit tests
3. `冰之女皇与愚人众执行官之间是什么关系？`

Use `profile: "story"`, suitable progress, `spoilerPreference: "full"`, and the same confirmed-spoiler flow used by the UI for Jeht. Record status, answerMode, verificationStatus, confidence, citations, raw answer, elapsed milliseconds, and run number in `.answer-capability-sensitive-evaluation.json`.

Acceptance:

- both Tsaritsa runs are local, high-confidence, verified, fast, and semantically consistent;
- neither Jeht run contains navigation, page-title lists, unrelated entity dumps, or false verification;
- a clean live Jeht evidence set may answer, but incomplete live evidence must prefer the safe boundary;
- repeated runs do not switch between contradictory relationship claims.

- [ ] **Step 6: Perform visual UI inspection**

Open the answer page in the preview and verify:

- the restored `派蒙查到的线索` heading layout remains the new version;
- verification labels fit desktop and mobile widths;
- `model_knowledge` is visibly less authoritative than `verified`;
- answer text, citations, and inputs keep their existing readable colors;
- no label appears on refusal, spoiler-confirmation, or insufficient-evidence cards.

- [ ] **Step 7: Write the evaluation record**

Create `docs/answer-capability-evaluation.md` with:

- branch and commit SHAs;
- deterministic test/typecheck/build results;
- fixed evaluation score and duration;
- two-run table for Jeht, typo Jeht, and Tsaritsa;
- short human assessment of correctness, contamination, citation alignment, and stability;
- any known model/API limitation clearly separated from architecture defects.

Do not commit `.answer-capability-*.json` raw artifacts unless explicitly requested; summarize them in the document.

- [ ] **Step 8: Commit Task 6**

```powershell
git add tests/answer-capability-integration.test.ts README.md
git add -f docs/answer-capability-evaluation.md docs/superpowers/specs/2026-07-14-answer-capability-integration-design.md
git commit -m "test: lock answer capability integration"
```

Stage only changed files. Omit README/spec paths if unchanged.

- [ ] **Step 9: Final repository checks and push**

```powershell
git status --short
git log --oneline --decorate -8
git diff --check HEAD~6..HEAD
git push -u origin codex/answer-capability-integration
```

Expected: no unintended tracked files, one focused commit per functional task, no whitespace errors, and successful upstream push. If a transient `Recv failure: Connection was reset` occurs, retry briefly before reporting the exact handoff command.

## Final Success Checklist

- [ ] Direction A's complete existing test suite is still green.
- [ ] Fixed evaluation is 12/12 with answer-text quality checks.
- [ ] Tsaritsa is answered from the reviewed local fact with no web dependency.
- [ ] Jeht standard and typo questions never emit navigation/list garbage or false `verified`.
- [ ] Search backend failure and cancellation are isolated and diagnosed.
- [ ] `verified`, `partially_verified`, and `model_knowledge` match their approved semantics.
- [ ] Current-release, leak, ending, character-arc, and strong-negative questions cannot use model knowledge.
- [ ] Restored clue-heading UI remains intact.
- [ ] Every feature has its own commit and the branch is pushed.
