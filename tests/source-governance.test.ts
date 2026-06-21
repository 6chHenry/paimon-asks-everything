import { describe, expect, it } from "vitest";
import type { Citation } from "@/lib/domain";
import {
  assessSourceRule,
  extractPublisherIdentity,
  reconcileContentKind,
  sourceAllowedForQuestion,
} from "@/lib/source-governance";

function citation(
  title: string,
  url: string,
  excerpt: string,
): Citation {
  return {
    id: "external-1",
    title,
    url,
    excerpt,
    sourceName: "test",
    sourceKind: "community",
    credibility: "community",
    factStatus: "community_speculation",
    external: true,
    crossLanguage: false,
  };
}

describe("source governance", () => {
  it("treats official-operated wikis as curated references rather than official prose", () => {
    for (const url of [
      "https://baike.mihoyo.com/ys/obc/content/1/detail",
      "https://wiki.hoyolab.com/pc/genshin/entry/1",
    ]) {
      const assessment = assessSourceRule({
        url,
        title: "丝柯克",
        excerpt: "角色资料与游戏内文本。",
      });
      expect(assessment.platformKind).toBe("official_operated_wiki");
      expect(assessment.authority).toBe("curated_reference");
      expect(assessment.publisherKind).toBe("verified_aggregator");
    }
  });

  it("verifies the official Bilibili UID and rejects an official-looking impostor", () => {
    expect(
      extractPublisherIdentity(
        "https://www.bilibili.com/video/BV-official",
        '{"owner":{"mid":401742377,"name":"原神"}} 原神官方账号',
      ),
    ).toMatchObject({
      accountId: "401742377",
      verifiedOfficial: true,
    });
    expect(
      extractPublisherIdentity(
        "https://www.bilibili.com/video/BV-impostor",
        '{"owner":{"mid":12345,"name":"原神官方"}}',
      ).verifiedOfficial,
    ).toBe(false);
  });

  it("separates official and user posts on the same community platform", () => {
    const official = assessSourceRule({
      url: "https://www.miyoushe.com/ys/article/1",
      title: "「月之七」版本更新维护预告",
      excerpt: "制作组预计进行版本更新维护。",
      pageHtml:
        '{"name":"原神","is_official":true,"account_id":"75276550"} 官方认证',
    });
    const user = assessSourceRule({
      url: "https://www.miyoushe.com/ys/article/2",
      title: "我猜丝柯克可能来自别的星球",
      excerpt: "这是个人理解和推测。",
      pageHtml: '{"name":"普通旅行者","account_id":"123"}',
    });

    expect(official.authority).toBe("official");
    expect(user.authority).toBe("community_speculation");
  });

  it("uses the more conservative content class when rules and the model disagree", () => {
    expect(reconcileContentKind("neutral_reference", "speculation")).toBe(
      "speculation",
    );
    expect(reconcileContentKind("speculation", "neutral_reference")).toBe(
      "speculation",
    );
  });

  it("treats question-style community headlines as speculation", () => {
    const assessment = assessSourceRule({
      url: "https://www.miyoushe.com/ys/article/64381637",
      title: "丝柯克原来是外星人的吗？-原神社区-米游社",
      excerpt: "玩家讨论角色来源。",
    });
    expect(assessment.contentKind).toBe("speculation");
    expect(assessment.authority).toBe("community_speculation");
  });

  it("blocks gameplay guides for lore questions but keeps them for gameplay questions", () => {
    const guide = citation(
      "丝柯克一图流养成攻略",
      "https://example.com/skirk-guide",
      "武器推荐、圣遗物主词条、配队和输出手法。",
    );
    guide.assessment = assessSourceRule({
      url: guide.url,
      title: guide.title,
      excerpt: guide.excerpt,
    });
    const plan = {
      coreEntities: ["丝柯克"],
      aliases: ["Skirk"],
      intent: "identity" as const,
      queries: ["丝柯克 身份"],
    };

    expect(
      sourceAllowedForQuestion(guide, {
        question: "丝柯克是外星人吗",
        plan,
      }),
    ).toBe(false);
    expect(
      sourceAllowedForQuestion(guide, {
        question: "丝柯克怎么配队，圣遗物怎么选",
        plan: { ...plan, intent: "general" },
      }),
    ).toBe(true);
  });

  it("requires all core entities in relationship evidence", () => {
    const single = citation(
      "桑多涅",
      "https://example.com/sandrone",
      "这里只介绍桑多涅。",
    );
    single.assessment = assessSourceRule({
      url: single.url,
      title: single.title,
      excerpt: single.excerpt,
    });
    expect(
      sourceAllowedForQuestion(single, {
        question: "桑多涅和阿兰是什么关系",
        plan: {
          coreEntities: ["桑多涅", "阿兰"],
          aliases: [],
          intent: "relationship",
          queries: ["桑多涅 阿兰 关系"],
        },
      }),
    ).toBe(false);
  });

  it("does not let a personal plot-analysis video prove Story Quest facts", () => {
    const analysis = citation(
      "法尔伽传说任务剧情梳理",
      "https://www.bilibili.com/video/BV-user-analysis",
      "个人解析法尔伽传说任务的主题和结局。",
    );
    analysis.assessment = assessSourceRule({
      url: analysis.url,
      title: analysis.title,
      excerpt: analysis.excerpt,
    });

    expect(
      sourceAllowedForQuestion(analysis, {
        question: "法尔伽传说任务故事梗概",
        plan: {
          coreEntities: ["法尔伽"],
          aliases: ["Varka"],
          intent: "story",
          queries: ["法尔伽传说任务故事梗概"],
          storyScope: "character_story_quest",
        },
      }),
    ).toBe(false);
  });

  it("classifies story cut and full-dialogue videos as game text references without making them official", () => {
    const assessment = assessSourceRule({
      url: "https://www.bilibili.com/video/BV1DrL26REm2/",
      title: "富人和博士全对话彩蛋，6.6主线剧情cut合集",
      excerpt:
        "博士与富人的对话，富人的肺还是博士给换的，剧情PV和游戏内主线cut。",
    });

    expect(assessment.contentKind).toBe("game_text_reference");
    expect(assessment.authority).toBe("community_analysis");
    expect(assessment.signals).toContain("story-cut-reference");
  });

  it("classifies relationship dialogue snippets as game text references", () => {
    const assessment = assessSourceRule({
      url: "https://www.douyin.com/search/%E5%AF%8C%E4%BA%BA%E5%8D%9A%E5%A3%AB",
      title: "富人和博士对话什么意思 - 抖音",
      excerpt: "巴老师看博士富人唠嗑得知富人烟瘾大到需要换肺：博士亲手换的吗",
    });

    expect(assessment.contentKind).toBe("game_text_reference");
    expect(assessment.authority).toBe("community_analysis");
    expect(assessment.signals).toContain("dialogue-reference");
  });
});
