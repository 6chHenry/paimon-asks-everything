import { afterEach, describe, expect, it, vi } from "vitest";
import { historicalEvents } from "@/data/events";
import { enrichInsightsWithAi } from "@/lib/ai-insights";
import { aggregateInsights } from "@/lib/insights";
import { computeReleaseDecisions } from "@/lib/release-insights";

const originalEnv = { ...process.env };

function buildAiRecommendations(
  decisions: ReturnType<typeof computeReleaseDecisions>,
) {
  return decisions.actions.slice(0, 3).map((action, index) => ({
    id: `ai-recommendation-${index + 1}`,
    topicId: action.topicId,
    title: `AI 建议 ${index + 1}：${action.titleZh}`,
    action: `这是 AI 为第 ${index + 1} 个主题生成的具体动作。`,
    format: action.format,
    window: action.window,
    targetProfiles: action.targetProfiles,
    playerNeed: "玩家需要先拿到一句清楚结论，再决定是否继续看背景。",
    whyNow: "站内提问、预热点击和关系图互动已经形成同向信号。",
    caution: "不要把推测写成已确认事实，也不要把完整背景压到首屏。",
    verification: "发布后复核玩家是否能在首屏找到结论、依据与下一步入口。",
    reusableModules: action.reusableModules,
    evidenceRefs: [`topic=${action.topicId}`],
  }));
}

describe("AI insight enrichment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("uses the configured OpenAI-compatible API to generate three evidence-bound release recommendations", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;

    const base = aggregateInsights(historicalEvents);
    const decisions = computeReleaseDecisions(base);
    const firstAction = decisions.actions[0]!;
    const firstProfile = base.profiles[0]!;
    const topicRef = `topic=${firstAction.topicId}`;
    const profileRef = `profile=${firstProfile.key}:${firstProfile.count}`;

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  briefingCards: [
                    {
                      id: "ai-fontaine",
                      topic: "fontaine_catch_up",
                      titleZh: "AI 发现：回归玩家需要入口页",
                      titleEn: "AI finding: returning players need an entry page",
                      plainSummaryZh:
                        "AI 归纳显示，回归玩家集中询问进入新版本前需要理解哪些背景。",
                      plainSummaryEn:
                        "AI synthesis shows returning players repeatedly ask what context is needed before the new release.",
                      playerNeedZh: "他们需要最小必要背景，而不是完整补课清单。",
                      playerNeedEn:
                        "They need minimum required context, not a full catch-up checklist.",
                      strategyZh: "制作按进度展开的版本入口页，并把可跳过内容折叠。",
                      strategyEn:
                        "Create a progress-aware release entry page and collapse optional context.",
                      affectedPlayers: "20 events · returning · zh-CN: 12 / en: 8",
                      priority: "high",
                      evidenceItems: [
                        "topic=fontaine_catch_up",
                        "languages=zh-CN: 12 / en: 8",
                      ],
                    },
                  ],
                  releaseBriefing: {
                    recommendations: buildAiRecommendations(decisions),
                    executiveSummary: {
                      title: "先补入口页，再推主物料",
                      readout:
                        "玩家不是单纯想看爆点，而是在问进入新版本前要补哪几段。首轮发布要把结论、背景入口和剧透边界放到同一屏。",
                      nextMove:
                        "把最高优先级主题做成一张制作组可审核的内容卡，再排社媒节奏。",
                      evidenceRefs: [topicRef],
                    },
                    playerSegments: [
                      {
                        profile: firstProfile.key,
                        label: "回归玩家",
                        need: "他们需要最小必要背景，不需要完整旧剧情清单。",
                        suggestedSupport:
                          "做按进度展开的入口页，首屏只放必须知道的三件事。",
                        evidenceRefs: [profileRef],
                      },
                    ],
                    opportunityMatrix: [
                      {
                        topicId: firstAction.topicId,
                        topicLabel: firstAction.titleZh,
                        opportunity: firstAction.opportunityScore,
                        risk: firstAction.riskScore,
                        interpretation:
                          "这题有发布价值，但需要先把事实边界写清楚。",
                        recommendedMove: firstAction.recommendedActionZh,
                        evidenceRefs: [topicRef],
                      },
                    ],
                    productionActions: [
                      {
                        title: firstAction.titleZh,
                        owner: "剧情文案",
                        timing: "第 1 周",
                        action: "先出一版已知/未知内容卡。",
                        acceptanceCriteria:
                          "玩家能在首屏分清已确认事实和未公开目的。",
                        evidenceRefs: [topicRef],
                      },
                    ],
                    missingDataQuestions: ["站外社区是否也在问同一个主题？"],
                  },
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const enriched = await enrichInsightsWithAi(base);

    expect(enriched.insightsMode).toBe("ai");
    expect(enriched.briefingCards).toEqual(base.briefingCards);
    expect(enriched.releaseBriefing.mode).toBe("ai");
    expect(enriched.releaseBriefing.recommendations).toHaveLength(3);
    expect(enriched.releaseBriefing.recommendations[0]?.action).toBe(
      "这是 AI 为第 1 个主题生成的具体动作。",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns three deterministic recommendations without calling a model when no key is configured", async () => {
    delete process.env.LLM_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const enriched = await enrichInsightsWithAi(
      aggregateInsights(historicalEvents),
    );

    expect(enriched.insightsMode).toBe("rules_fallback");
    expect(enriched.releaseBriefing.mode).toBe("rules_fallback");
    expect(enriched.releaseBriefing.error).toBe("not_configured");
    expect(enriched.releaseBriefing.recommendations).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back atomically when one AI recommendation cites unsupported evidence", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;

    const base = aggregateInsights(historicalEvents);
    const decisions = computeReleaseDecisions(base);
    const recommendations = buildAiRecommendations(decisions);
    recommendations[0] = {
      ...recommendations[0]!,
      evidenceRefs: ["topic=made_up"],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    releaseBriefing: {
                      recommendations,
                      missingDataQuestions: ["站外是否也有同样信号？"],
                    },
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const enriched = await enrichInsightsWithAi(base);

    expect(enriched.insightsMode).toBe("rules_fallback");
    expect(enriched.releaseBriefing.mode).toBe("rules_fallback");
    expect(enriched.releaseBriefing.error).toBe("invalid_release_recommendations");
    expect(enriched.releaseBriefing.recommendations).toHaveLength(3);
  });

  it("falls back to deterministic cards when the model cites unsupported evidence", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    briefingCards: [
                      {
                        id: "ai-unsupported",
                        topic: "made_up_topic",
                        titleZh: "不应采纳",
                        titleEn: "Should not be accepted",
                        plainSummaryZh: "没有证据。",
                        plainSummaryEn: "No evidence.",
                        playerNeedZh: "未知。",
                        playerNeedEn: "Unknown.",
                        strategyZh: "凭空建议。",
                        strategyEn: "Unsupported suggestion.",
                        affectedPlayers: "unknown",
                        priority: "high",
                        evidenceItems: ["topic=not_in_aggregate"],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const base = aggregateInsights(historicalEvents);
    const enriched = await enrichInsightsWithAi(base);

    expect(enriched.insightsMode).toBe("rules_fallback");
    expect(enriched.briefingCards).toEqual(base.briefingCards);
    expect(enriched.releaseBriefing.mode).toBe("rules_fallback");
    expect(enriched.releaseBriefing.recommendations).toHaveLength(3);
  });

  it("falls back atomically when the model returns fewer than three recommendations", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;

    const base = aggregateInsights(historicalEvents);
    const recommendations = buildAiRecommendations(computeReleaseDecisions(base)).slice(0, 2);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    releaseBriefing: {
                      recommendations,
                      missingDataQuestions: ["站外是否也有同样信号？"],
                    },
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const enriched = await enrichInsightsWithAi(base);

    expect(enriched.insightsMode).toBe("rules_fallback");
    expect(enriched.releaseBriefing.mode).toBe("rules_fallback");
    expect(enriched.releaseBriefing.recommendations).toHaveLength(3);
  });
});
