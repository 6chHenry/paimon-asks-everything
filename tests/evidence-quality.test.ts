import { describe, expect, it } from "vitest";
import {
  cleanEvidenceText,
  selectAnswerEvidence,
} from "@/lib/evidence-quality";
import type { Citation } from "@/lib/domain";

function citation(
  id: string,
  title: string,
  excerpt: string,
  url = `https://example.com/${id}`,
): Citation {
  return {
    id,
    title,
    excerpt,
    url,
    sourceName: "Test",
    sourceKind: "trusted_wiki",
    credibility: "trusted_wiki",
    factStatus: "trusted_secondary",
    external: true,
    crossLanguage: false,
  };
}

describe("evidence quality", () => {
  it("removes web footnotes, controls, and invisible characters from generation text", () => {
    expect(
      cleanEvidenceText(
        "Skirk is from the sea of stars.[6][7]\u00ad Toggle Asce Contents 1 History Navigation",
      ),
    ).toBe("Skirk is from the sea of stars. History");
  });

  it("filters generic and gameplay pages for identity questions", () => {
    const selected = selectAnswerEvidence(
      [
        citation("generic", "原神WIKI", "欢迎来到开放编辑的游戏数据库"),
        citation(
          "skill",
          "丝柯克/技能",
          "长按后提高抗打断能力和伤害。",
          "https://wiki.example/丝柯克/技能",
        ),
        citation("identity", "丝柯克", "丝柯克是来自星海的神秘剑客。"),
      ],
      { question: "丝柯克是外星人吗", intent: "identity" },
    );

    expect(selected.map((item) => item.id)).toEqual(["external-1"]);
    expect(selected[0]?.title).toBe("丝柯克");
  });

  it("filters navigation-heavy profile dumps from answer evidence", () => {
    const selected = selectAnswerEvidence(
      [
        citation(
          "profile",
          "Skirk",
          "Skirk Overview Profile Storyline Voice-Overs Dressing Room Companion Gallery",
        ),
        citation("identity", "丝柯克", "丝柯克是来自星海的神秘剑客。"),
      ],
      { question: "丝柯克是外星人吗", intent: "identity" },
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.title).toBe("丝柯克");
  });
});
