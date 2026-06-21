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

  it("never exposes cross-language evidence to a Chinese answer", () => {
    const english = citation(
      "english",
      "To Those Who Embark on the Expedition",
      "Varka's Story Quest follows the expedition's return.",
      "https://genshin-impact.fandom.com/wiki/To_Those_Who_Embark_on_the_Expedition",
    );
    english.crossLanguage = true;
    const chinese = citation(
      "chinese",
      "法尔伽传说任务",
      "法尔伽传说任务讲述远征军的归途。",
      "https://baike.mihoyo.com/ys/obc/content/777/detail",
    );

    const selected = selectAnswerEvidence([english, chinese], {
      question: "法尔伽传说任务故事梗概",
      intent: "story",
      language: "zh-CN",
    });

    expect(selected).toHaveLength(1);
    expect(selected[0]?.title).toBe("法尔伽传说任务");
  });

  it("rejects an English Wiki page even when its snippet contains Chinese aliases", () => {
    const englishWiki = citation(
      "english-wiki",
      "Varka",
      "Varka is the Grand Master. 简体中文名：法尔伽。",
      "https://genshin-impact.fandom.com/wiki/Varka",
    );

    const selected = selectAnswerEvidence([englishWiki], {
      question: "法尔伽是谁",
      intent: "identity",
      language: "zh-CN",
    });

    expect(selected).toEqual([]);
  });

  it("keeps relationship story-cut evidence even when platform snippets are generic", () => {
    const video = citation(
      "video",
      "巴老师看博士富人唠嗑得知富人烟瘾大到需要换肺：博士亲手换的吗",
      "更多实用攻略教学，热门游戏视频7*24小时持续更新。",
      "https://www.bilibili.com/video/BV-test/",
    );
    video.sourceKind = "community";
    video.credibility = "community";
    video.factStatus = "community_analysis";
    video.assessment = {
      platformKind: "video_platform",
      publisherKind: "unknown",
      contentKind: "game_text_reference",
      authority: "community_analysis",
      signals: ["video-platform", "story-cut-reference"],
      confidence: "low",
    };

    const selected = selectAnswerEvidence([video], {
      question: "富人和博士的关系",
      intent: "relationship",
      language: "zh-CN",
      plan: {
        coreEntities: ["富人", "博士"],
        aliases: ["Pantalone", "Dottore"],
        intent: "relationship",
        queries: ["富人 博士 关系"],
      },
    });

    expect(selected).toHaveLength(1);
    expect(selected[0]?.title).toContain("换肺");
  });
});
