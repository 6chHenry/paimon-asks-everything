# Ask Region Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the selected region as a visual context for sidebar-submitted questions without reducing answer readability.

**Architecture:** `AskPage` will distinguish a question submitted from a suggestion card from a manually composed question through an optional `askedRegion` argument. The page renders the existing region emblem as a local context mark and sets CSS variables only on ornamental surfaces; primary text surfaces retain their existing colors.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS custom properties, Vitest.

## Global Constraints

- Do not change chat API requests, event persistence, privacy behavior, answer content, or citation rendering.
- A sidebar question carries its current `region`; a manual composer question clears the active region; spoiler confirmation preserves the active region.
- Only the 3px conversation accent, emblem glow, loading border, and travel-note label use region color; body text, input, answer, citation, and trace backgrounds stay unchanged.
- Use `regionEmblemSources` for a selected region and `/compass-mark.svg` as the default icon.

---

### Task 1: Track the origin region of an ask-page question

**Files:**
- Modify: `app/ask/page.tsx`
- Modify: `tests/ui-redesign-source.test.ts`

**Interfaces:**
- Produces `activeAskRegion: Exclude<Progress, "unknown"> | null` and `submitQuestion(text, confirmationToken?, askedRegion?)`.
- Consumes the existing `region` selection and `regionEmblemSources` map.

- [ ] **Step 1: Write a failing source test**

```ts
expect(page).toContain("activeAskRegion");
expect(page).toContain("void submitQuestion(item, undefined, region)");
expect(page).toContain("setActiveAskRegion(askedRegion ?? null)");
```

- [ ] **Step 2: Run the source test**

Run: `npm test -- tests/ui-redesign-source.test.ts`

Expected: FAIL because no question-origin region state exists.

- [ ] **Step 3: Add the explicit region state and submission boundary**

```tsx
const [activeAskRegion, setActiveAskRegion] = useState<
  Exclude<Progress, "unknown"> | null
>(null);

async function submitQuestion(
  text: string,
  confirmationToken?: string,
  askedRegion?: Exclude<Progress, "unknown">,
) {
  if (!confirmationToken) setActiveAskRegion(askedRegion ?? null);
  // retain the existing stream logic
}
```

Pass `region` only from a suggestion card. Keep the composer and confirmation call signatures otherwise unchanged.

- [ ] **Step 4: Run the source test and typecheck**

Run: `npm test -- tests/ui-redesign-source.test.ts; npm run typecheck`

Expected: PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the state boundary**

```bash
git add app/ask/page.tsx tests/ui-redesign-source.test.ts
git commit -m "feat: track region context for sidebar questions"
```

### Task 2: Render the region emblem and readable travel-note context

**Files:**
- Modify: `app/ask/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/ui-redesign-source.test.ts`

**Interfaces:**
- Consumes `activeAskRegion`, `labels.progress`, and `regionEmblemSources` from Task 1.
- Produces `ask-region-context`, `ask-context-emblem`, and `ask-context-note` visual hooks.

- [ ] **Step 1: Write a failing source test**

```ts
expect(page).toContain("ask-region-context");
expect(page).toContain("ask-context-emblem");
expect(page).toContain("派蒙翻出了");
expect(css).toContain(".ask-region-context");
```

- [ ] **Step 2: Run the source test**

Run: `npm test -- tests/ui-redesign-source.test.ts`

Expected: FAIL because the question panel has no region context mark.

- [ ] **Step 3: Render local emblem context above the answer flow**

```tsx
const askRegionIcon = activeAskRegion
  ? regionEmblemSources[activeAskRegion]
  : "/compass-mark.svg";

<div className={`ask-region-context ${activeAskRegion ? `ask-context-${activeAskRegion}` : ""}`}>
  <img className="ask-context-emblem" src={askRegionIcon} alt="" />
  {activeAskRegion ? <span>{t(language, `派蒙翻出了「${labels.progress[activeAskRegion][language]}」的旅行笔记`, `Paimon opened the ${labels.progress[activeAskRegion][language]} travel notes`)}</span> : null}
</div>
```

Place it inside the conversation panel before loading, trace, and answer content. Keep the empty-state image as the default compass unless `activeAskRegion` exists.

- [ ] **Step 4: Add ornamental-only context styles**

```css
.conversation-panel.ask-context-mondstadt { --ask-context-accent: #5f9f9b; }
.ask-region-context { border-left: 3px solid var(--ask-context-accent, transparent); }
.ask-context-emblem { filter: brightness(0) saturate(100%); }
```

Define matching classes for all eight regions. Do not change `.answer-card`, `.composer textarea`, `.trace-timeline`, or citation text backgrounds.

- [ ] **Step 5: Run source test, typecheck, and build**

Run: `npm test -- tests/ui-redesign-source.test.ts; npm run typecheck; npm run build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit the visual context**

```bash
git add app/ask/page.tsx app/globals.css tests/ui-redesign-source.test.ts
git commit -m "feat: show region context in ask flow"
```
