# Answer Clue Heading Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the “派蒙查到的线索” heading to a normal horizontal desktop layout and a readable stacked mobile layout.

**Architecture:** Keep the existing `AnswerCard` markup and visual treatment. Narrow the generic claim-row grid selector so it applies only to evidence rows, then add a mobile-only layout override for the dedicated heading container.

**Tech Stack:** Next.js 16, React 19, global CSS, Vitest source-level regression tests

## Global Constraints

- Only modify `app/globals.css` and `tests/ui-redesign-source.test.ts`.
- Do not modify answer data, component structure, copy, sources, or unrelated card styles.
- Preserve the parchment background, inset border, and fact-boundary badges.

---

### Task 1: Isolate the clue heading from evidence-row layout

**Files:**
- Modify: `tests/ui-redesign-source.test.ts:262-273`
- Modify: `app/globals.css:1616-1626`
- Modify: `app/globals.css:3114-3117`

**Interfaces:**
- Consumes: `AnswerCard` classes `claim-list`, `clue-ledger`, and `clue-ledger-heading`.
- Produces: A CSS contract where only non-heading direct children use the `18px 1fr auto` evidence-row grid.

- [ ] **Step 1: Write the failing regression test**

Add this test inside `describe("Paimon evidence experience source", ...)`:

```ts
it("keeps the clue heading out of the evidence-row grid", () => {
  const styles = source("app", "globals.css");

  expect(styles).toContain(
    ".claim-list > div:not(.clue-ledger-heading) { display: grid;",
  );
  expect(styles).not.toMatch(/\.claim-list > div\s*\{\s*display: grid;/u);
  expect(styles).toContain(
    ".clue-ledger-heading small { max-width: none; text-align: left; }",
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npx vitest run tests/ui-redesign-source.test.ts
```

Expected: FAIL because the stylesheet still contains `.claim-list > div { display: grid;` and has no mobile heading override.

- [ ] **Step 3: Implement the minimal desktop selector fix**

Replace the generic direct-child selector in `app/globals.css` with:

```css
.claim-list > div:not(.clue-ledger-heading) { display: grid; grid-template-columns: 18px 1fr auto; align-items: start; gap: 9px; padding: 11px 0; border-bottom: 1px dashed var(--line); }
```

This allows the existing `.clue-ledger-heading { display: flex; ... }` rule to control the heading again.

- [ ] **Step 4: Add the mobile heading layout**

Inside the existing narrow-screen media query near the `.answer-card` rules, add:

```css
  .clue-ledger-heading { flex-direction: column; gap: 6px; }
  .clue-ledger-heading small { max-width: none; text-align: left; }
```

- [ ] **Step 5: Run focused and full automated verification**

Run:

```powershell
npx vitest run tests/ui-redesign-source.test.ts
npm test
npm run typecheck
npm run build
```

Expected: all commands exit with code 0.

- [ ] **Step 6: Inspect the rendered answer at desktop and mobile widths**

Start the app with `npm run dev`, open an answer containing claims, and inspect at approximately 1728px and 390px viewport widths.

Expected desktop result: “派蒙查到的线索” remains on one readable line at the left and “线索会标明确认边界” appears on the right. Expected mobile result: the title and explanation stack with left-aligned text, while each claim retains its icon, body, and boundary badge.

- [ ] **Step 7: Commit the implementation**

```powershell
git add -- app/globals.css tests/ui-redesign-source.test.ts
git commit -m "fix: restore answer clue heading layout"
```
