import { afterEach, describe, expect, it, vi } from "vitest";
import {
  reconcileQuestionUnderstanding,
  ruleUnderstandQuestion,
  shouldUseModelQuestionUnderstanding,
  understandQuestion,
  understandQuestionWithModel,
} from "@/lib/question-understanding";

const originalEnv = { ...process.env };

describe("question understanding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("merges model aliases when they agree with explicit rule entities", () => {
    const rule = ruleUnderstandQuestion("丝柯克是外星人", "zh-CN");
    const reconciled = reconcileQuestionUnderstanding("丝柯克是外星人", rule, {
      entities: [
        {
          canonical: "Skirk",
          aliases: ["丝柯克"],
          kind: "character",
        },
      ],
      intent: "identity",
      claim: "是否来自提瓦特之外",
      queries: ["Skirk sea of stars origin"],
    });

    expect(reconciled.entities).toEqual([
      {
        canonical: "丝柯克",
        aliases: ["Skirk"],
        kind: "character",
      },
    ]);
    expect(reconciled.agreement).toBe("confirmed");
    expect(reconciled.intent).toBe("identity");
  });

  it("keeps explicit rule entities when the model drifts to another subject", () => {
    const rule = ruleUnderstandQuestion("雷电将军和雷电影的关系", "zh-CN");
    const reconciled = reconcileQuestionUnderstanding("雷电将军和雷电影的关系", rule, {
      entities: [
        { canonical: "桑多涅", aliases: ["Sandrone"], kind: "character" },
        { canonical: "阿兰", aliases: ["Alain"], kind: "character" },
      ],
      intent: "relationship",
      queries: ["桑多涅 阿兰 关系"],
    });

    expect(reconciled.entities.map((entity) => entity.canonical)).toEqual([
      "雷电将军",
      "雷电影",
    ]);
    expect(reconciled.queries.every((query) => query.includes("雷电将军"))).toBe(
      true,
    );
    expect(reconciled.agreement).toBe("conflict");
  });

  it("promotes explicit aliases to fuller canonical names when rule and model agree", () => {
    const rule = ruleUnderstandQuestion("将军和影的关系", "zh-CN");
    const reconciled = reconcileQuestionUnderstanding("将军和影的关系", rule, {
      entities: [
        { canonical: "雷电将军", aliases: ["将军"], kind: "character" },
        { canonical: "雷电影", aliases: ["影"], kind: "character" },
      ],
      intent: "relationship",
      queries: ["雷电将军 雷电影 关系"],
    });

    expect(reconciled.entities.map((entity) => entity.canonical)).toEqual([
      "雷电将军",
      "雷电影",
    ]);
    expect(reconciled.entities[0]?.aliases).toContain("将军");
    expect(reconciled.entities[1]?.aliases).toContain("影");
    expect(reconciled.agreement).toBe("confirmed");
  });

  it("recognizes generated graph relationship prompts without model review", () => {
    const question = [
      "请基于官方剧情文本、官方文本索引和可信资料，解释「富人」和「博士」之间是否存在已确认关系、文本暗示、社区推测或未证实内容。",
      "可信 wiki 收录的游戏内文本、任务台词、武器/圣遗物/角色故事原文可以作为官方文本索引使用。",
      "不要把社区推测说成官方事实。请用中文回答，并给出来源。",
    ].join("\n");
    const rule = ruleUnderstandQuestion(question, "zh-CN");

    expect(rule.entities.map((entity) => entity.canonical)).toEqual([
      "富人",
      "博士",
    ]);
    expect(rule.intent).toBe("relationship");
    expect(shouldUseModelQuestionUnderstanding(question, rule)).toBe(false);
  });

  it("asks the model to review the raw question only", async () => {
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
                  entities: [{ canonical: "丝柯克", aliases: ["Skirk"], kind: "character" }],
                  intent: "identity",
                  claim: "是否来自提瓦特之外",
                  queries: ["丝柯克 星海 身份", "Skirk sea of stars origin"],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const model = await understandQuestionWithModel("丝柯克是外星人", "zh-CN");
    const firstCall = fetchMock.mock.calls[0] as unknown as
      | [RequestInfo | URL, RequestInit]
      | undefined;
    const body = JSON.parse(String(firstCall?.[1].body));

    expect(body.messages[1].content).toContain('"question":"丝柯克是外星人"');
    expect(body.messages[1].content).not.toContain("controlledEvidence");
    expect(model?.entities[0]?.canonical).toBe("丝柯克");
    expect(model?.queries[0]).toContain("丝柯克");
  });

  it("skips the model when rules already identify a clear entity and intent", async () => {
    process.env.LLM_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await understandQuestion("丝柯克到底是什么人", "zh-CN");

    expect(result.entities[0]?.canonical).toBe("丝柯克");
    expect(result.intent).toBe("identity");
    expect(result.agreement).toBe("rule_only");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the model to enrich aliases for an inferred character Story Quest", () => {
    const rule = ruleUnderstandQuestion("法尔伽传说任务故事梗概", "zh-CN");

    expect(rule.entities).toEqual([
      { canonical: "法尔伽", aliases: [], kind: "character" },
    ]);
    expect(rule.intent).toBe("story");
    expect(shouldUseModelQuestionUnderstanding("法尔伽传说任务故事梗概", rule)).toBe(
      true,
    );
  });

  it("keeps the English alias and Story Quest query returned for a new character", () => {
    const rule = ruleUnderstandQuestion("法尔伽传说任务故事梗概", "zh-CN");
    const reconciled = reconcileQuestionUnderstanding(
      "法尔伽传说任务故事梗概",
      rule,
      {
        entities: [
          { canonical: "法尔伽", aliases: ["Varka"], kind: "character" },
        ],
        intent: "story",
        claim: "法尔伽传说任务梗概",
        queries: ["Varka story quest", "法尔伽 传说任务 剧情"],
      },
    );

    expect(reconciled.entities[0]?.aliases).toContain("Varka");
    expect(reconciled.queries).toContain("Varka story quest");
  });
});
