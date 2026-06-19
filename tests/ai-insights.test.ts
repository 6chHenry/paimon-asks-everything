import { afterEach, describe, expect, it, vi } from "vitest";
import { historicalEvents } from "@/data/events";
import { enrichInsightsWithAi } from "@/lib/ai-insights";
import { aggregateInsights } from "@/lib/insights";

const originalEnv = { ...process.env };

describe("AI insight enrichment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("uses the configured OpenAI-compatible API to generate evidence-bound briefing cards", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;

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
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const base = aggregateInsights(historicalEvents);
    const enriched = await enrichInsightsWithAi(base);

    expect(enriched.insightsMode).toBe("ai");
    expect(enriched.briefingCards[0]?.titleZh).toContain("AI 发现");
    expect(enriched.briefingCards[0]?.strategyEn).toContain("release entry page");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
  });
});
