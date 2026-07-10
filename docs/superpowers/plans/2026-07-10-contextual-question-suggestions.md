# Contextual Question Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players choose a Genshin region and curated story topic, receive four or five spoiler-aware question suggestions, and instantly ask one; show same-topic curated questions whenever generation cannot be used.

**Architecture:** A typed local catalog owns the allowed regions, bilingual labels, source anchors, and five fallback questions per topic. A node runtime API validates only catalog topic IDs, calls an OpenAI-compatible model through a focused generator, validates its JSON response, and returns fallback questions on every generator failure. The ask-page sidebar owns region/topic selection and replaces the existing fixed prompt list with generated or fallback suggestions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zod 4, Vitest, existing OpenAI-compatible `fetch` configuration.

## Global Constraints

- Keep regions exactly `mondstadt`, `liyue`, `inazuma`, `sumeru`, `fontaine`, `natlan`, and `nodkrai`; do not offer `unknown` in the selector.
- Initial catalog contains exactly 15 curated story topics and each topic owns five non-answer, bilingual fallback questions plus at least one source anchor.
- `POST /api/question-suggestions` accepts only `{ topicId, language, profile, progress, spoilerPreference, focus }`; no account identifier, question text, or event persistence is introduced.
- Generated output must be strict JSON, contain 4 or 5 unique questions, contain no answers or citations, and be replaced by its topic fallback whenever invalid, unavailable, or rate-limited.
- Use the current OpenAI-compatible environment values `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL`; no new dependency or database.
- Keep the existing `submitQuestion` path unchanged so a suggestion fast-submits through the existing spoiler, tracing, and privacy flow.

---

## File Structure

- Create `data/question-suggestion-topics.ts`: the 15-topic curated catalog and bilingual label/fallback data.
- Create `lib/question-suggestions.ts`: catalog lookup, 30-minute cache key, generated-answer validation, and fallback result construction.
- Create `lib/question-suggestion-generator.ts`: OpenAI-compatible request and strict JSON parser with a topic-scoped no-answer prompt.
- Create `app/api/question-suggestions/route.ts`: request validation, rate limiting, catalog validation, generator invocation, and fallback response.
- Modify `lib/domain.ts`: shared `QuestionSuggestionTopic`, `QuestionSuggestionSourceAnchor`, and `QuestionSuggestionResult` types.
- Modify `lib/schemas.ts`: `questionSuggestionRequestSchema` and inferred request type.
- Modify `app/ask/page.tsx`: region/topic controls, fetch lifecycle, fallback label, and fast-submit cards.
- Modify `app/globals.css`: compact selector, generation button, status, source label, and accessible disabled states in the sticky panel.
- Replace `tests/suggested-questions.test.ts` with catalog and source tests; create `tests/question-suggestions.test.ts` and `tests/question-suggestions-route.test.ts`; update `tests/ui-redesign-source.test.ts` with sidebar source assertions.

### Task 1: Define the curated topic catalog and public contract

**Files:**
- Create: `data/question-suggestion-topics.ts`
- Modify: `lib/domain.ts`
- Modify: `lib/schemas.ts`
- Modify: `tests/suggested-questions.test.ts`

**Interfaces:**
- Produces `QuestionSuggestionTopic`, `questionSuggestionTopics`, `questionSuggestionRequestSchema`, and `QuestionSuggestionRequest`.
- Consumes `Language`, `Progress`, `Profile`, `Focus`, and `SpoilerPreference` from `lib/domain.ts`.

- [ ] **Step 1: Write failing catalog and request-schema tests**

```ts
import { questionSuggestionTopics } from "@/data/question-suggestion-topics";

it("covers seven selectable regions with five bilingual fallback questions per topic", () => {
  expect(new Set(questionSuggestionTopics.map((topic) => topic.region))).toEqual(
    new Set(["mondstadt", "liyue", "inazuma", "sumeru", "fontaine", "natlan", "nodkrai"]),
  );
  expect(questionSuggestionTopics).toHaveLength(15);
  for (const topic of questionSuggestionTopics) {
    expect(topic.sourceAnchors.length).toBeGreaterThan(0);
    expect(topic.fallbackQuestions["zh-CN"]).toHaveLength(5);
    expect(topic.fallbackQuestions.en).toHaveLength(5);
  }
});
```

- [ ] **Step 2: Run the catalog test to verify it fails**

Run: `npm test -- tests/suggested-questions.test.ts`

Expected: FAIL because `data/question-suggestion-topics.ts` does not exist.

- [ ] **Step 3: Add the shared types, schema, and catalog**

```ts
export interface QuestionSuggestionTopic {
  id: string;
  region: Exclude<Progress, "unknown">;
  title: Record<Language, string>;
  scope: Record<Language, string>;
  sourceAnchors: QuestionSuggestionSourceAnchor[];
  fallbackQuestions: Record<Language, [string, string, string, string, string]>;
}

export const questionSuggestionRequestSchema = z.object({
  topicId: z.string().trim().min(3).max(100),
  language: z.enum(["zh-CN", "en"]),
  profile: z.enum(["new", "returning", "story", "exploration", "casual"]),
  progress: z.enum(["unknown", "mondstadt", "liyue", "inazuma", "sumeru", "fontaine", "natlan", "nodkrai"]),
  spoilerPreference: z.enum(["none", "low", "full"]),
  focus: z.array(z.enum(["story", "character", "gameplay", "overview"])).min(1).max(4),
}).strict();
```

Populate catalog IDs as `mondstadt-main-story`, `mare-jivari`, `liyue-main-story`, `chasm-khaenriah`, `inazuma-main-story`, `tsurumi-ruu`, `sumeru-main-story`, `aranyaka`, `golden-slumber`, `fontaine-main-story`, `narzissenkreuz-ordo`, `natlan-main-story`, `night-kingdom-ancient-names`, `nodkrai-main-story`, and `nodkrai-lunar-power`. Give each item question prompts rather than factual claims, and source anchors that point to the relevant official page when available or the vetted wiki anchor otherwise.

- [ ] **Step 4: Run the catalog test to verify it passes**

Run: `npm test -- tests/suggested-questions.test.ts`

Expected: PASS with exactly 15 topics and all fallback tuples populated.

- [ ] **Step 5: Commit the catalog contract**

```bash
git add lib/domain.ts lib/schemas.ts data/question-suggestion-topics.ts tests/suggested-questions.test.ts
git commit -m "feat: add curated question topic catalog"
```

### Task 2: Build and test the generator boundary

**Files:**
- Create: `lib/question-suggestion-generator.ts`
- Create: `lib/question-suggestions.ts`
- Create: `tests/question-suggestions.test.ts`

**Interfaces:**
- Consumes `QuestionSuggestionTopic` and `QuestionSuggestionRequest` from Task 1.
- Produces `generateQuestionSuggestions(input): Promise<string[] | null>`, `getQuestionSuggestionResult(input): Promise<QuestionSuggestionResult>`, `findQuestionSuggestionTopic(id)`, and `validateGeneratedQuestions(value)`.

- [ ] **Step 1: Write failing parser, fallback, and cache tests**

```ts
it("keeps four unique questions from strict model JSON", () => {
  expect(validateGeneratedQuestions('["Why?", "Who?", "When?", "How?"]')).toEqual([
    "Why?", "Who?", "When?", "How?",
  ]);
});

it("falls back to the selected topic after invalid model output", async () => {
  const result = await getQuestionSuggestionResult({ topicId: "aranyaka", language: "en", profile: "story", progress: "sumeru", spoilerPreference: "low", focus: ["story"] }, async () => null);
  expect(result).toMatchObject({ topicId: "aranyaka", source: "fallback" });
  expect(result.questions).toHaveLength(5);
});
```

- [ ] **Step 2: Run generator tests to verify they fail**

Run: `npm test -- tests/question-suggestions.test.ts`

Expected: FAIL because generator and helper exports do not exist.

- [ ] **Step 3: Implement deterministic validation, cache, and model request**

```ts
export function validateGeneratedQuestions(content: string) {
  const parsed = JSON.parse(stripMarkdownFence(content));
  if (!Array.isArray(parsed) || parsed.length < 4 || parsed.length > 5) return null;
  const questions = parsed.map((item) => typeof item === "string" ? item.trim() : "");
  if (questions.some((item) => item.length < 8 || item.length > 180 || !item.includes("?"))) return null;
  if (new Set(questions.map(normalize)).size !== questions.length) return null;
  return questions;
}
```

Implement `generateQuestionSuggestions` using `LLM_API_KEY`; return `null` when no key, a non-2xx response, timeout, parser failure, or a question contains answer-shaped phrases such as `答案是`, `it is`, or a URL. Its system prompt must say: “Return JSON string array only. Generate questions, never answers, claims, citations, sources, unconfirmed premises, or spoilers beyond the requested preference.” Include language, scope, profile, progress, spoiler preference, and focus in the user message. Cache successful `QuestionSuggestionResult` values for 30 minutes using `language:topicId:profile:progress:spoilerPreference:focus.join(',')`.

- [ ] **Step 4: Run generator tests to verify they pass**

Run: `npm test -- tests/question-suggestions.test.ts`

Expected: PASS for valid JSON, duplicate/rejected output, same-topic fallback, and cached generated result.

- [ ] **Step 5: Commit the generator boundary**

```bash
git add lib/question-suggestion-generator.ts lib/question-suggestions.ts tests/question-suggestions.test.ts
git commit -m "feat: generate scoped question suggestions"
```

### Task 3: Expose a guarded suggestions API

**Files:**
- Create: `app/api/question-suggestions/route.ts`
- Create: `tests/question-suggestions-route.test.ts`

**Interfaces:**
- Consumes `questionSuggestionRequestSchema`, `getQuestionSuggestionResult`, `checkRateLimit`, and `getRequestRateLimitKey`.
- Produces `POST(request): Promise<Response>` returning `{ topicId, questions, source }` with source `generated` or `fallback`.

- [ ] **Step 1: Write failing route tests**

```ts
it("returns same-topic fallback suggestions without an LLM key", async () => {
  delete process.env.LLM_API_KEY;
  const response = await POST(requestFor({ topicId: "narzissenkreuz-ordo", language: "en" }));
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ topicId: "narzissenkreuz-ordo", source: "fallback" });
});

it("rejects an unknown topic before generation", async () => {
  const response = await POST(requestFor({ topicId: "not-in-catalog" }));
  expect(response.status).toBe(400);
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run: `npm test -- tests/question-suggestions-route.test.ts`

Expected: FAIL because the API route does not exist.

- [ ] **Step 3: Implement the node API route**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = checkRateLimit({ key: `question-suggestions:${getRequestRateLimitKey(request)}`, limit: 12, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited", resetAt: limit.resetAt }, { status: 429 });
  const parsed = questionSuggestionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !findQuestionSuggestionTopic(parsed.data.topicId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  return NextResponse.json(await getQuestionSuggestionResult(parsed.data));
}
```

Keep fallback at status 200 so the UI can use the response without a second request. Return 400 for malformed JSON and unknown topics, 429 only for throttling, and never include model error details.

- [ ] **Step 4: Run route tests to verify they pass**

Run: `npm test -- tests/question-suggestions-route.test.ts`

Expected: PASS for valid fallback, malformed JSON, unknown topic, and throttled request.

- [ ] **Step 5: Commit the API route**

```bash
git add app/api/question-suggestions/route.ts tests/question-suggestions-route.test.ts
git commit -m "feat: add question suggestion api"
```

### Task 4: Replace the ask sidebar with contextual controls

**Files:**
- Modify: `app/ask/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/ui-redesign-source.test.ts`
- Delete: `lib/suggested-questions.ts`

**Interfaces:**
- Consumes `questionSuggestionTopics`, `QuestionSuggestionResult`, `labels.progress`, and `POST /api/question-suggestions` from Tasks 1–3.
- Produces an ask-page control that initializes the first selectable region and its first topic, fetches suggestions on button click, and passes selected prompt directly to existing `submitQuestion`.

- [ ] **Step 1: Write failing source-level sidebar assertions**

```ts
it("uses a region selector and server-backed suggestion request instead of fixed prompts", () => {
  const source = readFileSync("app/ask/page.tsx", "utf8");
  expect(source).toContain('clientPath("/api/question-suggestions")');
  expect(source).toContain("questionSuggestionTopics");
  expect(source).toContain("让派蒙想几个问题");
  expect(source).not.toContain("suggestedQuestions[language]");
});
```

- [ ] **Step 2: Run UI source test to verify it fails**

Run: `npm test -- tests/ui-redesign-source.test.ts`

Expected: FAIL because the sidebar still imports `suggestedQuestions`.

- [ ] **Step 3: Implement controlled sidebar state and visual states**

```tsx
const selectableRegions = ["mondstadt", "liyue", "inazuma", "sumeru", "fontaine", "natlan", "nodkrai"] as const;
const [region, setRegion] = useState<(typeof selectableRegions)[number]>("mondstadt");
const [topicId, setTopicId] = useState(questionSuggestionTopics[0]!.id);
const [suggestionState, setSuggestionState] = useState<QuestionSuggestionResult>(() => fallbackFor(questionSuggestionTopics[0]!, language));
const [suggestionsLoading, setSuggestionsLoading] = useState(false);
```

On language change, replace the shown questions with the selected topic fallback in that language. On region change, choose the first catalog item in the new region and reset to its fallback. Button click posts `topicId` plus `preferences`, displays a compact spinner while pending, and accepts only a 200 response with 4–5 string questions. On fetch failure, set selected topic fallback and source `fallback`. Render `派蒙准备的参考问题 / Paimon’s prepared prompts` only for fallback source; every suggestion card calls `setQuestion(item); void submitQuestion(item);`. Keep the existing privacy note.

Add `.suggestion-controls`, `.suggestion-controls label`, `.suggestion-controls select`, `.suggestion-generate`, `.suggestion-status`, and `.suggestion-source` styles. Keep the desktop sidebar 330px wide, use focus-visible outlines, and let mobile retain the existing single-column breakpoint.

- [ ] **Step 4: Run UI source test and typecheck to verify it passes**

Run: `npm test -- tests/ui-redesign-source.test.ts; npm run typecheck`

Expected: PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the contextual sidebar**

```bash
git add app/ask/page.tsx app/globals.css tests/ui-redesign-source.test.ts lib/suggested-questions.ts
git commit -m "feat: add contextual ask-page suggestions"
```

### Task 5: Run full regression checks and verify the user path

**Files:**
- Modify only if a test reveals a defect in Tasks 1–4.

**Interfaces:**
- Consumes the complete catalog, generator, API route, and ask-page sidebar.
- Produces a clean worktree with all automated checks green.

- [ ] **Step 1: Run targeted feature tests**

Run: `$env:TEMP=(Resolve-Path '.tmp').Path; $env:TMP=$env:TEMP; npm test -- tests/suggested-questions.test.ts tests/question-suggestions.test.ts tests/question-suggestions-route.test.ts tests/ui-redesign-source.test.ts`

Expected: all selected suites PASS.

- [ ] **Step 2: Run static and production checks**

Run: `$env:TEMP=(Resolve-Path '.tmp').Path; $env:TMP=$env:TEMP; npm run typecheck; npm run build`

Expected: both commands exit 0.

- [ ] **Step 3: Manually verify no-key fallback**

Run: `Remove-Item Env:LLM_API_KEY -ErrorAction SilentlyContinue; npm run dev`

Expected: select Sumeru then Aranyaka, click the generate button, see five Aranyaka fallback cards with the prepared-prompts label; clicking one starts the existing answer trace.

- [ ] **Step 4: Clean temporary test files and inspect the worktree**

Run: `$target = (Resolve-Path '.tmp').Path; if ($target -eq 'F:\\PAIMON\\.tmp') { Remove-Item -LiteralPath $target -Recurse -Force }; git diff --check; git status --short`

Expected: the temporary folder is removed, `git diff --check` is silent, and only intended tracked feature files remain. Do not commit `.tmp`, `.next`, or environment files.
