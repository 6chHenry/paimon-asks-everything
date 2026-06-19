import type { KnowledgeEntry, Language } from "@/lib/domain";

const officialCharacterUrl =
  "https://genshin.hoyoverse.com/en/news/detail/157790";
const wikiBase = "https://genshin-impact.fandom.com/wiki/";

type PairSeed = Omit<
  KnowledgeEntry,
  "id" | "language" | "reviewed" | "title" | "content" | "summary" | "aliases"
> & {
  zh: Pick<KnowledgeEntry, "title" | "content" | "summary" | "aliases">;
  en: Pick<KnowledgeEntry, "title" | "content" | "summary" | "aliases">;
};

const pairs: PairSeed[] = [
  {
    conceptId: "fontaine-bridge",
    zh: {
      title: "从枫丹回归的最小必要背景",
      content:
        "如果你已经完成枫丹主线，就不需要先补完所有旧任务。理解机械生命、枫丹科学院与水仙十字相关人物如何讨论“人格、记忆与机器”这条线，已经足以建立后续角色理解所需的基础。",
      summary: "枫丹主线玩家只需补少量机械与人格主题背景。",
      aliases: ["枫丹", "回归", "补课", "看懂", "Fontaine"],
    },
    en: {
      title: "The minimum Fontaine catch-up",
      content:
        "If you have finished Fontaine's Archon Quest, you do not need to clear every old quest first. The useful bridge is the way Fontaine's research stories discuss machines, memory, and personhood through the Fontaine Research Institute and the Narzissenkreuz circle.",
      summary: "A Fontaine player only needs a small bridge around machines and personhood.",
      aliases: ["Fontaine", "returning", "catch up", "understand"],
    },
    tags: ["fontaine", "catch-up", "returning"],
    contentType: "version_overview",
    spoilerLevel: 0,
    minimumProgress: "fontaine",
    factStatus: "demo_hypothesis",
    source: {
      title: "7.0 version-understanding scenario",
      url: "/evaluation#method",
      sourceName: "Paimon Demo specification",
      sourceKind: "demo",
    },
  },
  {
    conceptId: "sandrone-public",
    zh: {
      title: "桑多涅的公开身份",
      content:
        "桑多涅（“木偶”）是愚人众执行官之一。公开角色资料将她与机械研究、自动机关和对技术的强烈兴趣联系起来；这些信息可以用于角色主题介绍，但不能据此断言尚未公开的版本剧情。",
      summary: "公开资料确认桑多涅是与机械研究高度相关的执行官。",
      aliases: ["桑多涅", "木偶", "Sandrone", "Marionette", "执行官"],
    },
    en: {
      title: "Sandrone's public identity",
      content:
        "Sandrone, also known as The Marionette, is one of the Fatui Harbingers. Public character material associates her with mechanical research and automatons; that supports a thematic introduction, not claims about an unannounced version plot.",
      summary: "Public material identifies Sandrone as a Harbinger closely tied to machinery.",
      aliases: ["Sandrone", "Marionette", "Harbinger", "木偶"],
    },
    tags: ["sandrone", "character", "fatui"],
    contentType: "character",
    spoilerLevel: 0,
    minimumProgress: "mondstadt",
    factStatus: "official_explicit",
    source: {
      title: "Character introduction: Sandrone",
      url: officialCharacterUrl,
      sourceName: "Genshin Impact",
      sourceKind: "official",
    },
  },
  {
    conceptId: "alain-guillotin",
    zh: {
      title: "阿兰·吉约丹与枫丹机械研究",
      content:
        "阿兰·吉约丹是枫丹科学院早期历史中的重要研究者，并与西摩等机械造物的技术脉络相关。他提供的是枫丹“机器能否承载人格与使命”主题的历史背景。",
      summary: "阿兰是理解枫丹机械研究传统的关键历史人物。",
      aliases: ["阿兰", "阿兰吉约丹", "Alain Guillotin", "科学院"],
    },
    en: {
      title: "Alain Guillotin and Fontaine engineering",
      content:
        "Alain Guillotin is an important figure in the early history of the Fontaine Research Institute and is connected to the technical lineage behind mechanical creations such as Seymour. His story frames Fontaine's recurring questions about machines, identity, and purpose.",
      summary: "Alain anchors the history of Fontaine's machine research.",
      aliases: ["Alain", "Alain Guillotin", "Fontaine Research Institute"],
    },
    tags: ["alain", "fontaine", "research"],
    contentType: "story",
    spoilerLevel: 1,
    minimumProgress: "fontaine",
    factStatus: "official_explicit",
    source: {
      title: "Alain Guillotin",
      url: `${wikiBase}Alain_Guillotin`,
      sourceName: "Genshin Impact Wiki",
      sourceKind: "wiki",
    },
  },
  {
    conceptId: "mary-ann",
    zh: {
      title: "玛丽安与水仙十字的关系",
      content:
        "玛丽安·吉约丹与水仙十字院的童年共同体有关，她和阿兰、雅各布、雷内等人的关系构成了枫丹世界任务的重要情感起点。",
      summary: "玛丽安连接了阿兰与水仙十字院的共同历史。",
      aliases: ["玛丽安", "Mary-Ann", "水仙十字院", "Narzissenkreuz"],
    },
    en: {
      title: "Mary-Ann and the Narzissenkreuz circle",
      content:
        "Mary-Ann Guillotin belongs to the childhood circle formed around the Narzissenkreuz Institute. Her ties to Alain, Jakob, and Rene become the emotional starting point of Fontaine's long world-quest chain.",
      summary: "Mary-Ann links Alain to the shared history of the Narzissenkreuz group.",
      aliases: ["Mary-Ann", "Marianne", "Narzissenkreuz", "玛丽安"],
    },
    tags: ["mary-ann", "narzissenkreuz", "fontaine"],
    contentType: "story",
    spoilerLevel: 1,
    minimumProgress: "fontaine",
    factStatus: "official_explicit",
    source: {
      title: "Mary-Ann",
      url: `${wikiBase}Mary-Ann`,
      sourceName: "Genshin Impact Wiki",
      sourceKind: "wiki",
    },
  },
  {
    conceptId: "narzissenkreuz-themes",
    zh: {
      title: "水仙十字故事的核心主题",
      content:
        "水仙十字相关任务反复讨论身份延续、记忆复制、意志与躯壳的关系。它与机械角色的关联首先是主题层面的，不应自动写成尚未公开角色之间的直接剧情联系。",
      summary: "水仙十字提供身份、记忆与载体的主题背景。",
      aliases: ["水仙十字", "Narzissenkreuz", "人格", "记忆", "机械"],
    },
    en: {
      title: "Themes of the Narzissenkreuz story",
      content:
        "The Narzissenkreuz quests repeatedly examine continuity of identity, copied memories, will, and physical vessels. Their relevance to mechanical characters is thematic first; it does not prove a direct unreleased plot connection.",
      summary: "Narzissenkreuz provides thematic context about identity, memory, and vessels.",
      aliases: ["Narzissenkreuz", "identity", "memory", "machine"],
    },
    tags: ["narzissenkreuz", "theme", "identity"],
    contentType: "story",
    spoilerLevel: 1,
    minimumProgress: "fontaine",
    factStatus: "narrative_implied",
    source: {
      title: "Narzissenkreuz Ordo",
      url: `${wikiBase}Narzissenkreuz_Ordo`,
      sourceName: "Genshin Impact Wiki",
      sourceKind: "wiki",
    },
  },
  {
    conceptId: "seymour",
    zh: {
      title: "西摩：机械与记忆的可见案例",
      content:
        "西摩是一台与玛丽安相关的机械犬。它的指令、记忆与长期使命让枫丹的机械人格主题变得具体，是回归玩家理解相关叙事时最容易抓住的例子。",
      summary: "西摩让机械记忆与使命主题变得具体。",
      aliases: ["西摩", "Seymour", "机械犬", "玛丽安"],
    },
    en: {
      title: "Seymour: a concrete case of machine memory",
      content:
        "Seymour is a mechanical hound connected to Mary-Ann. Its directives, memory, and long-running mission make Fontaine's machine-personhood theme tangible for returning players.",
      summary: "Seymour makes Fontaine's machine-memory theme concrete.",
      aliases: ["Seymour", "mechanical hound", "Mary-Ann", "西摩"],
    },
    tags: ["seymour", "machine", "memory"],
    contentType: "story",
    spoilerLevel: 1,
    minimumProgress: "fontaine",
    factStatus: "official_explicit",
    source: {
      title: "Seymour",
      url: `${wikiBase}Seymour`,
      sourceName: "Genshin Impact Wiki",
      sourceKind: "wiki",
    },
  },
  {
    conceptId: "fontaine-institute",
    zh: {
      title: "枫丹科学院的作用",
      content:
        "枫丹科学院代表了将能源、机关与实验制度化的研究传统。理解它的历史，有助于区分枫丹本地技术脉络与其他地区机械研究之间的联系和差异。",
      summary: "科学院是枫丹机械技术脉络的制度背景。",
      aliases: ["枫丹科学院", "研究院", "Fontaine Research Institute"],
    },
    en: {
      title: "What the Fontaine Research Institute represents",
      content:
        "The Fontaine Research Institute represents an institutional tradition of energy and mechanical experimentation. Its history helps separate Fontaine's local research lineage from machinery developed elsewhere.",
      summary: "The Institute is the institutional backdrop of Fontaine engineering.",
      aliases: ["Fontaine Research Institute", "Institute", "科学院"],
    },
    tags: ["fontaine", "institute", "research"],
    contentType: "version_overview",
    spoilerLevel: 0,
    minimumProgress: "fontaine",
    factStatus: "official_explicit",
    source: {
      title: "Fontaine Research Institute",
      url: `${wikiBase}Fontaine_Research_Institute`,
      sourceName: "Genshin Impact Wiki",
      sourceKind: "wiki",
    },
  },
  {
    conceptId: "khaenriah-machines",
    zh: {
      title: "跨地区机械研究背景",
      content:
        "提瓦特的机械技术并非只有枫丹一条来源。坎瑞亚遗迹机械、须弥研究与枫丹机关各有历史，因此看到相似技术时应先确认文本证据，不能只凭外形断言同源。",
      summary: "相似机械外形不等于技术同源。",
      aliases: ["坎瑞亚", "遗迹机械", "须弥", "机械", "Khaenri'ah"],
    },
    en: {
      title: "Cross-regional machinery context",
      content:
        "Teyvat has more than one lineage of machinery. Khaenri'ahn ruin machines, Sumeru research, and Fontaine engineering have distinct histories, so visual similarity alone does not establish a shared origin.",
      summary: "Similar machines do not automatically share an origin.",
      aliases: ["Khaenri'ah", "Ruin machines", "Sumeru", "machinery"],
    },
    tags: ["machine", "khaenriah", "sumeru"],
    contentType: "version_overview",
    spoilerLevel: 0,
    minimumProgress: "sumeru",
    factStatus: "official_explicit",
    source: {
      title: "Ruin Machine",
      url: `${wikiBase}Ruin_Machine`,
      sourceName: "Genshin Impact Wiki",
      sourceKind: "wiki",
    },
  },
  {
    conceptId: "direct-connection-caution",
    zh: {
      title: "桑多涅与阿兰是否存在直接关系",
      content:
        "现有公开信息足以说明两者都与机械研究主题有关，但不足以把桑多涅直接认定为阿兰、玛丽安或其他枫丹人物。这样的身份对应属于高风险推测。",
      summary: "公开证据支持主题关联，不支持直接身份等同。",
      aliases: ["桑多涅", "阿兰", "玛丽安", "关系", "身份"],
    },
    en: {
      title: "Is Sandrone directly connected to Alain?",
      content:
        "Public information supports a thematic connection through mechanical research, but it does not establish that Sandrone is Alain, Mary-Ann, or another Fontaine figure. Any identity equivalence remains high-risk speculation.",
      summary: "Evidence supports thematic relevance, not identity equivalence.",
      aliases: ["Sandrone", "Alain", "Mary-Ann", "identity", "connection"],
    },
    tags: ["sandrone", "alain", "speculation"],
    contentType: "character",
    spoilerLevel: 2,
    minimumProgress: "fontaine",
    factStatus: "community_speculation",
    source: {
      title: "Evidence boundary note",
      url: "/evaluation#method",
      sourceName: "Paimon Demo evidence policy",
      sourceKind: "demo",
    },
  },
  {
    conceptId: "high-risk-identity",
    zh: {
      title: "高风险身份推测的处理",
      content:
        "把机械角色与历史人物直接等同，会涉及关键身份揭示和剧情反转。即使玩家允许完整解释，系统也应在当前问题上再次确认，并把推测与官方事实分开。",
      summary: "关键身份推测必须二次确认且不得伪装成事实。",
      aliases: ["真身", "身份", "反转", "是谁", "剧透"],
    },
    en: {
      title: "Handling high-risk identity theories",
      content:
        "Equating a mechanical character with a historical person would reveal a major identity twist. The system must reconfirm for the current question and keep speculation separate from official fact.",
      summary: "Major identity theories require reconfirmation and careful labeling.",
      aliases: ["true identity", "twist", "who is", "spoiler"],
    },
    tags: ["identity", "spoiler", "sandrone"],
    contentType: "story",
    spoilerLevel: 3,
    minimumProgress: "natlan",
    factStatus: "community_speculation",
    source: {
      title: "High-risk spoiler interaction policy",
      url: "/evaluation#method",
      sourceName: "Paimon Demo spoiler policy",
      sourceKind: "demo",
    },
  },
  {
    conceptId: "mechanical-puzzle",
    zh: {
      title: "机关解谜的分层提示方法",
      content:
        "面对机关卡点，先观察可交互物、颜色与运动规律，再确认能量或顺序机制，最后才给出完整操作顺序。分层提示保留玩家自行发现的空间。",
      summary: "机关解谜应先观察、再机制、最后完整步骤。",
      aliases: ["解谜", "机关", "卡住", "提示", "puzzle"],
    },
    en: {
      title: "Layered hints for mechanical puzzles",
      content:
        "For a mechanical puzzle, first inspect interactable objects, colors, and motion; then identify the energy or sequence rule; only then reveal the full operation order. Layered hints preserve discovery.",
      summary: "Puzzle help should progress from observation to mechanism to solution.",
      aliases: ["puzzle", "mechanism", "stuck", "hint", "机关"],
    },
    tags: ["gameplay", "puzzle", "hint"],
    contentType: "gameplay",
    spoilerLevel: 0,
    minimumProgress: "mondstadt",
    factStatus: "demo_hypothesis",
    source: {
      title: "Layered hint design",
      url: "/evaluation#method",
      sourceName: "Paimon Demo specification",
      sourceKind: "demo",
    },
  },
  {
    conceptId: "version-hypothesis",
    zh: {
      title: "7.0 发行场景假设",
      content:
        "本 Demo 假设目标版本会让玩家重新关注机械研究、旧角色线索与跨版本叙事，因此演示如何按进度提供背景。该假设只用于产品设计，不代表官方版本信息。",
      summary: "7.0 仅是发行设计场景，不是剧情爆料。",
      aliases: ["7.0", "目标版本", "新版本", "版本卖点"],
    },
    en: {
      title: "The 7.0 release-scenario hypothesis",
      content:
        "This demo assumes a target version may renew interest in mechanical research and older narrative threads, then demonstrates progress-aware catch-up. It is a product-design scenario, not official version information.",
      summary: "7.0 is a release-design scenario, not a plot leak.",
      aliases: ["7.0", "target version", "new version", "version"],
    },
    tags: ["version", "hypothesis", "overview"],
    contentType: "version_overview",
    spoilerLevel: 0,
    minimumProgress: "unknown",
    factStatus: "demo_hypothesis",
    source: {
      title: "7.0 scenario statement",
      url: "/evaluation#method",
      sourceName: "Paimon Demo specification",
      sourceKind: "demo",
    },
  },
];

export const knowledgeEntries: KnowledgeEntry[] = pairs.flatMap((pair) =>
  (["zh-CN", "en"] as Language[]).map((language) => {
    const localized = language === "zh-CN" ? pair.zh : pair.en;
    return {
      id: `${pair.conceptId}-${language === "zh-CN" ? "zh" : "en"}`,
      conceptId: pair.conceptId,
      language,
      title: localized.title,
      content: localized.content,
      summary: localized.summary,
      aliases: localized.aliases,
      tags: pair.tags,
      contentType: pair.contentType,
      spoilerLevel: pair.spoilerLevel,
      minimumProgress: pair.minimumProgress,
      factStatus: pair.factStatus,
      source: pair.source,
      reviewed: true,
    };
  }),
);
