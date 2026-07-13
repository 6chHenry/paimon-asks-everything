import { describe, expect, it } from "vitest";
import {
  cleanEvidenceText,
  evidenceForGeneration,
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

  it("decodes HTML entities before evidence reaches generation", () => {
    expect(cleanEvidenceText("婕德：她会孤独吗&hellip;")).toBe(
      "婕德:她会孤独吗…",
    );

    const selected = selectAnswerEvidence(
      [
        citation(
          "supported-entity",
          "婕德剧情变化",
          "婕德选择自己的道路&hellip;",
        ),
      ],
      { question: "婕德经历了怎样的变化？", intent: "story", language: "zh-CN" },
    );

    expect(selected).toHaveLength(1);
    expect(evidenceForGeneration(selected[0]!).excerpt).toBe(
      "婕德选择自己的道路…",
    );
  });

  it("rejects unresolved named and numeric entities before generation", () => {
    const generated = selectAnswerEvidence(
      [
        citation(
          "unsupported-named",
          "婕德剧情变化",
          "婕德选择自己的道路&amp;copy;",
        ),
        citation(
          "unsupported-numeric",
          "婕德&#0;关系",
          "婕德与塔尼特部族决裂。",
        ),
      ],
      { question: "婕德经历了怎样的变化？", intent: "story", language: "zh-CN" },
    ).map(evidenceForGeneration);

    expect(generated).toEqual([]);
  });

  it("rejects duplicated site chrome for a character-arc answer", () => {
    const selected = selectAnswerEvidence(
      [
        citation(
          "chrome",
          "旅行者创作平台-观测枢-原神wiki",
          "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki",
        ),
        citation(
          "arc",
          "因为她的罪恶滔天…",
          "婕德发现芭别尔的陷害后与塔尼特决裂，并决定选择自己的道路。",
        ),
      ],
      { question: "婕德经历了怎么的变化？", intent: "story", language: "zh-CN" },
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.title).toBe("因为她的罪恶滔天…");
  });

  it("rejects a standalone dialogue dump for a character-arc answer", () => {
    const selected = selectAnswerEvidence(
      [
        citation(
          "dialogue",
          "婕德对话",
          "婕德：那个家伙让我不爽。婕德：现在安静了。婕德：她会孤独吗？婕德：真可惜。",
        ),
      ],
      { question: "婕德经历了怎样的变化？", intent: "story", language: "zh-CN" },
    );

    expect(selected).toEqual([]);
  });

  it("keeps dialogue-shaped evidence for a relationship answer", () => {
    const selected = selectAnswerEvidence(
      [
        citation(
          "relationship-dialogue",
          "富人与博士对话",
          "博士：肺是我换的。富人：研究由北国银行资助。博士：合作继续。富人：条件不变。",
        ),
      ],
      {
        question: "富人和博士是什么关系？",
        intent: "relationship",
        language: "zh-CN",
      },
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.title).toBe("富人与博士对话");
  });
});
