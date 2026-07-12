# Region Character Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand custom-topic completion with complete playable-character names per region plus a focused set of story-critical NPCs.

**Architecture:** Move candidate data out of `app/ask/page.tsx` into a typed data module keyed by selectable `Progress` regions. Export one matcher that normalizes user input, prioritizes the selected region, then considers global lore words and other regions while returning no more than four unique entries.

**Tech Stack:** TypeScript, React, Vitest, existing `Progress` domain type.

## Global Constraints

- Every selectable region contains its playable-character names plus only story-critical NPC additions.
- Current-region matches rank before global lore terms and other-region matches.
- Empty input returns no candidates; non-empty input returns at most four unique candidates.
- Preserve Tab completion, click-to-complete, custom generation request, region context, and no new dependencies.

---

### Task 1: Create the region candidate catalog and matcher

**Files:**
- Create: `data/custom-topic-candidates.ts`
- Create: `tests/custom-topic-candidates.test.ts`

**Interfaces:**
- Exports `customTopicKeywordsByRegion: Record<Exclude<Progress, "unknown">, readonly string[]>`.
- Exports `globalCustomTopicKeywords: readonly string[]`.
- Exports `getCustomTopicCandidates(region, query): string[]`.

- [ ] **Step 1: Write failing matcher tests**

```ts
expect(getCustomTopicCandidates("mondstadt", "温")[0]).toBe("温迪");
expect(getCustomTopicCandidates("liyue", "钟")[0]).toBe("钟离");
expect(getCustomTopicCandidates("fontaine", "水仙")[0]).toBe("水仙十字结社");
expect(getCustomTopicCandidates("sumeru", "")).toEqual([]);
expect(getCustomTopicCandidates("mondstadt", "阿")).toHaveLength(4);
```

- [ ] **Step 2: Run the new test to verify failure**

Run: `npm test -- --run tests/custom-topic-candidates.test.ts`

Expected: FAIL because the catalog module does not exist.

- [ ] **Step 3: Implement the typed catalog**

Create the catalog with all playable characters grouped under `mondstadt`, `liyue`, `inazuma`, `sumeru`, `fontaine`, `natlan`, `nodkrai`, and `snezhnaya`; append only the approved narrative NPCs to each relevant array. Keep global lore terms in the separate export.

```ts
const normalizeCandidate = (value: string) => value.normalize("NFKC").toLocaleLowerCase();

export function getCustomTopicCandidates(region: RegionKey, query: string) {
  const normalizedQuery = normalizeCandidate(query.trim());
  if (!normalizedQuery) return [];
  const regional = customTopicKeywordsByRegion[region];
  const elsewhere = regionKeys.flatMap((key) => key === region ? [] : customTopicKeywordsByRegion[key]);
  return [...new Set([...regional, ...globalCustomTopicKeywords, ...elsewhere])]
    .filter((item) => normalizeCandidate(item).includes(normalizedQuery))
    .slice(0, 4);
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --run tests/custom-topic-candidates.test.ts`

Expected: PASS.

```powershell
git add data/custom-topic-candidates.ts tests/custom-topic-candidates.test.ts
git commit -m "feat: add regional character topic candidates"
```

---

### Task 2: Wire Ask completion to the regional catalog

**Files:**
- Modify: `app/ask/page.tsx`
- Modify: `tests/ui-redesign-source.test.ts`

**Interfaces:**
- `AskPage` imports `getCustomTopicCandidates`.
- `customTopicCandidates` is derived by `getCustomTopicCandidates(region, customSuggestionTopic)`.

- [ ] **Step 1: Write failing source assertions**

```ts
expect(page).toContain('getCustomTopicCandidates(region, customSuggestionTopic)');
expect(page).not.toContain('const customTopicKeywords = [');
```

- [ ] **Step 2: Run the source test to verify failure**

Run: `npm test -- --run tests/ui-redesign-source.test.ts`

Expected: FAIL because Ask still owns a short inline keyword list.

- [ ] **Step 3: Replace the inline list with the catalog matcher**

```ts
import { getCustomTopicCandidates } from "@/data/custom-topic-candidates";

const customTopicCandidates = getCustomTopicCandidates(
  region,
  customSuggestionTopic,
);
```

Keep the existing `onKeyDown` Tab guard and candidate button behavior unchanged.

- [ ] **Step 4: Run and commit**

Run: `npm test -- --run tests/custom-topic-candidates.test.ts tests/ui-redesign-source.test.ts && npm run typecheck`

Expected: PASS.

```powershell
git add app/ask/page.tsx tests/ui-redesign-source.test.ts
git commit -m "feat: prioritize regional custom topic candidates"
```

---

### Task 3: Full verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Run the complete verification suite**

```powershell
New-Item -ItemType Directory -Force '.tmp' | Out-Null
$env:TEMP=(Resolve-Path '.tmp').Path
$env:TMP=$env:TEMP
npm test
npm run typecheck
npm run build
```

Expected: all tests pass and Next.js completes the optimized production build.

- [ ] **Step 2: Remove temporary files and inspect the branch**

```powershell
$target=(Resolve-Path '.tmp').Path
if ($target -eq 'F:\PAIMON\.tmp') { Remove-Item -LiteralPath $target -Recurse -Force }
git status --short
```

Expected: no temporary or uncommitted files remain.
