# Answer Retrieval Architecture Design

## Problem

PAIMON can currently refuse ordinary lore questions even when the configured DeepSeek model knows the answer. The reproduced question, “冰之女皇与愚人众执行官之间是什么关系？”, exposes three interacting defects:

1. Local retrieval applies spoiler policy to whole entries. A level-two entry that contains both basic organizational facts and deeper lore is fully hidden for a low-spoiler player, so the safe fact is lost with the spoiler.
2. Relationship search expands into many broad queries and depends on brittle HTML search providers. Low-quality reposts, snippets, and video titles can outnumber game-text references, while a transient provider failure can leave no evidence at all.
3. The final agent treats zero retained citations as a reason not to answer. It returns a canned insufficient-evidence response even for stable, low-risk lore that the model can answer correctly from existing knowledge.

The isolated model call confirmed that `deepseek-v4-flash` can state the basic relationship correctly. The primary failure is therefore orchestration, not baseline model capability.

## Goals

- Answer ordinary, stable Genshin lore questions instead of refusing whenever live retrieval is temporarily empty.
- Preserve evidence grounding and visible uncertainty without letting low-quality search snippets drive factual conclusions.
- Keep low-spoiler players able to receive basic non-spoiler facts while filtering the deeper claims stored nearby.
- Make search backends replaceable and independently observable, following Agent Reach's capability-layer idea without adding its desktop CLI as a production dependency.
- Improve broad answer quality through representative regression coverage, not a one-question special case.
- Preserve existing language selection, spoiler confirmation, citation rendering, resource recommendations, and event recording.

## Non-goals

- Installing or invoking Agent Reach, `mcporter`, Exa MCP, or browser login tools from the deployed Next.js application.
- Adding a paid or newly keyed search service in this change.
- Rebuilding the entire knowledge base or automatically scraping every Genshin website.
- Allowing unverified model memory to decide release dates, current implementation status, leaks, or categorical absence claims.
- Exposing technical backend failures or private reasoning in the player-facing trace.

## Chosen Approach

Build a lightweight search capability layer around the sources already present in the repository. Retrieval proceeds from atomic local knowledge to high-value direct providers and only then to general web discovery. Each backend returns a normalized attempt record, failures are isolated, and evidence is fused before generation. If all usable evidence is unavailable, stable low-risk lore may use a clearly labeled model-knowledge answer rather than the current empty refusal.

This approach sits between a narrow patch and a managed-search integration. It fixes the architecture now while leaving a clean adapter boundary for a future Exa, Tavily, or other search provider.

## Architecture

```text
question
  -> question understanding and risk classification
  -> atomic local retrieval
  -> staged search router
       1. direct wiki / game-text providers
       2. general web discovery when evidence is still insufficient
  -> evidence normalization, enrichment, and fusion
  -> answer strategy
       verified evidence answer
       partially verified answer
       model-knowledge fallback
  -> answer validation, citations, confidence, and visible verification label
```

### 1. Atomic local evidence

Stable organizational and identity facts must be stored separately from deeper story interpretation. The Tsaritsa/Harbinger relationship will be represented as a low-spoiler faction fact rather than inferred from a level-two entry about the Tsaritsa's undisclosed plan.

Local retrieval will continue to filter by spoiler level, but it will operate over entries whose scope matches one claim. A relationship query may therefore retain “the Tsaritsa leads the Fatui and the Harbingers carry out its missions” while still hiding later story developments.

The entry must include both Chinese and English names and enough aliases to match group entities such as “愚人众执行官”, “执行官”, “Harbingers”, and “Fatui Harbingers”. It must cite a stable game-text or curated reference anchor and must not claim that every Harbinger has identical motives or personal loyalty.

### 2. Search capability layer

Search backends implement a small common contract:

```ts
interface SearchBackend {
  id: string;
  tier: "direct_reference" | "general_web";
  search(request: SearchBackendRequest): Promise<SearchBackendResult>;
}

interface SearchBackendResult {
  backendId: string;
  status: "ok" | "empty" | "timeout" | "error";
  citations: Citation[];
  durationMs: number;
}
```

The router owns ordering, time budgets, failure isolation, and stopping conditions. Backends only retrieve candidates. The initial adapters wrap the existing MediaWiki/reference path and the current general web engines; no desktop-only executable becomes a runtime dependency.

The first stage runs direct reference sources. The second stage runs only when the first stage plus local evidence cannot answer the detected intent. A single failing backend becomes an attempt with `timeout` or `error`; it never rejects the whole search operation.

Relationship searches must use a small bounded query set that includes both entities. They must not always issue the current long list of broad site-restricted queries. General queries are added deliberately and capped by the router's request budget.

### 3. Evidence normalization and fusion

Search-result titles and snippets are discovery clues, not automatically answer-bearing evidence. Candidates must pass the following stages:

1. Normalize URL, source identity, language, entities, and content type.
2. Enrich selected candidates with readable page content when possible.
3. Reject navigation fragments, promotional listings, unrelated pages, and candidates that lose the requested entity anchors.
4. Rank by source authority, exact entity coverage, content relevance, concrete interaction signals, and agreement across independent URLs.
5. Preserve quotas for game-text references or trusted curated references before lower-authority community material.

Community analysis may supply context and discovery terms but cannot alone support an official attribution or a strong factual lead. Multiple copies of the same article count as one evidence family, not independent corroboration.

The fusion output includes both selected citations and a summary of backend attempts so the answer layer can distinguish “nothing exists” from “all providers failed”.

### 4. Answer strategies

`ChatResult` gains a verification state:

```ts
type VerificationStatus =
  | "verified"
  | "partially_verified"
  | "model_knowledge";
```

- `verified`: the central answer is supported by local controlled evidence or retained high-quality external evidence.
- `partially_verified`: available evidence supports only part of the answer; unsupported interpretation is excluded or stated as uncertain.
- `model_knowledge`: all usable evidence paths are empty or unavailable, but the question is stable, low-risk lore and the configured model can provide a bounded answer from existing knowledge.

The model-knowledge fallback uses a separate prompt. It must:

- state the direct answer first;
- distinguish widely established setting from uncertainty;
- avoid citations because none were verified;
- avoid precise quotes, release claims, and categorical negative claims;
- return structured JSON using DeepSeek's supported JSON response format;
- carry low confidence and `model_knowledge` status to the UI.

Model-knowledge fallback is forbidden for current-version status, release timing, leaks, safety refusals, and claims that a character, quest, relationship, or event does not exist. Those cases retain an explicit limited-evidence response.

The old canned insufficient-evidence answer remains only for questions that are unsafe to answer from model knowledge or when the model request itself fails.

### 5. Player-facing presentation

The answer card preserves the current in-world evidence language. Verification status appears as a compact note:

- verified: existing clue/source presentation;
- partially verified: “现有线索只核实了部分内容”；
- model knowledge: “这次没能完成来源核验，以下为派蒙依据已有知识整理的暂定回答”。

The UI must not present internal provider names, stack traces, raw queries, or exception messages. Technical attempt data remains available to tests and server-side diagnostics.

### 6. Observability and failure handling

The visible trace may say that multiple routes were tried and whether usable clues were found. Server-side data records backend id, status, duration, and result count without storing credentials or full private reasoning.

Timeouts are bounded per backend and for the overall search. Search completion must not wait for optional reading recommendations. If the request is aborted, outstanding provider work stops and no later fallback call is started.

## Testing Strategy

### Unit tests

- Low-spoiler retrieval retains the atomic Tsaritsa/Harbinger organizational fact.
- Search-router tests cover ordered tiers, early stopping, timeout isolation, empty results, deduplication, and deterministic fusion.
- Evidence tests reject snippets and duplicate reposts as independent corroboration.
- Model-knowledge eligibility tests allow stable lore and reject current-status, release, leak, and unsupported-negative questions.
- Generation tests verify structured fallback output, no fabricated citations, low confidence, and the visible verification label.

### Regression evaluation set

Add representative Chinese and English questions across:

- faction relationship;
- two-character relationship;
- character identity;
- story synopsis;
- gameplay guidance;
- current implementation status;
- no-search-result fallback;
- low-spoiler versus full-spoiler profiles.

Each case asserts required concepts, prohibited claims, verification status, and citation behavior. Network behavior is mocked for deterministic CI; a smaller live smoke set is run manually before delivery.

### Final verification

- Focused Vitest suites for each feature commit.
- Full `npm test`.
- `npm run typecheck`.
- `npm run build`.
- Real local API checks for the reported Tsaritsa/Harbinger question under low-spoiler defaults and at least three unrelated questions.
- `git diff --check` and scoped status review before push.

## Commit Boundaries

1. `docs: design answer retrieval architecture`
2. `fix: preserve spoiler-safe faction evidence`
3. `feat: add resilient search capability routing`
4. `feat: add model-knowledge answer fallback`
5. `test: add answer architecture regression coverage`

Each implementation commit must leave its focused tests passing. The final branch is pushed only after the complete validation suite passes.

## Risks and Mitigations

- **Model fallback sounds too certain:** separate prompt, low confidence, explicit verification label, and eligibility restrictions.
- **Search refactor changes existing ranking:** adapter-level tests preserve current useful cases while router tests lock the new tier behavior.
- **More metadata leaks into the UI:** keep diagnostic attempt records server-side and map them to short in-world trace messages.
- **Stable fact duplicates deeper lore:** keep facts atomic and reuse source anchors without copying interpretive claims.
- **Provider changes break scraping:** isolate adapters so a backend can be replaced or reordered without changing retrieval or generation.
