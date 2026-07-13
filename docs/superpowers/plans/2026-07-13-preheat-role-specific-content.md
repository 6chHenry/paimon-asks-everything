# Preheat Role-Specific Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every named region produce genuinely different, role-appropriate preheat content for new, returning, and story-focused players.

**Architecture:** Keep one `/api/preheat` endpoint and return a discriminated `PreheatView` union whose payload only contains data allowed for that role. Add a curated per-region guide for spoiler-free primers, returning-player recaps, and hooks; reuse the existing timeline, knowledge, and relation graph catalogs for story mode. Render the variants with focused components while keeping selection state in the current page.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Vitest, existing CSS design system.

## Global Constraints

- Visible profiles are exactly `new`, `returning`, and `story`.
- Preheat personalization uses region and profile only; focus pills and the depth selector are removed from this page.
- New-player responses contain no key outcomes, implications, future events, or full relation graph.
- Returning-player responses fully recap only the selected region; later story appears only as open questions.
- Story-player responses expose the complete released timeline and graph, focused on the selected region.
- Do not add a model call, database table, account state, separate page, or personalized introductory sentence.
- Keep old `depth`, `exploration`, and `casual` inputs compatible by normalizing them rather than throwing.
- Use `F:\PAIMON\.codex-temp` for test temp files because the system drive is full.

---

## File Structure

- Create `data/preheat-region-guides.ts` for localized primer, faction, recap, and hook data.
- Create `lib/visible-profiles.ts` for the visible profile list and legacy normalization.
- Modify `components/preferences-provider.tsx` and `lib/schemas.ts` for migration and request compatibility.
- Rewrite `lib/preheat-personalization.ts` and modify `lib/preheat.ts` to build discriminated role payloads.
- Create `components/preheat-role-views.tsx` for the three result structures.
- Modify `components/preheat-note.tsx`, `components/home-intel.tsx`, and `app/preheat/page.tsx` to remove redundant controls and render by role.
- Modify `app/globals.css` and the four focused test files.

---

### Task 1: Visible Profiles and Region Guide Catalog

**Files:**
- Create: `lib/visible-profiles.ts`
- Create: `data/preheat-region-guides.ts`
- Modify: `components/preferences-provider.tsx`
- Test: `tests/preheat-personalization.test.ts`

**Interfaces:**
- Produces: `visibleProfiles: readonly ["new", "returning", "story"]`.
- Produces: `normalizeVisibleProfile(value: unknown): "new" | "returning" | "story"`.
- Produces: `preheatRegionGuides: Record<NamedProgress, PreheatRegionGuide>`.
- Produces: `getPreheatRegionGuide(region, language)` and `validatePreheatRegionGuides()`.

- [ ] **Step 1: Replace presentation-limit tests with failing profile and catalog tests**

```ts
it("exposes only three profiles and migrates legacy values", () => {
  expect(visibleProfiles).toEqual(["new", "returning", "story"]);
  expect(normalizeVisibleProfile("exploration")).toBe("returning");
  expect(normalizeVisibleProfile("casual")).toBe("returning");
  expect(normalizeVisibleProfile("story")).toBe("story");
});

it("provides complete content for every named region", () => {
  const regions = ["mondstadt", "liyue", "inazuma", "sumeru", "fontaine", "natlan", "nodkrai", "snezhnaya"];
  expect(Object.keys(preheatRegionGuides)).toEqual(regions);
  for (const region of regions) {
    const guide = preheatRegionGuides[region as keyof typeof preheatRegionGuides];
    expect(guide.newPlayer.factions.length).toBeGreaterThanOrEqual(3);
    expect(guide.newPlayer.storySteps).toHaveLength(3);
    expect(guide.returningPlayer.recapPoints.length).toBeGreaterThanOrEqual(3);
    expect(guide.returningPlayer.hooks.length).toBeGreaterThanOrEqual(2);
  }
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
$env:TEMP='F:\PAIMON\.codex-temp'; $env:TMP=$env:TEMP
npm test -- tests/preheat-personalization.test.ts
```

Expected: FAIL because the two modules do not exist.

- [ ] **Step 3: Implement the profile utility and hydration migration**

```ts
export type VisibleProfile = Extract<Profile, "new" | "returning" | "story">;
export const visibleProfiles = ["new", "returning", "story"] as const satisfies readonly VisibleProfile[];

export function normalizeVisibleProfile(value: unknown): VisibleProfile {
  return value === "new" || value === "story" || value === "returning" ? value : "returning";
}
```

Parse the saved preference object, merge defaults, and normalize its `profile` before `setPreferences`.

- [ ] **Step 4: Implement all eight localized region guides**

Use this contract, with keys in route order:

```ts
export type NamedProgress = Exclude<Progress, "unknown">;
type LocalizedText = Record<Language, string>;

export interface PreheatRegionGuide {
  region: NamedProgress;
  timelineNodeId?: string;
  relationGraphId?: string;
  newPlayer: {
    overview: LocalizedText;
    factions: Array<{ name: LocalizedText; role: LocalizedText }>;
    storySteps: [LocalizedText, LocalizedText, LocalizedText];
  };
  returningPlayer: {
    recapPoints: Array<{ title: LocalizedText; body: LocalizedText }>;
    hooks: [LocalizedText, LocalizedText, ...LocalizedText[]];
  };
}
```

Every newcomer overview must omit outcomes. Every recap must stay within the selected region. Every hook must end in `？` or `?`. Map the seven current Gnosis regions to their existing timeline and relation graph IDs; Snezhnaya uses a pre-entry recap and has no fabricated event ID.

- [ ] **Step 5: Run the focused tests and commit**

```powershell
npm test -- tests/preheat-personalization.test.ts
git add data/preheat-region-guides.ts lib/visible-profiles.ts components/preferences-provider.tsx tests/preheat-personalization.test.ts
git commit -m "feat: add curated preheat role guides"
```

Expected: PASS, followed by one scoped commit.

---

### Task 2: Role-Specific API Payloads

**Files:**
- Modify: `lib/preheat-personalization.ts`
- Modify: `lib/preheat.ts`
- Modify: `lib/schemas.ts`
- Modify: `tests/preheat.test.ts`
- Modify: `tests/preheat-route.test.ts`

**Interfaces:**
- Consumes the profile normalizer, region guides, and existing timeline/graph localization helpers.
- Produces `PreheatView` with `kind: "region_required" | "new" | "returning" | "story"`.

- [ ] **Step 1: Write failing payload-isolation tests**

```ts
it("does not send story payloads to new players", () => {
  const view = getPreheatView({ ...base, profile: "new", progress: "sumeru", depth: "research" });
  expect(view.kind).toBe("new");
  if (view.kind !== "new") throw new Error("expected new view");
  expect(view.guide.factions.length).toBeGreaterThanOrEqual(3);
  expect(view).not.toHaveProperty("timeline");
  expect(view).not.toHaveProperty("availableRelationGraphs");
  expect(view).not.toHaveProperty("evidence");
});

it("recaps only the selected region for returning players", () => {
  const view = getPreheatView({ ...base, profile: "returning", progress: "sumeru", depth: "research" });
  expect(view.kind).toBe("returning");
  if (view.kind !== "returning") throw new Error("expected returning view");
  expect(view.region).toBe("sumeru");
  expect(view.recap.points.length).toBeGreaterThanOrEqual(3);
  expect(view.recap.hooks.every((hook) => /[？?]$/.test(hook))).toBe(true);
  expect(view).not.toHaveProperty("availableRelationGraphs");
});

it("opens all released events for story players and focuses their region", () => {
  const view = getPreheatView({ ...base, profile: "story", progress: "sumeru", depth: "guided" });
  expect(view.kind).toBe("story");
  if (view.kind !== "story") throw new Error("expected story view");
  expect(view.timeline.every((node) => !node.locked)).toBe(true);
  expect(view.presentation.defaultTimelineId).toBe("sumeru-gnoses");
});
```

- [ ] **Step 2: Run focused tests and verify failure**

```powershell
npm test -- tests/preheat.test.ts tests/preheat-route.test.ts
```

Expected: FAIL because the response still has one shared shape.

- [ ] **Step 3: Replace ranking and item-limit rules with discriminated contracts**

```ts
export type PreheatView =
  | (BasePreheatView & { kind: "region_required" })
  | (BasePreheatView & { kind: "new"; region: NamedProgress; guide: LocalizedNewPlayerGuide })
  | (BasePreheatView & { kind: "returning"; region: NamedProgress; recap: LocalizedReturningRecap })
  | (BasePreheatView & StoryPreheatPayload & { kind: "story"; region: NamedProgress });
```

Delete focus scoring, regex question ranking, section ordering, and per-profile limits. Keep deterministic selected-region lookup and story-mode default graph/node selection.

- [ ] **Step 4: Build each payload without leaking unused data**

Return `region_required` for `unknown`. New-player output localizes only the guide. Returning-player output localizes recap points/hooks and one selected-region graph. Story output uses `allowFutureRegions: true`, includes implications, returns all localized graphs, and selects the region mapping as its default timeline.

The schema continues accepting valid old `depth` and focus parameters. It normalizes `exploration` and `casual` to `returning`; neither depth nor focus changes role content.

- [ ] **Step 5: Update route tests, run focused tests, and commit**

```powershell
npm test -- tests/preheat-personalization.test.ts tests/preheat.test.ts tests/preheat-route.test.ts
git add lib/preheat-personalization.ts lib/preheat.ts lib/schemas.ts tests/preheat.test.ts tests/preheat-route.test.ts
git commit -m "feat: return role-specific preheat content"
```

Expected: newcomer, returning, story, unknown-region, and legacy-profile route cases PASS.

---

### Task 3: Three Distinct Result Views

**Files:**
- Create: `components/preheat-role-views.tsx`
- Modify: `components/preheat-note.tsx`
- Modify: `components/home-intel.tsx`
- Modify: `app/preheat/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/ui-redesign-source.test.ts`

**Interfaces:**
- Produces `NewPlayerPreheat`, `ReturningPlayerPreheat`, `StoryPlayerPreheat`, and `RegionRequiredPreheat`.
- Produces depth-free `PreheatNote({ topic, language, onStart })`.

- [ ] **Step 1: Write failing UI source tests**

```ts
expect(page).toContain("visibleProfiles");
expect(page).toContain("NewPlayerPreheat");
expect(page).toContain("ReturningPlayerPreheat");
expect(page).toContain("StoryPlayerPreheat");
expect(page).not.toContain("toggleFocus");
expect(page).not.toContain("focus: preferences.focus.join");
expect(note).not.toContain("depth-selector");
expect(views).toContain("地区速览");
expect(views).toContain("从这里继续期待");
expect(views).toContain("完整事件链");
```

- [ ] **Step 2: Run the source test and verify failure**

```powershell
npm test -- tests/ui-redesign-source.test.ts
```

Expected: FAIL because the role-view file does not exist.

- [ ] **Step 3: Remove redundant controls**

Change `PreheatNote` to accept only `topic`, `language`, and `onStart`. In `TravelerContextDrawer`, remove `focus`, `onToggleFocus`, and the focus `Field`; use `columns={3}` and summarize only region plus profile. Preserve the storage-consent switch.

- [ ] **Step 4: Render the discriminated payload**

```tsx
{data.kind === "region_required" ? <RegionRequiredPreheat language={language} /> : null}
{data.kind === "new" ? <NewPlayerPreheat view={data} language={language} /> : null}
{data.kind === "returning" ? <ReturningPlayerPreheat view={data} language={language} topicId={topicId} /> : null}
{data.kind === "story" ? <StoryPlayerPreheat view={data} language={language} /> : null}
```

New-player view renders overview, faction cards, and three numbered steps. Returning view renders recap cards, one local relation map when available, and hook links to `/ask`. Story view owns the existing timeline, event detail, evidence labels, relation graph, and section-collapse interactions.

- [ ] **Step 5: Update request/state flow and CSS**

Remove `depth`, focus toggling, focus query construction, and `depth_selected` recording. Keep `AbortController`, stale-content refresh, retry, timeline events, and relation events. Add `.preheat-role-view`, `.preheat-region-overview`, `.preheat-faction-grid`, `.preheat-story-steps`, `.preheat-recap-grid`, and `.preheat-hooks` using existing semantic variables only.

- [ ] **Step 6: Run UI checks and commit**

```powershell
npm test -- tests/ui-redesign-source.test.ts tests/preheat.test.ts tests/preheat-route.test.ts
npm run typecheck
git add app/preheat/page.tsx app/globals.css components/preheat-note.tsx components/home-intel.tsx components/preheat-role-views.tsx tests/ui-redesign-source.test.ts
git commit -m "feat: render distinct preheat role views"
```

Expected: focused tests PASS, TypeScript exits `0`, and one UI commit is created.

---

### Task 4: Regression Verification and Cleanup

**Files:**
- Modify only exact source or test files required by failures discovered here.

**Interfaces:**
- Verifies the route, compatibility inputs, UI contract, and production build as one release candidate.

- [ ] **Step 1: Run focused tests together**

```powershell
$env:TEMP='F:\PAIMON\.codex-temp'; $env:TMP=$env:TEMP
npm test -- tests/preheat-personalization.test.ts tests/preheat.test.ts tests/preheat-route.test.ts tests/ui-redesign-source.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the complete suite and static checks**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: every test file passes and both checks exit `0`.

- [ ] **Step 3: Check final diff and generated-file noise**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. `next-env.d.ts` may be modified by the running dev server and must not be staged.

- [ ] **Step 4: Commit verified cleanup only if required**

```powershell
git commit -m "test: verify role-specific preheat views"
```

Do not create an empty commit when verification needs no correction.
