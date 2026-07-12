# Custom Topic Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player enter a custom Genshin story keyword, optionally complete it with Tab, and generate 4–5 questions while retaining the selected preset topic as a transparent fallback.

**Architecture:** Keep `topicId` as the existing catalog and fallback identity. Add an optional normalized `customTopic` to the suggestion request; the generator overlays that text as the prompt topic/scope, and the server tags a failed custom generation with `customFallback: true`. The Ask UI owns the custom selection/input state and uses the existing region-derived preset topic for fallback questions and ask-page context.

**Tech Stack:** Next.js route handler, React client state, Zod, Vitest, existing CSS tokens and question-suggestion cache.

## Global Constraints

- `customTopic` accepts 2–60 trimmed characters and is never persisted as a catalog entry.
- Generate 4–5 questions using the existing model contract; only the topic/scope wording differs.
- A failed custom generation shows “派蒙暂时没想出来，请换个关键词再试” and the selected preset topic’s fallback questions.
- Preserve `activeAskRegion`, current region accents, current rate limit, cache TTL, and all preset-topic behavior.
- Do not add dependencies.

---

### Task 1: Add the custom-topic request/result contract and generation fallback

**Files:**
- Modify: `lib/schemas.ts`
- Modify: `lib/domain.ts`
- Modify: `lib/question-suggestion-generator.ts`
- Modify: `lib/question-suggestions.ts`
- Modify: `app/api/question-suggestions/route.ts`
- Test: `tests/question-suggestions.test.ts`
- Test: `tests/question-suggestions-route.test.ts`

**Interfaces:**
- `QuestionSuggestionRequest` gains `customTopic?: string`.
- `QuestionSuggestionResult` gains `customFallback?: boolean`.
- `getQuestionSuggestionResult(request)` always returns the selected catalog topic ID; it returns `customFallback: true` only when a custom request cannot produce valid model questions.

- [ ] **Step 1: Write failing contract tests**

```ts
expect(questionSuggestionRequestSchema.safeParse({ ...base, customTopic: "戴因斯雷布" }).success).toBe(true);
expect(questionSuggestionRequestSchema.safeParse({ ...base, customTopic: "深" }).success).toBe(false);
expect(questionSuggestionCacheKey({ ...base, customTopic: "戴因斯雷布" }))
  .not.toBe(questionSuggestionCacheKey({ ...base, customTopic: "坎瑞亚" }));
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npm test -- --run tests/question-suggestions.test.ts tests/question-suggestions-route.test.ts`

Expected: a failure because the schema rejects `customTopic` and the cache key ignores it.

- [ ] **Step 3: Extend schema, result type, cache key, and prompt overlay**

```ts
customTopic: z.string().trim().min(2).max(60).optional(),

export interface QuestionSuggestionResult {
  topicId: string;
  questions: string[];
  source: "generated" | "fallback";
  customFallback?: boolean;
}

const customTopic = request.customTopic?.trim();
const promptTopic = customTopic || topic.title[request.language];
const promptScope = customTopic || topic.scope[request.language];
```

Use `promptTopic` and `promptScope` in the generator payload. Append `request.customTopic?.trim().normalize("NFKC").toLocaleLowerCase() ?? ""` to `questionSuggestionCacheKey`.

- [ ] **Step 4: Tag custom fallback without changing preset fallback**

```ts
if (!validated) {
  const fallback = fallbackQuestionSuggestions(request);
  return fallback && request.customTopic
    ? { ...fallback, customFallback: true }
    : fallback;
}
```

Do not cache failed custom generation; retain current caching only for validated generated results.

- [ ] **Step 5: Cover the route and generator behavior**

Add tests for accepted custom input, rejected one-character/61-character input, custom cache separation, prompt topic overlay, and `customFallback: true` with the selected topic’s fallback questions.

- [ ] **Step 6: Run and commit**

Run: `npm test -- --run tests/question-suggestions.test.ts tests/question-suggestions-route.test.ts`

Expected: PASS.

```powershell
git add lib/schemas.ts lib/domain.ts lib/question-suggestion-generator.ts lib/question-suggestions.ts app/api/question-suggestions/route.ts tests/question-suggestions.test.ts tests/question-suggestions-route.test.ts
git commit -m "feat: support custom topic suggestions"
```

---

### Task 2: Add custom topic selection, completion, and fallback messaging to Ask

**Files:**
- Modify: `app/ask/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/ui-redesign-source.test.ts`

**Interfaces:**
- Local state: `isCustomSuggestionTopic: boolean`, `customSuggestionTopic: string`.
- Constant: `customTopicKeywords` containing the twelve approved high-signal terms.
- `generateSuggestions()` includes `customTopic` only when custom mode is selected and uses the selected catalog topic for fallback.

- [ ] **Step 1: Write failing source assertions**

```ts
expect(page).toContain("customTopicKeywords");
expect(page).toContain("customSuggestionTopic");
expect(page).toContain('event.key === "Tab"');
expect(page).toContain("customFallback");
expect(page).toContain("派蒙暂时没想出来，请换个关键词再试");
```

- [ ] **Step 2: Run the source test to verify failure**

Run: `npm test -- --run tests/ui-redesign-source.test.ts`

Expected: FAIL because custom-topic UI identifiers are absent.

- [ ] **Step 3: Add the state and completion candidates**

```ts
const customTopicKeywords = ["戴因斯雷布", "坎瑞亚", "深渊", "旅行者血亲", "斯卡拉姆齐", "魔女会", "天理", "虚假之天", "龙王", "世界树", "法涅斯", "水仙十字结社"];
const [isCustomSuggestionTopic, setIsCustomSuggestionTopic] = useState(false);
const [customSuggestionTopic, setCustomSuggestionTopic] = useState("");
const customTopicCandidates = customTopicKeywords.filter((item) => item.includes(customSuggestionTopic.trim())).slice(0, 4);
```

Only show candidates after the input has non-empty content. On the input’s `onKeyDown`, intercept Tab only when a candidate exists; call `preventDefault()` and set the input to the first candidate.

- [ ] **Step 4: Add the custom choice card and input**

Place it after the mapped preset topic buttons. Selecting a preset sets `isCustomSuggestionTopic` to false. Selecting custom sets it true, keeps `suggestionTopicId` unchanged, and focuses the input. Disable the generate button if custom mode is active and the trimmed input is shorter than two characters.

```tsx
<button type="button" className={isCustomSuggestionTopic ? "is-selected custom-topic-choice" : "custom-topic-choice"} onClick={() => setIsCustomSuggestionTopic(true)}>
  <PenLine size={15} />
  {t(language, "自定义专题", "Custom topic")}
</button>
```

- [ ] **Step 5: Send custom input and show the specified fallback message**

```ts
...(isCustomSuggestionTopic ? { customTopic: customSuggestionTopic.trim() } : {}),
```

Render the failure message only for `suggestionState.customFallback`. Keep the question list rendered immediately below it, using the returned fallback questions. Do not set `activeAskRegion` until a suggested question is clicked.

- [ ] **Step 6: Add style and responsive rules**

Add `.custom-topic-choice`, `.custom-topic-input`, `.custom-topic-candidates`, and `.custom-topic-fallback` styles scoped within `.suggestion-topic-stage`. Reuse `var(--topic-accent)` and existing button typography; candidate buttons must remain keyboard focusable and wrap cleanly below 560px.

- [ ] **Step 7: Run and commit**

Run: `npm test -- --run tests/ui-redesign-source.test.ts && npm run typecheck`

Expected: PASS.

```powershell
git add app/ask/page.tsx app/globals.css tests/ui-redesign-source.test.ts
git commit -m "feat: add custom topic question prompts"
```

---

### Task 3: Full verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Run the complete suite and production build**

```powershell
New-Item -ItemType Directory -Force '.tmp' | Out-Null
$env:TEMP=(Resolve-Path '.tmp').Path
$env:TMP=$env:TEMP
npm test
npm run typecheck
npm run build
```

Expected: all tests pass and Next.js reports a successful optimized production build.

- [ ] **Step 2: Clean the temporary directory and inspect Git state**

```powershell
$target=(Resolve-Path '.tmp').Path
if ($target -eq 'F:\PAIMON\.tmp') { Remove-Item -LiteralPath $target -Recurse -Force }
git status --short
```

Expected: no temporary directory or unintended file remains.
