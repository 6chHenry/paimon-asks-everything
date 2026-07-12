# Preheat Personalized Traveler Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the preheat region dropdown with direct region buttons and make every region, profile, and focus combination deterministically change the preheat result presentation.

**Architecture:** Keep progress and depth as the hard spoiler filter, then run the already-visible entries, timeline nodes, graphs, and questions through a pure personalization module. The API returns one stable presentation contract; the page consumes that contract for section order, limits, default timeline/graph focus, and follow-up questions without duplicating scoring logic in React.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, Zod 4, Vitest 3, existing CSS design system.

## Global Constraints

- Use deterministic rules only; do not call an AI model.
- Progress and `PreheatDepth` remain the only mechanisms that unlock content.
- Profile and focus may reorder or limit visible content but must never reveal a locked entry.
- Keep profile single-select and focus multi-select with at least one active value.
- Refresh an open result immediately after any progress, profile, or focus change.
- Keep the previous successful result visible while a replacement request is loading or fails.
- Show the active combination only in the settings area; do not add a personalized introduction to the result area.
- Preserve Chinese and English labels and existing local-storage preferences.
- Do not add dependencies or unrelated refactors.

---

## File Map

- Create `lib/preheat-personalization.ts`: pure profile/focus scoring, stable question ranking, limits, section order, and default timeline/relation selection.
- Create `tests/preheat-personalization.test.ts`: focused tests for deterministic combination differences and spoiler-safe fallbacks.
- Create `components/progress-button-group.tsx`: accessible direct region selector used by the preheat settings card.
- Modify `lib/schemas.ts`: parse and validate comma-separated preheat focus values.
- Modify `lib/preheat.ts`: apply personalization after visibility filtering and expose the presentation contract.
- Modify `app/preheat/page.tsx`: send focus, render direct region buttons, keep stale results during refresh, retry failures, and consume presentation defaults/order.
- Modify `components/home-intel.tsx`: expose a complete profile/progress/focus combination summary and add `aria-pressed` to focus buttons.
- Modify `components/relation-map.tsx`: accept and synchronize a server-selected default relation node.
- Modify `app/globals.css`: region button grid, combination summary, refresh status, dynamic workbench orders, responsive rules, and focus visibility.
- Modify `tests/preheat.test.ts`: integration assertions for personalized preheat views and preserved spoiler gates.
- Modify `tests/preheat-route.test.ts`: focus query parsing, defaults, and invalid-value rejection.
- Modify `tests/ui-redesign-source.test.ts`: source-level guards for direct region buttons and the absence of a preheat progress `<select>`.

---

### Task 1: Build the Pure Personalization Rules

**Files:**
- Create: `lib/preheat-personalization.ts`
- Create: `tests/preheat-personalization.test.ts`

**Interfaces:**
- Consumes: `Profile`, `Focus[]`, `Progress`, `PreheatDepth`, already-visible `KnowledgeEntry[]`, localized timeline candidates, and localized relation graphs.
- Produces: `rankPreheatEntries`, `rankSuggestedQuestions`, and `buildPreheatPresentation`.
- Produces type: `PreheatPresentation` with `sectionOrder`, `collapsedSections`, `narrationLimit`, `eventLimit`, `implicationLimit`, `questionLimit`, `defaultTimelineId`, `defaultRelationGraphId`, and `defaultRelationNodeId`.

- [ ] **Step 1: Write failing rule tests**

Create `tests/preheat-personalization.test.ts` with concrete fixtures and these assertions:

```ts
import { describe, expect, it } from "vitest";
import {
  buildPreheatPresentation,
  rankPreheatEntries,
  rankSuggestedQuestions,
} from "@/lib/preheat-personalization";
import type { KnowledgeEntry } from "@/lib/domain";

const query = {
  topicId: "seven-gnosis-journeys",
  depth: "guided" as const,
  language: "zh-CN" as const,
  profile: "returning" as const,
  progress: "sumeru" as const,
  spoilerPreference: "low" as const,
  focus: ["story"] as const,
};

const timeline = [
  { id: "mondstadt-gnosis", region: "mondstadt" as const, locked: false, relationGraphId: "mondstadt", participantIds: ["venti"] },
  { id: "sumeru-gnoses", region: "sumeru" as const, locked: false, relationGraphId: "sumeru", participantIds: ["nahida", "dottore"] },
  { id: "fontaine-gnosis", region: "fontaine" as const, locked: true, relationGraphId: "fontaine", participantIds: ["arlecchino"] },
];

const graphs = {
  sumeru: { id: "sumeru", nodes: [{ id: "nahida" }, { id: "dottore" }] },
};

const entry = (id: string, contentType: KnowledgeEntry["contentType"], tags: string[]) =>
  ({ id, conceptId: id, contentType, tags } as KnowledgeEntry);

describe("preheat personalization", () => {
  it("gives profiles visibly different presentation contracts", () => {
    const newcomer = buildPreheatPresentation({ ...query, profile: "new" }, timeline, graphs);
    const story = buildPreheatPresentation({ ...query, profile: "story" }, timeline, graphs);
    const casual = buildPreheatPresentation({ ...query, profile: "casual" }, timeline, graphs);

    expect(newcomer.defaultTimelineId).toBe("mondstadt-gnosis");
    expect(story.narrationLimit).toBeGreaterThan(casual.narrationLimit);
    expect(story.sectionOrder).not.toEqual(newcomer.sectionOrder);
    expect(casual.collapsedSections).toEqual(["timeline", "relations"]);
  });

  it("never selects a locked timeline node as the default", () => {
    const result = buildPreheatPresentation(query, timeline, graphs);
    expect(result.defaultTimelineId).toBe("sumeru-gnoses");
    expect(result.defaultTimelineId).not.toBe("fontaine-gnosis");
  });

  it("uses character focus to choose a visible participant", () => {
    const result = buildPreheatPresentation(
      { ...query, profile: "story", focus: ["character"] },
      timeline,
      graphs,
    );
    expect(result.defaultRelationGraphId).toBe("sumeru");
    expect(["nahida", "dottore"]).toContain(result.defaultRelationNodeId);
  });

  it("ranks focus content deterministically regardless of click order", () => {
    const entries = [
      entry("story", "story", ["gnosis"]),
      entry("character", "character", ["fatui"]),
      entry("overview", "version_overview", ["unknown"]),
    ];
    const first = rankPreheatEntries(entries, { ...query, focus: ["character", "story"] });
    const second = rankPreheatEntries(entries, { ...query, focus: ["story", "character"] });
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
  });

  it("ranks character and overview questions differently", () => {
    const questions = [
      "纳西妲为什么与博士谈判？",
      "须弥节点怎样改变整个事件链？",
      "这一版本最需要知道什么？",
    ];
    expect(rankSuggestedQuestions(questions, ["character"], "story")[0]).toContain("纳西妲");
    expect(rankSuggestedQuestions(questions, ["overview"], "casual")[0]).toContain("版本");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm test -- tests/preheat-personalization.test.ts
```

Expected: FAIL because `@/lib/preheat-personalization` does not exist.

- [ ] **Step 3: Implement the pure rule module**

Create `lib/preheat-personalization.ts` with these public contracts and fixed rule tables:

```ts
import type {
  Focus,
  KnowledgeEntry,
  PreheatDepth,
  Profile,
  Progress,
} from "@/lib/domain";

export type PreheatSection = "timeline" | "brief" | "relations";

export interface PersonalizationQuery {
  profile: Profile;
  progress: Progress;
  depth: PreheatDepth;
  focus: readonly Focus[];
}

export interface PersonalizationTimelineItem {
  id: string;
  region: Progress;
  locked: boolean;
  relationGraphId: string;
  participantIds: string[];
}

export interface PersonalizationGraph {
  id: string;
  nodes: Array<{ id: string }>;
}

export interface PreheatPresentation {
  sectionOrder: [PreheatSection, PreheatSection, PreheatSection];
  collapsedSections: PreheatSection[];
  narrationLimit: number;
  eventLimit: number;
  implicationLimit: number;
  questionLimit: number;
  defaultTimelineId?: string;
  defaultRelationGraphId?: string;
  defaultRelationNodeId?: string;
}

const focusOrder: Focus[] = ["story", "character", "gameplay", "overview"];
const profileRules: Record<Profile, Pick<PreheatPresentation,
  "sectionOrder" | "collapsedSections" | "narrationLimit" | "eventLimit" | "implicationLimit" | "questionLimit"
>> = {
  new: { sectionOrder: ["timeline", "brief", "relations"], collapsedSections: ["relations"], narrationLimit: 5, eventLimit: 1, implicationLimit: 0, questionLimit: 2 },
  returning: { sectionOrder: ["timeline", "brief", "relations"], collapsedSections: [], narrationLimit: 6, eventLimit: 2, implicationLimit: 1, questionLimit: 3 },
  story: { sectionOrder: ["brief", "timeline", "relations"], collapsedSections: [], narrationLimit: 10, eventLimit: 3, implicationLimit: 3, questionLimit: 3 },
  exploration: { sectionOrder: ["relations", "timeline", "brief"], collapsedSections: ["brief"], narrationLimit: 6, eventLimit: 2, implicationLimit: 1, questionLimit: 3 },
  casual: { sectionOrder: ["brief", "timeline", "relations"], collapsedSections: ["timeline", "relations"], narrationLimit: 3, eventLimit: 1, implicationLimit: 0, questionLimit: 2 },
};

function normalizedFocus(focus: readonly Focus[]) {
  const selected = new Set(focus);
  return focusOrder.filter((item) => selected.has(item));
}

function entryScore(entry: KnowledgeEntry, focus: readonly Focus[], profile: Profile) {
  const scores: Record<Focus, number> = {
    story: entry.contentType === "story" ? 8 : 0,
    character: entry.contentType === "character" ? 8 : 0,
    gameplay: entry.tags.some((tag) => ["world", "artifact-text", "item-text"].includes(tag)) ? 8 : 0,
    overview: entry.contentType === "version_overview" ? 8 : 0,
  };
  const focusScore = normalizedFocus(focus).reduce((sum, item, index) => sum + scores[item] * (4 - index), 0);
  const profileScore = profile === "new" && entry.tags.includes("definition") ? 12
    : profile === "story" && entry.factStatus === "narrative_implied" ? 6
    : profile === "casual" && entry.contentType === "version_overview" ? 6
    : 0;
  return focusScore + profileScore;
}

export function rankPreheatEntries(entries: KnowledgeEntry[], query: PersonalizationQuery) {
  return entries
    .map((entry, index) => ({ entry, index, score: entryScore(entry, query.focus, query.profile) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ entry }) => entry);
}

function questionScore(question: string, focus: Focus) {
  const patterns: Record<Focus, RegExp> = {
    story: /为什么|如何|因果|伏笔|事件链|why|how|thread/i,
    character: /谁|人物|角色|神子|纳西妲|博士|女士|仆人|队长|who|character|Venti|Dottore|Arlecchino|Capitano/i,
    gameplay: /探索|世界|场景|文本|玩法|explor|world|gameplay|text/i,
    overview: /版本|整体|变化|起点|衔接|说明|version|overall|change|starting point/i,
  };
  return patterns[focus].test(question) ? 10 : 0;
}

export function rankSuggestedQuestions(questions: string[], focus: readonly Focus[], profile: Profile) {
  const orderedFocus = normalizedFocus(focus);
  return questions
    .map((question, index) => ({
      question,
      index,
      score: orderedFocus.reduce((sum, item, focusIndex) => sum + questionScore(question, item) * (4 - focusIndex), 0)
        + (profile === "casual" && question.length < 28 ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ question }) => question);
}

export function buildPreheatPresentation(
  query: PersonalizationQuery,
  timeline: PersonalizationTimelineItem[],
  graphs: Record<string, PersonalizationGraph>,
): PreheatPresentation {
  const unlocked = timeline.filter((item) => !item.locked);
  const defaultTimeline = query.profile === "new" ? unlocked[0] : unlocked.at(-1);
  const defaultGraph = defaultTimeline ? graphs[defaultTimeline.relationGraphId] : undefined;
  const participantIds = new Set(defaultTimeline?.participantIds ?? []);
  const defaultNode = query.focus.includes("character")
    ? defaultGraph?.nodes.find((node) => participantIds.has(node.id))
    : defaultGraph?.nodes[0];
  const limits = profileRules[query.profile];
  return {
    ...limits,
    narrationLimit: Math.min(limits.narrationLimit + (query.depth === "research" ? 2 : 0), 12),
    implicationLimit: query.depth === "guided" ? 0 : limits.implicationLimit,
    defaultTimelineId: defaultTimeline?.id,
    defaultRelationGraphId: defaultTimeline?.relationGraphId,
    defaultRelationNodeId: defaultNode?.id,
  };
}
```

- [ ] **Step 4: Run the rule tests**

Run `npm test -- tests/preheat-personalization.test.ts`.

Expected: PASS with 5 tests.

- [ ] **Step 5: Commit the rule engine**

```powershell
git add lib/preheat-personalization.ts tests/preheat-personalization.test.ts
git commit -m "feat: add deterministic preheat personalization rules"
```

---

### Task 2: Extend the API Contract and Personalize the Curated View

**Files:**
- Modify: `lib/schemas.ts`
- Modify: `lib/preheat.ts`
- Modify: `tests/preheat.test.ts`
- Modify: `tests/preheat-route.test.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `PreheatQuery.focus: Focus[]` and `PreheatView.presentation: PreheatPresentation`.
- Produces: each localized timeline item includes `participantIds` and already-ranked, limited `suggestedQuestions`, `events`, and `implications`.

- [ ] **Step 1: Add failing schema and integration assertions**

Add to `tests/preheat-route.test.ts`:

```ts
it("accepts multiple focus values and returns a presentation contract", async () => {
  const response = await GET(new Request(
    "http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=zh-CN&profile=story&progress=sumeru&spoilerPreference=low&focus=character,story",
  ));
  const payload = await response.json() as {
    presentation: { defaultTimelineId?: string; sectionOrder: string[] };
  };
  expect(response.status).toBe(200);
  expect(payload.presentation.defaultTimelineId).toBe("sumeru-gnoses");
  expect(payload.presentation.sectionOrder).toEqual(["brief", "timeline", "relations"]);
});

it("rejects an invalid focus value", async () => {
  const response = await GET(new Request(
    "http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=en&focus=story,secrets",
  ));
  expect(response.status).toBe(400);
});

it("uses stable default focuses when focus is omitted", async () => {
  const response = await GET(new Request(
    "http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=en",
  ));
  expect(response.status).toBe(200);
  expect((await response.json()).presentation).toBeDefined();
});
```

Add to `tests/preheat.test.ts`:

```ts
it("changes presentation by profile without changing spoiler locks", () => {
  const newcomer = getPreheatView({ ...base, depth: "guided", progress: "sumeru", profile: "new", focus: ["story"] });
  const story = getPreheatView({ ...base, depth: "guided", progress: "sumeru", profile: "story", focus: ["character"] });
  expect(newcomer.presentation).not.toEqual(story.presentation);
  expect(newcomer.timeline.find((node) => node.id === "fontaine-gnosis")?.locked).toBe(true);
  expect(story.timeline.find((node) => node.id === "fontaine-gnosis")?.locked).toBe(true);
});

it("keeps multi-focus output stable regardless of query order", () => {
  const first = getPreheatView({ ...base, depth: "research", focus: ["character", "story"] });
  const second = getPreheatView({ ...base, depth: "research", focus: ["story", "character"] });
  expect(first.narration.points).toEqual(second.narration.points);
  expect(first.timeline.map((node) => node.suggestedQuestions)).toEqual(
    second.timeline.map((node) => node.suggestedQuestions),
  );
});
```

Update the shared `base` fixture to include `focus: ["story", "overview"] as Array<"story" | "overview">` so direct `getPreheatView` calls satisfy the mutable schema output type.

- [ ] **Step 2: Run the API and preheat tests to verify failure**

Run:

```powershell
npm test -- tests/preheat.test.ts tests/preheat-route.test.ts
```

Expected: FAIL because `focus` is not parsed and `presentation` is missing.

- [ ] **Step 3: Parse a stable focus list in `lib/schemas.ts`**

Add a shared enum and extend `preheatQuerySchema`:

```ts
const focusValueSchema = z.enum(["story", "character", "gameplay", "overview"]);

const preheatFocusSchema = z.preprocess(
  (value) => typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : value,
  z.array(focusValueSchema).min(1).max(4),
).default(["story", "overview"]);

// Inside preheatQuerySchema:
focus: preheatFocusSchema,
```

Keep the chat request schema behavior unchanged; reuse `focusValueSchema` for its array items.

- [ ] **Step 4: Apply rules after visibility filtering in `lib/preheat.ts`**

Import the Task 1 functions. In `localizeTimelineNode`, project `participantIds` while retaining the complete visible candidates; ranking and limits are applied after the presentation contract is available:

```ts
const title = locked
  ? query.language === "zh-CN"
    ? "该地区主线事件已锁定"
    : "Regional main-quest event locked"
  : query.language === "zh-CN"
    ? node.titleZh
    : node.titleEn;

return {
  id: node.id,
  region: node.region,
  participantIds: node.participantIds,
  title,
  locked,
  suggestedQuestions:
    query.language === "zh-CN"
      ? node.suggestedQuestionsZh
      : node.suggestedQuestionsEn,
  events: visibleEvents,
  implications,
  relationGraphId: node.relationGraphId,
};
```

In `getPreheatView`, preserve the current visibility filters, then use this exact sequence:

```ts
const rankedEntries = rankPreheatEntries(entries, query);
const localizedGraphs = Object.fromEntries(
  [graph.id, ...timeline.map((node) => node.relationGraphId)].map((id) => {
    const target = relationGraphs.find((item) => item.id === id)!;
    return [id, localizeGraph(target, query.language, query, { allowFutureRegions })];
  }),
);
const presentation = buildPreheatPresentation(query, timeline, localizedGraphs);
const personalizedTimeline = timeline.map((node) => ({
  ...node,
  events: node.events.slice(0, presentation.eventLimit),
  implications: node.implications.slice(0, presentation.implicationLimit),
  suggestedQuestions: rankSuggestedQuestions(node.suggestedQuestions, query.focus, query.profile)
    .slice(0, presentation.questionLimit),
}));
```

Return `presentation`, use `rankedEntries.slice(0, presentation.narrationLimit)` in `buildNarration`, return `personalizedTimeline`, and reuse `localizedGraphs`. Limits are applied only after `presentation` exists, preserving a single rule source.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```powershell
npm test -- tests/preheat-personalization.test.ts tests/preheat.test.ts tests/preheat-route.test.ts
npm run typecheck
```

Expected: all focused tests PASS and TypeScript exits with code 0.

- [ ] **Step 6: Commit the API integration**

```powershell
git add lib/schemas.ts lib/preheat.ts tests/preheat.test.ts tests/preheat-route.test.ts
git commit -m "feat: personalize preheat view by traveler context"
```

---

### Task 3: Replace the Region Dropdown and Show the Active Combination

**Files:**
- Create: `components/progress-button-group.tsx`
- Modify: `app/preheat/page.tsx`
- Modify: `components/home-intel.tsx`
- Modify: `app/globals.css`
- Modify: `tests/ui-redesign-source.test.ts`

**Interfaces:**
- Consumes: `Progress`, localized `progressItems`, current `focus`, and preference callbacks.
- Produces: `ProgressButtonGroup({ items, value, onChange })`.
- Produces: `TravelerContextDrawer` summary containing profile, progress, and selected focus labels.

- [ ] **Step 1: Add failing UI source guards**

Extend the existing preheat source test in `tests/ui-redesign-source.test.ts`:

```ts
expect(page).toContain("ProgressButtonGroup");
expect(page).toContain("preferences.focus.join(\",\")");
expect(page).not.toContain("<select\n            value={preferences.progress}");
expect(source("components", "progress-button-group.tsx")).toContain("aria-pressed");
expect(source("components", "progress-button-group.tsx")).toContain("progress-button-grid");
expect(css).toContain(".progress-button-grid");
expect(css).toContain(".traveler-context-summary");
```

- [ ] **Step 2: Run the source test and verify failure**

Run `npm test -- tests/ui-redesign-source.test.ts`.

Expected: FAIL because `ProgressButtonGroup` does not exist.

- [ ] **Step 3: Create the accessible region button component**

Create `components/progress-button-group.tsx`:

```tsx
import type { Progress } from "@/lib/domain";

export function ProgressButtonGroup({
  items,
  value,
  onChange,
}: {
  items: Array<{ value: Progress; label: string }>;
  value: Progress;
  onChange: (value: Progress) => void;
}) {
  return (
    <div className="progress-button-grid" role="group" aria-label="Main quest progress">
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          className={item.value === value ? "progress-button active" : "progress-button"}
          aria-pressed={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Replace only the preheat dropdown and serialize focus**

In `app/preheat/page.tsx`, import `ProgressButtonGroup`, replace the existing `<select>` block with:

```tsx
<div className="preheat-progress-control">
  <span>{t(language, "选择你最新完成的地区主线", "Choose the latest region main quest you completed")}</span>
  <ProgressButtonGroup
    items={progressItems}
    value={preferences.progress}
    onChange={(progress) => setPreferences((current) => ({ ...current, progress }))}
  />
</div>
```

Add focus to the API query with stable enum order already held by preferences:

```ts
focus: preferences.focus.join(","),
```

Add `preferences.focus` to the load effect dependencies.

- [ ] **Step 5: Expand the settings summary and button semantics**

In `components/home-intel.tsx`, replace the current summary `<small>` with:

```tsx
<small className="traveler-context-summary">
  {labels.progress[progress][language]} · {labels.profile[profile][language]} ·{" "}
  {focus.map((item) => labels.focus[item][language]).join(" / ")}
</small>
```

Add `aria-pressed={focus.includes(item)}` to each focus pill. Do not add any equivalent summary or introduction in the result area.

- [ ] **Step 6: Add region and summary styles**

Add to the preheat settings section of `app/globals.css`:

```css
.preheat-progress-control { display: flex; flex-direction: column; gap: 9px; }
.preheat-progress-control > span { color: var(--ink-soft); font-size: 10px; font-weight: 800; letter-spacing: .08em; }
.progress-button-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.progress-button {
  min-height: 42px; padding: 7px 8px; border: 1px solid rgba(42,57,63,.18); border-radius: 3px;
  background: rgba(255,248,234,.72); color: var(--ink); cursor: pointer; font-size: 11px; line-height: 1.25;
}
.progress-button:hover { border-color: var(--gold); }
.progress-button.active { border-color: var(--navy); background: var(--navy); color: white; box-shadow: inset 3px 0 0 var(--gold); font-weight: 800; }
.progress-button:focus-visible, .pill:focus-visible, .choice:focus-visible { outline: 3px solid rgba(58,126,154,.38); outline-offset: 2px; }
.traveler-context-summary { max-width: 62%; overflow-wrap: anywhere; text-align: right; }
```

Under `@media (max-width: 640px)`, add:

```css
.progress-button-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.traveler-context-summary { max-width: none; text-align: left; }
```

- [ ] **Step 7: Run focused UI tests and typecheck**

Run:

```powershell
npm test -- tests/ui-redesign-source.test.ts
npm run typecheck
```

Expected: PASS and exit code 0.

- [ ] **Step 8: Commit the direct selector**

```powershell
git add components/progress-button-group.tsx app/preheat/page.tsx components/home-intel.tsx app/globals.css tests/ui-redesign-source.test.ts
git commit -m "feat: add direct preheat region controls"
```

---

### Task 4: Consume the Presentation Contract with Safe Live Refresh

**Files:**
- Modify: `app/preheat/page.tsx`
- Modify: `components/relation-map.tsx`
- Modify: `app/globals.css`
- Modify: `tests/ui-redesign-source.test.ts`

**Interfaces:**
- Consumes: `data.presentation` from Task 2.
- Changes: `RelationMap` accepts optional `selectedNodeId` while preserving `onNodeSelect`.
- Produces: `data-section-order` on the workbench, accessible per-section expand/collapse controls, and a retryable inline refresh status.

- [ ] **Step 1: Add failing integration source guards**

Add to the preheat UI source test:

```ts
expect(page).toContain("data.presentation.defaultTimelineId");
expect(page).toContain("data-section-order");
expect(page).toContain("collapsedSections");
expect(page).toContain("aria-expanded");
expect(page).toContain("preheat-refresh-status");
expect(page).toContain("setReloadKey");
expect(page).not.toContain("个性化导语");
expect(source("components", "relation-map.tsx")).toContain("selectedNodeId");
```

- [ ] **Step 2: Run the source test and verify failure**

Run `npm test -- tests/ui-redesign-source.test.ts`.

Expected: FAIL because presentation defaults and refresh hooks are not consumed.

- [ ] **Step 3: Synchronize the selected relation node**

Change `RelationMap` to accept `selectedNodeId?: string`. Rename its local state to `localSelectedNodeId`, and synchronize it whenever the graph or server default changes:

```tsx
const [localSelectedNodeId, setLocalSelectedNodeId] = useState(selectedNodeId);

useEffect(() => {
  setLocalSelectedNodeId(selectedNodeId);
}, [graph.id, selectedNodeId]);

const selectedNode = useMemo(
  () => graph.nodes.find((node) => node.id === localSelectedNodeId) ?? graph.nodes[0],
  [graph.nodes, localSelectedNodeId],
);
```

Import `useEffect`, and update the click handler to call `setLocalSelectedNodeId(node.id)`.

- [ ] **Step 4: Apply presentation defaults only when a new response arrives**

In the successful load branch of `app/preheat/page.tsx`, replace `firstAvailable` selection with:

```ts
setData(next);
setSelectedTimelineId(next.presentation.defaultTimelineId);
setGraphId(next.presentation.defaultRelationGraphId ?? next.relationGraph.id);
setExpandedSections(
  next.presentation.sectionOrder.filter(
    (section) => !next.presentation.collapsedSections.includes(section),
  ),
);
```

Pass `selectedNodeId={data.presentation.defaultRelationNodeId}` to `RelationMap`.

- [ ] **Step 5: Preserve stale data and add retry state**

Add `const [reloadKey, setReloadKey] = useState(0);`, include it in the load effect dependencies, and keep `setData(next)` only in the success branch. Do not clear `data` when loading begins or fails.

Render these states above the workbench:

```tsx
{noteOpened && loading && data ? (
  <div className="preheat-refresh-status" role="status" aria-live="polite">
    <LoaderCircle className="spin" size={15} />
    {t(language, "正在重新整理路线…", "Rearranging your route…")}
  </div>
) : null}

{noteOpened && error ? (
  <div className="error-card preheat-result-panel" role="alert">
    <CircleAlert size={18} />
    <span>{error}</span>
    <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
      {t(language, "重试", "Retry")}
    </button>
  </div>
) : null}
```

Keep the initial full loader guarded by `loading && !data`. The error card may coexist with stale data.

- [ ] **Step 6: Apply section order and profile-specific default expansion**

Compute:

```ts
const sectionOrder = data?.presentation.sectionOrder.join("-");
const sectionNumber = (section: "timeline" | "brief" | "relations") =>
  String((data?.presentation.sectionOrder.indexOf(section) ?? 0) + 1).padStart(2, "0");
const [expandedSections, setExpandedSections] = useState<PreheatSection[]>([
  "timeline", "brief", "relations",
]);
const toggleSection = (section: PreheatSection) =>
  setExpandedSections((current) => current.includes(section)
    ? current.filter((item) => item !== section)
    : [...current, section]);
```

Import `PreheatSection` from `lib/preheat-personalization`. Set `<section className="preheat-workbench preheat-intel-workbench" data-section-order={sectionOrder}>` and replace the three hard-coded numbers with `sectionNumber(...)`.

For each column heading, add an accessible control using the matching section name:

```tsx
<button
  type="button"
  className="section-collapse-toggle"
  aria-expanded={expandedSections.includes("timeline")}
  onClick={() => toggleSection("timeline")}
>
  {expandedSections.includes("timeline")
    ? t(language, "收起", "Collapse")
    : t(language, "展开", "Expand")}
</button>
```

Wrap each column's content below its heading in `<div className="preheat-section-body" hidden={!expandedSections.includes("timeline")}>...</div>`, using `brief` and `relations` in the other two columns. Keep the existing content inside each wrapper unchanged.

- [ ] **Step 7: Add stable desktop and mobile layouts**

Add to `app/globals.css`:

```css
.preheat-workbench .timeline-column { grid-area: timeline; }
.preheat-workbench .narration-column { grid-area: brief; }
.preheat-workbench .relations-column { grid-area: relations; }
.preheat-workbench[data-section-order="timeline-brief-relations"] { grid-template-columns: 270px minmax(0, 1fr) 330px; grid-template-areas: "timeline brief relations"; }
.preheat-workbench[data-section-order="brief-timeline-relations"] { grid-template-columns: minmax(0, 1fr) 270px 330px; grid-template-areas: "brief timeline relations"; }
.preheat-workbench[data-section-order="relations-timeline-brief"] { grid-template-columns: 330px 270px minmax(0, 1fr); grid-template-areas: "relations timeline brief"; }
.preheat-refresh-status { display: flex; align-items: center; justify-content: center; gap: 7px; margin: 8px 0; color: var(--ink-soft); font-size: 10px; }
.section-collapse-toggle { margin-left: auto; border: 0; background: transparent; color: var(--ink-soft); cursor: pointer; font-size: 10px; }
.section-collapse-toggle:focus-visible { outline: 3px solid rgba(58,126,154,.38); outline-offset: 2px; }
.preheat-section-body[hidden] { display: none; }
.preheat-workbench > [class$="-column"]:has(.preheat-section-body[hidden]) { min-height: 0; }
.preheat-intel-page .error-card { display: flex; align-items: center; gap: 9px; }
.preheat-intel-page .error-card button { margin-left: auto; border: 1px solid var(--coral); background: transparent; color: var(--coral); padding: 7px 12px; cursor: pointer; }
```

Inside the existing `@media (max-width: 980px)` block, force all order variants to the current two-column layout; inside `@media (max-width: 640px)`, use the returned order in a single column:

```css
.preheat-workbench[data-section-order] { grid-template-columns: 230px 1fr; grid-template-areas: "timeline brief" "relations relations"; }
```

```css
.preheat-workbench[data-section-order] { display: grid; grid-template-columns: 1fr; }
.preheat-workbench[data-section-order="timeline-brief-relations"] { grid-template-areas: "timeline" "brief" "relations"; }
.preheat-workbench[data-section-order="brief-timeline-relations"] { grid-template-areas: "brief" "timeline" "relations"; }
.preheat-workbench[data-section-order="relations-timeline-brief"] { grid-template-areas: "relations" "timeline" "brief"; }
```

Remove the existing mobile `.narration-column`, `.timeline-column`, and `.relations-column` `order` declarations so they do not conflict with grid areas.

- [ ] **Step 8: Run focused tests and typecheck**

Run:

```powershell
npm test -- tests/preheat-personalization.test.ts tests/preheat.test.ts tests/preheat-route.test.ts tests/ui-redesign-source.test.ts
npm run typecheck
```

Expected: all tests PASS and TypeScript exits with code 0.

- [ ] **Step 9: Commit the live personalized workbench**

```powershell
git add app/preheat/page.tsx components/relation-map.tsx app/globals.css tests/ui-redesign-source.test.ts
git commit -m "feat: apply traveler context to preheat results"
```

---

### Task 5: Full Verification and Visual QA

**Files:**
- Modify only if verification finds a defect in files already listed above.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: a verified production build with three visibly distinct sample combinations and no spoiler regression.

- [ ] **Step 1: Run the full automated suite**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: all Vitest suites PASS, TypeScript exits with code 0, and Next.js completes a production build including `/preheat` and `/api/preheat`.

- [ ] **Step 2: Start the production server for manual verification**

```powershell
npm start
```

Open `/preheat` and verify both Chinese and English at desktop width, 980 px, and 640 px.

- [ ] **Step 3: Verify the direct region selector**

Confirm all eight progress values are direct buttons, the selected state is not color-only, Tab focus is visible, labels wrap without clipping, and no progress dropdown remains in the preheat settings block.

- [ ] **Step 4: Verify live combination changes**

Open the result once, then compare:

1. `须弥 × 新玩家 × 剧情`: first unlocked timeline node selected, shorter evidence, terminology/story-first ranking.
2. `须弥 × 剧情关注者 × 角色`: latest unlocked timeline node selected, richer brief, character relation node focused.
3. `须弥 × 轻量玩家 × 版本概览`: brief-first layout, three-point narration, two concise follow-up questions.

Confirm every switch updates the settings summary and refreshes the open result without scrolling or adding a personalized result introduction.

- [ ] **Step 5: Verify failure and race behavior**

Throttle the network, switch combinations rapidly, and confirm only the last combination wins. Temporarily block `/api/preheat`, confirm the previous result remains visible with a retry action, unblock it, and confirm Retry replaces the stale result.

- [ ] **Step 6: Verify spoiler boundaries**

With progress `须弥` and depth `已过剧情回顾`, confirm Fontaine, Natlan, and Nod-Krai timeline nodes remain locked for all five identities and every focus selection. Switch to `完整考据` and confirm the existing released-later-region behavior remains unchanged.

- [ ] **Step 7: Inspect the final diff and commit only necessary fixes**

```powershell
git status --short
git diff --check
git diff --stat HEAD~4..HEAD
```

If visual QA required a correction, stage only the affected paths and commit:

```powershell
git add app/preheat/page.tsx app/globals.css components/progress-button-group.tsx components/home-intel.tsx components/relation-map.tsx lib/preheat.ts lib/preheat-personalization.ts lib/schemas.ts tests/preheat-personalization.test.ts tests/preheat.test.ts tests/preheat-route.test.ts tests/ui-redesign-source.test.ts
git commit -m "fix: polish personalized preheat interactions"
```

If no correction was needed, do not create an empty commit.
