import { describe, expect, it } from "vitest";
import { classifyQuestion } from "@/lib/classification";
import { detectQuestionEntities } from "@/lib/entity-lexicon";

describe("entity lexicon", () => {
  it("anchors long-tail character questions from known aliases and generic phrasing", () => {
    expect(detectQuestionEntities("丝柯克是外星人")).toEqual([
      {
        canonical: "丝柯克",
        aliases: ["Skirk"],
        kind: "character",
      },
    ]);
    expect(classifyQuestion("丝柯克是外星人", "zh-CN")).toEqual({
      questionCategory: "character",
      confusionTopic: "character:丝柯克",
    });
  });

  it("infers entity anchors from common Chinese question shapes without a hard-coded name", () => {
    expect(detectQuestionEntities("赫利俄斯是外星人")).toEqual([
      {
        canonical: "赫利俄斯",
        aliases: [],
        kind: "character",
      },
    ]);
    expect(detectQuestionEntities("雷电将军和雷电影的关系")).toEqual([
      {
        canonical: "雷电将军",
        aliases: [],
        kind: "character",
      },
      {
        canonical: "雷电影",
        aliases: [],
        kind: "character",
      },
    ]);
    expect(detectQuestionEntities("将军和影的关系")).toEqual([
      {
        canonical: "将军",
        aliases: [],
        kind: "character",
      },
      {
        canonical: "影",
        aliases: [],
        kind: "character",
      },
    ]);
  });
});
