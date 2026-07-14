import type { KnowledgeEntry, Language } from "@/lib/domain";

const factionFacts = [
  {
    conceptId: "tsaritsa-harbingers-command",
    zh: {
      title: "冰之女皇领导愚人众执行官",
      content:
        "冰之女皇是至冬与愚人众的最高领导者。愚人众执行官是组织核心成员，受命在各国执行任务；多位执行官明确把女皇称为自己的效忠对象，但各自加入组织的个人动机并不完全相同。",
      summary:
        "冰之女皇领导愚人众，执行官受命贯彻其意志，但个人动机各不相同。",
      aliases: [
        "冰之女皇",
        "女皇",
        "愚人众",
        "愚人众执行官",
        "执行官",
      ],
    },
    en: {
      title: "The Tsaritsa leads the Fatui Harbingers",
      content:
        "The Tsaritsa is the supreme leader of Snezhnaya and the Fatui. The Fatui Harbingers are core members who carry out missions across Teyvat; several explicitly name the Tsaritsa as the object of their loyalty, while their personal reasons for joining are not identical.",
      summary:
        "The Tsaritsa leads the Fatui, and the Harbingers carry out her will while retaining different personal motives.",
      aliases: [
        "Tsaritsa",
        "Fatui",
        "Fatui Harbingers",
        "Harbingers",
        "Cryo Archon",
      ],
    },
    tags: ["fatui", "harbingers", "relationship", "organization"],
    contentType: "character" as const,
    spoilerLevel: 1 as const,
    minimumProgress: "mondstadt" as const,
    factStatus: "trusted_secondary" as const,
    source: {
      title: "愚人众（游戏文本索引）",
      url: "https://wiki.biligame.com/ys/%E6%84%9A%E4%BA%BA%E4%BC%97",
      sourceName: "原神WIKI_BWIKI",
      sourceKind: "trusted_wiki" as const,
    },
  },
];

export const factionKnowledgeEntries: KnowledgeEntry[] = factionFacts.flatMap(
  (fact) =>
    (["zh-CN", "en"] as Language[]).map((language) => {
      const localized = language === "zh-CN" ? fact.zh : fact.en;
      return {
        id: `${fact.conceptId}-${language === "zh-CN" ? "zh" : "en"}`,
        conceptId: fact.conceptId,
        language,
        ...localized,
        tags: fact.tags,
        contentType: fact.contentType,
        spoilerLevel: fact.spoilerLevel,
        minimumProgress: fact.minimumProgress,
        factStatus: fact.factStatus,
        source: fact.source,
        reviewed: true,
      };
    }),
);
