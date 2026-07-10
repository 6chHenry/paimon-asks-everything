# 版本预热与发行洞察内容 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 在不大改 UI 的前提下，把版本预热改成“一个主断点、三个专题共同指向”的悬念路线，并把发行洞察改成服务版本筹备会的可执行决策简报。

**Architecture:** 版本预热在 PreheatTopic 中增加不包含答案的断点元数据，由服务端本地化后返回给页面；页面继续复用现有时间线、关系图和问派蒙入口，只新增断点承载。发行洞察把内容策略从评分引擎中抽离为主题 playbook，由规则引擎产出“放大 / 解释 / 暂缓”、证据和验证字段，再由现有决策中心展示。两页通过已有统一发行主题 ID 和预热事件聚合连接。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, lucide-react, local JSON event stores.

## Global Constraints

- 本轮只改版本预热和发行洞察；不重做版本情报首页、问派蒙和能力预览。
- 版本预热的未解断点必须明示问题、隐藏答案；代码和返回 payload 不得包含未来答案字段。
- 版本预热必须区分已确认、暗示线索和未解断点；完整考据只展开已实装证据。
- 三个预热专题共同指向一个版本级主断点，不制造互不相关的独立谜题。
- 发行洞察必须服务版本筹备会；每条建议必须包含信号、判断、动作、证据和验证方法。
- 低样本或站外趋势未接入时，页面必须明确限制，不给出无依据的高置信度结论。
- 不接入新的站外数据源，不新增复杂审批工作流，不改变现有事件存储隐私边界。
- 现有工作区已有 app/globals.css、components/app-shell.tsx 和图标文件改动；实现时只提交本计划涉及的文件。

---

## Task 1: Add the locked breakpoint content model and catalog copy

**Files:**
- Modify: F:\PAIMON\lib\domain.ts:221-233
- Modify: F:\PAIMON\data\preheat-topics.ts
- Test: F:\PAIMON\tests\preheat.test.ts

**Interfaces:**

PreheatTopic gains:

    export interface PreheatBreakpoint {
      id: string;
      mysteryId: string;
      questionZh: string;
      questionEn: string;
      clueSummaryZh: string;
      clueSummaryEn: string;
      boundaryZh: string;
      boundaryEn: string;
      unlockLabelZh: string;
      unlockLabelEn: string;
    }

    export interface PreheatTopic {
      id: string;
      titleZh: string;
      titleEn: string;
      introZh: string;
      introEn: string;
      mysteryId: string;
      breakpoint: PreheatBreakpoint;
      heroConceptIds: string[];
      depthConceptIds: Record<PreheatDepth, string[]>;
      timelineNodeIds: string[];
      relationGraphId: string;
      suggestedQuestionsZh: string[];
      suggestedQuestionsEn: string[];
    }

The breakpoint type intentionally has no answer, answerZh, answerEn, or future-content field.

- [ ] **Step 1: Write the failing catalog tests**

Add to tests/preheat.test.ts:

    it("gives all preheat topics the same version mystery and a locked question", () => {
      const mysteryIds = new Set(preheatTopics.map((topic) => topic.mysteryId));
      expect(mysteryIds).toEqual(new Set(["nodkrai-main-breakpoint"]));
      for (const topic of preheatTopics) {
        expect(topic.breakpoint.questionZh.trim()).not.toBe("");
        expect(topic.breakpoint.unlockLabelZh).toContain("至冬版本开启");
        expect(topic.breakpoint).not.toHaveProperty("answer");
        expect(topic.breakpoint).not.toHaveProperty("answerZh");
      }
    });

    it("fills the default topic with an opening promise", () => {
      const topic = preheatTopics.find((item) => item.id === defaultPreheatTopicId);
      expect(topic?.introZh).toContain("已确认");
      expect(topic?.introZh).toContain("未解");
    });

- [ ] **Step 2: Run the focused test and verify it fails**

    npm test -- tests/preheat.test.ts

Expected: FAIL because the fields do not exist and the default intro is empty.

- [ ] **Step 3: Add the model and concrete copy**

Add the interfaces above. Update all three entries in data/preheat-topics.ts with mysteryId: "nodkrai-main-breakpoint" and a breakpoint that uses the same version-level question while changing the clue and boundary copy by topic. Use this safe baseline for the first topic:

    breakpoint: {
      id: "gnosis-final-purpose",
      mysteryId: "nodkrai-main-breakpoint",
      questionZh: "收集神之心最终要启动什么？",
      questionEn: "What will the Gnosis collection ultimately set in motion?",
      clueSummaryZh: "已确认的流转、参与者与文本暗示，正在把问题指向同一个版本级断点。",
      clueSummaryEn: "Confirmed transfers, participants, and textual clues point toward one version-level breakpoint.",
      boundaryZh: "现有资料可以说明收集行动如何推进，但不能证明最终用途、代价或完整步骤。",
      boundaryEn: "Released material shows how the collection advances, but not its final use, cost, or complete procedure.",
      unlockLabelZh: "至冬版本开启后揭晓",
      unlockLabelEn: "Revealed when the Snezhnaya version opens",
    },

Fill the default topic intro with a promise that the page separates confirmed events from unresolved questions.

- [ ] **Step 4: Run the focused test and verify it passes**

    npm test -- tests/preheat.test.ts

Expected: PASS, including existing catalog consistency and progress-gating tests.

- [ ] **Step 5: Commit**

    git add lib/domain.ts data/preheat-topics.ts tests/preheat.test.ts
    git commit -m "feat: add locked preheat breakpoint content"

## Task 2: Localize and render the preheat breakpoint without leaking an answer

**Files:**
- Modify: F:\PAIMON\lib\preheat.ts
- Create: F:\PAIMON\components\preheat-breakpoint.tsx
- Modify: F:\PAIMON\app\preheat\page.tsx:255-380
- Modify: F:\PAIMON\app\globals.css
- Test: F:\PAIMON\tests\preheat-route.test.ts, F:\PAIMON\tests\preheat.test.ts

**Interfaces:**

getPreheatView(query) produces:

    breakpoint: {
      id: string;
      mysteryId: string;
      question: string;
      clueSummary: string;
      boundary: string;
      unlockLabel: string;
    }

PreheatBreakpointCard consumes:

    type LocalizedBreakpoint = PreheatView["breakpoint"];

    export function PreheatBreakpointCard(props: {
      breakpoint: LocalizedBreakpoint;
      askHref: string;
    }): JSX.Element;

The component must not accept or render an answer prop.

- [ ] **Step 1: Write the failing route test**

Add to tests/preheat-route.test.ts:

    it("returns a question-led breakpoint without an answer", async () => {
      const response = await GET(new Request(
        "http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=zh-CN&profile=story&progress=fontaine&spoilerPreference=low",
      ));
      const payload = (await response.json()) as {
        breakpoint: { question: string; unlockLabel: string; boundary: string } &
          Record<string, unknown>;
      };
      expect(response.status).toBe(200);
      expect(payload.breakpoint.question).toContain("神之心");
      expect(payload.breakpoint.unlockLabel).toContain("至冬版本开启");
      expect(payload.breakpoint.boundary).toContain("不能证明");
      expect(payload.breakpoint).not.toHaveProperty("answer");
    });

- [ ] **Step 2: Run the route test and verify it fails**

    npm test -- tests/preheat-route.test.ts

Expected: FAIL because the response has no breakpoint property.

- [ ] **Step 3: Localize explicitly in lib/preheat.ts**

Add:

    function localizeBreakpoint(
      breakpoint: PreheatTopic["breakpoint"],
      language: Language,
    ) {
      return {
        id: breakpoint.id,
        mysteryId: breakpoint.mysteryId,
        question: language === "zh-CN" ? breakpoint.questionZh : breakpoint.questionEn,
        clueSummary: language === "zh-CN" ? breakpoint.clueSummaryZh : breakpoint.clueSummaryEn,
        boundary: language === "zh-CN" ? breakpoint.boundaryZh : breakpoint.boundaryEn,
        unlockLabel: language === "zh-CN" ? breakpoint.unlockLabelZh : breakpoint.unlockLabelEn,
      };
    }

Return breakpoint: localizeBreakpoint(topic.breakpoint, query.language) from getPreheatView. Select only safe fields; do not spread the source object.

- [ ] **Step 4: Add the minimal card and placement**

Create components/preheat-breakpoint.tsx with this structure:

    export function PreheatBreakpointCard({ breakpoint, askHref }: Props) {
      return (
        <article className="preheat-breakpoint" aria-labelledby="preheat-breakpoint-question">
          <div className="preheat-breakpoint-kicker">未解断点 / UNRESOLVED BREAKPOINT</div>
          <h2 id="preheat-breakpoint-question">{breakpoint.question}</h2>
          <p className="preheat-breakpoint-clue">{breakpoint.clueSummary}</p>
          <div className="preheat-breakpoint-boundary">
            <strong>当前边界</strong>
            <p>{breakpoint.boundary}</p>
          </div>
          <div className="preheat-breakpoint-footer">
            <span>{breakpoint.unlockLabel}</span>
            <a href={askHref}>继续问派蒙 →</a>
          </div>
        </article>
      );
    }

Render it in app/preheat/page.tsx after the selected timeline detail and before RelationMap, using the existing topic and selected timeline for askHref. Add only breakpoint-card styles: accent border, high-contrast question, separated boundary block, and locked footer. Do not redesign the workbench or navigation.

- [ ] **Step 5: Run focused tests and typecheck**

    npm test -- tests/preheat.test.ts tests/preheat-route.test.ts
    npm run typecheck

Expected: PASS and TypeScript exit code 0.

- [ ] **Step 6: Commit**

    git add lib/preheat.ts components/preheat-breakpoint.tsx app/preheat/page.tsx app/globals.css tests/preheat.test.ts tests/preheat-route.test.ts
    git commit -m "feat: surface the preheat unresolved breakpoint"

## Task 3: Separate release-meeting copy from scoring and add decision fields

**Files:**
- Create: F:\PAIMON\data\release-playbook.ts
- Modify: F:\PAIMON\lib\release-insights.ts
- Modify only if needed: F:\PAIMON\data\release-topic-map.ts
- Test: F:\PAIMON\tests\release-insights.test.ts

**Interfaces:**

    export type ReleaseDecisionKind = "amplify" | "explain" | "hold";

    export interface ReleasePlaybookEntry {
      topicId: string;
      actionZh: string;
      actionEn: string;
      verificationZh: string;
      verificationEn: string;
    }

    export const releasePlaybook: Record<string, ReleasePlaybookEntry>;

Extend ReleaseAction with:

    decisionKind: ReleaseDecisionKind;
    verificationZh: string;
    verificationEn: string;

- [ ] **Step 1: Write failing tests**

Add:

it("classifies a high-risk topic as an explanation action with verification", () => {
      const result = computeReleaseDecisions({
        ...baseInput,
        topics: [{ key: "tsaritsa_goal", count: 20 }],
        preheat: {
          ...baseInput.preheat,
          topics: [{ key: "tsaritsa-known-unknown", count: 20 }],
        },
      });
      const action = result.actions.find((item) => item.topicId === "tsaritsa_goal");
      expect(action?.decisionKind).toBe("explain");
      expect(action?.recommendedActionZh).toContain("FAQ");
      expect(action?.verificationZh).toContain("重复提问");
      expect(action?.evidenceRefs.length).toBeGreaterThan(0);
    });

    it("marks low-sample topics as hold instead of amplifying them", () => {
      const result = computeReleaseDecisions({
        ...baseInput,
        total: 2,
        historicalCount: 2,
        liveCount: 0,
        topics: [{ key: "tsaritsa_goal", count: 1 }],
        preheat: { ...baseInput.preheat, total: 1, historicalCount: 1, liveCount: 0, topics: [] },
      });
      const action = result.actions.find((item) => item.topicId === "tsaritsa_goal");
      expect(action?.decisionKind).toBe("hold");
      expect(action?.recommendedActionZh).toContain("观察");
    });

- [ ] **Step 2: Run the focused tests and verify they fail**

    npm test -- tests/release-insights.test.ts

Expected: FAIL because ReleaseAction has no decision or verification fields.

- [ ] **Step 3: Add the playbook entries**

Create data/release-playbook.ts with concrete entries for gnosis_journey, gnosis_purpose, and tsaritsa_goal. The entries must recommend:
- a confirmed-event timeline without inventing the ending;
- a known/unknown FAQ separating the campaign from its undisclosed purpose;
- an evidence ladder separating explicit, implied, and speculative claims.

Each entry must include Chinese and English verification sentences. Add a generic fallback for unmapped topics rather than empty copy.

- [ ] **Step 4: Add deterministic classification and fields**

In lib/release-insights.ts add:

    function classifyDecisionKind(scored: ScoredTopic): ReleaseDecisionKind {
      if (scored.confidence === "low" || scored.opportunityScore < 20) return "hold";
      if (scored.riskScore >= 50) return "explain";
      return "amplify";
    }

In buildActions, use the playbook to fill recommendedActionZh/En and verificationZh/En, while retaining existing format, target profile, window, and evidence calculations. For hold, the recommendation must explicitly say “暂时观察，不进入近期排期”.

- [ ] **Step 5: Run focused tests and commit**

    npm test -- tests/release-insights.test.ts
    git add data/release-playbook.ts lib/release-insights.ts tests/release-insights.test.ts
    git commit -m "feat: add release meeting decision copy"

Expected: focused tests PASS, including the existing localization test.

## Task 4: Render release recommendations as a meeting brief

**Files:**
- Modify: F:\PAIMON\components\release-decision-center.tsx
- Modify: F:\PAIMON\app\globals.css
- Test: F:\PAIMON\tests\release-insights.test.ts

**Interfaces:** The existing ReleaseDecisionPage continues to call computeReleaseDecisions(input); no new API route is needed. ReleaseActionCard consumes the extended ReleaseAction.

- [ ] **Step 1: Add failing label tests**

Add and export this pure helper from lib/release-insights.ts, then import it in the component and test it:

export function decisionKindLabelZh(kind: ReleaseDecisionKind): string {
      return kind === "amplify" ? "放大" : kind === "explain" ? "解释" : "暂缓";
}

Expected behavior:

    expect(decisionKindLabelZh("amplify")).toBe("放大");
    expect(decisionKindLabelZh("explain")).toBe("解释");
    expect(decisionKindLabelZh("hold")).toBe("暂缓");

- [ ] **Step 2: Run the focused test and verify it fails**

    npm test -- tests/release-insights.test.ts

Expected: FAIL until the helper and extended type are present.

- [ ] **Step 3: Add meeting labels and verification display**

In components/release-decision-center.tsx, import ReleaseDecisionKind and decisionKindLabelZh from lib/release-insights.ts, then add:

    const DECISION_KIND_LABELS: Record<ReleaseDecisionKind, [string, string]> = {
      amplify: ["放大", "Amplify"],
      explain: ["解释", "Explain"],
      hold: ["暂缓", "Hold"],
    };

Show the label beside the publishing window in ReleaseActionCard. When selected, render:

    <div className="release-action-verification">
      <strong>验证方法</strong>
      <p>{action.verificationZh}</p>
    </div>

Change the primary section copy to “本次会议建议” with a sentence explaining that the action comes before evidence. Keep the existing risk list, evidence tabs, refresh behavior, AI fallback, and external-trend warning.

- [ ] **Step 4: Add minimal styles and verify**

Add styles for release-decision-kind and release-action-verification using existing theme variables. Keep the current page grid and make the verification block readable on narrow screens.

- [ ] **Step 5: Run focused tests, typecheck, and commit**

    npm test -- tests/release-insights.test.ts
    npm run typecheck
    git add components/release-decision-center.tsx app/globals.css tests/release-insights.test.ts
    git commit -m "feat: present release insights as meeting brief"

Expected: tests PASS and TypeScript exits with code 0.

## Task 5: Verify the preheat-to-insights integration and full regression suite

**Files:**
- Modify: F:\PAIMON\tests\insights.test.ts
- Modify only if needed: F:\PAIMON\tests\preheat-route.test.ts, F:\PAIMON\data\release-topic-map.ts

**Interfaces:** aggregateInsights(events, preheatEvents) remains the integration boundary. computeReleaseDecisions(aggregateInsights(...)) must produce actions with decisionKind, evidenceRefs, and verificationZh.

- [ ] **Step 1: Write the integration regression test**

Add to tests/insights.test.ts:

    it("turns preheat interest plus related questions into a traceable meeting action", () => {
      const aggregate = aggregateInsights(historicalEvents, historicalPreheatEvents);
      const decisions = computeReleaseDecisions({
        ...aggregate,
        historicalCount: aggregate.historicalCount,
        liveCount: aggregate.liveCount,
        preheat: aggregate.preheat,
      });
      const action = decisions.actions.find(
        (item) => item.topicId === "gnosis_journey" || item.topicId === "gnosis_purpose",
      );
      expect(action).toBeDefined();
      expect(action?.evidenceRefs.length).toBeGreaterThan(0);
      expect(action?.verificationZh.trim()).not.toBe("");
      expect(["amplify", "explain", "hold"]).toContain(action?.decisionKind);
    });

Import computeReleaseDecisions from @/lib/release-insights.

- [ ] **Step 2: Run integration tests and fix only mapping regressions**

    npm test -- tests/insights.test.ts tests/preheat.test.ts tests/release-insights.test.ts

Expected: PASS. If an action is missing, update only the existing data/release-topic-map.ts mapping so gnosis_journey, gnosis_purpose, and tsaritsa_goal bridge question topics, preheat IDs, timeline nodes, and graph nodes. Do not create a second topic registry.

- [ ] **Step 3: Run the full verification suite**

    npm test
    npm run typecheck
    npm run build

Expected: all Vitest tests pass, TypeScript reports no errors, and the Next.js production build completes successfully.

- [ ] **Step 4: Review changed-file scope**

    git status --short
    git diff main...HEAD --stat

Confirm that only planned documentation, preheat, release-insights, test, and minimal style changes are committed. Existing unrelated worktree changes must remain unstaged and uncommitted.

- [ ] **Step 5: Commit integration verification**

    git add tests/insights.test.ts tests/preheat-route.test.ts data/release-topic-map.ts
    git commit -m "test: verify preheat release insight loop"

## Self-Review Checklist

- Spec coverage: breakpoint model, question-only reveal, shared mystery, depth boundary, meeting decision kinds, verification field, evidence guardrails, minimal UI scope, and integration loop each have a task.
- Placeholder scan: every task step contains concrete files, interfaces, commands, expected results, and commit boundaries.
- Type consistency: PreheatBreakpoint feeds PreheatView["breakpoint"]; ReleaseDecisionKind feeds ReleaseAction.decisionKind; releasePlaybook supplies verification fields consumed by ReleaseActionCard.
- Privacy boundary: no new raw question storage or external data source is introduced.
- Regression boundary: existing guided/research progress gating, route validation, scoring, and AI fallback remain intact.
