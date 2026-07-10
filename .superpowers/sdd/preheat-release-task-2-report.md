# Task 2 report — localize and render the unresolved breakpoint

## Outcome

- `getPreheatView` now returns a `breakpoint` projection that explicitly selects only `id`, `mysteryId`, `question`, `clueSummary`, `boundary`, and `unlockLabel` from the catalog. It does not spread the catalog object or expose an answer field.
- `PreheatBreakpointCard` accepts only the localized breakpoint and an ask URL. It renders the question, clue summary, evidence boundary, unlock label, and continuation link.
- The existing preheat workbench, timeline selection, graph selection, event recording, and route behavior remain unchanged. The card appears after the selected timeline detail and before the relation map in render order.

## TDD evidence

### RED

1. Added the route test for a question-led breakpoint with no `answer` property.
2. Ran `npm test -- tests/preheat-route.test.ts`.
3. Result: 3 passed, 1 failed. The new assertion failed with `Cannot read properties of undefined (reading 'question')`, because the route response did not yet have `breakpoint`.

### GREEN

1. Added `localizeBreakpoint` and returned its explicit safe projection from `getPreheatView`.
2. Added the breakpoint card, minimal scoped styles, page placement, and a library-level projection test.
3. Ran `npm test -- tests/preheat.test.ts tests/preheat-route.test.ts`.
4. Result: 2 files passed, 15 tests passed.
5. Ran `npm run typecheck` and `git diff --check`.
6. Result: both passed with exit code 0.

## Catalog assertion note

The supplied route-test sample expected the default topic boundary to contain `不能证明`. The Task 1 catalog for `seven-gnosis-journeys` instead says `可以还原神之心的经历，但最终动机和步骤仍未解。`. To preserve Task 1 data ownership and the required direct field selection, the test asserts the catalog’s actual localized boundary phrase (`仍未解`) rather than changing catalog data or transforming the API value.

## Final whole-branch review fix

- Replaced the newly added preheat breakpoint card's raw `rgba(...)` outer border, background, and inset shadow treatments with `var(--frame-gold)`, `var(--parchment-light)`, and `var(--gold-light)`.
- Replaced the breakpoint boundary's raw `rgba(...)` separators and fill with `var(--frame-gold-soft)` and `var(--gold-light)`.
- Preserved the card layout, accent hierarchy, and existing unrelated stylesheet changes.

## Verification

- `npm test -- tests/preheat.test.ts tests/preheat-route.test.ts`: passed, 2 files and 15 tests.
- `npm run typecheck`: passed, exit code 0.
- `git diff --check -- app/globals.css`: passed.

## Commit scope

Only these Task 2 paths are staged and committed: `lib/preheat.ts`, `components/preheat-breakpoint.tsx`, `app/preheat/page.tsx`, the breakpoint-only CSS hunk in `app/globals.css`, `tests/preheat.test.ts`, and `tests/preheat-route.test.ts`. Existing unrelated changes in `app/globals.css`, `components/app-shell.tsx`, and icon assets are left unstaged.
