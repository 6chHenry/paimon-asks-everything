import type {
  FactStatus,
  Focus,
  Language,
  Profile,
  Progress,
  SourceKind,
  SpoilerPreference,
} from "@/lib/domain";

export const labels = {
  profile: {
    new: { "zh-CN": "新玩家", en: "New player" },
    returning: { "zh-CN": "回归玩家", en: "Returning player" },
    story: { "zh-CN": "剧情关注者", en: "Story seeker" },
    exploration: { "zh-CN": "玩法 / 探索", en: "Explorer" },
    casual: { "zh-CN": "轻量玩家", en: "Casual player" },
  },
  progress: {
    unknown: { "zh-CN": "不确定 / 暂不说明", en: "Not sure yet" },
    mondstadt: { "zh-CN": "蒙德", en: "Mondstadt" },
    liyue: { "zh-CN": "璃月", en: "Liyue" },
    inazuma: { "zh-CN": "稻妻", en: "Inazuma" },
    sumeru: { "zh-CN": "须弥", en: "Sumeru" },
    fontaine: { "zh-CN": "枫丹", en: "Fontaine" },
    natlan: { "zh-CN": "纳塔", en: "Natlan" },
    nodkrai: {
      "zh-CN": "挪德卡莱（月之一至月之七）",
      en: "Nod-Krai (Luna I–VII)",
    },
  },
  spoiler: {
    none: { "zh-CN": "无剧透", en: "Spoiler-free" },
    low: { "zh-CN": "轻度剧透", en: "Light spoilers" },
    full: { "zh-CN": "可完整解释", en: "Full context" },
  },
  focus: {
    story: { "zh-CN": "剧情", en: "Story" },
    character: { "zh-CN": "角色", en: "Characters" },
    gameplay: { "zh-CN": "玩法 / 探索", en: "Gameplay" },
    overview: { "zh-CN": "版本概览", en: "Overview" },
  },
  fact: {
    official_explicit: { "zh-CN": "官方明确", en: "Officially explicit" },
    narrative_implied: { "zh-CN": "剧情暗示", en: "Narratively implied" },
    trusted_secondary: { "zh-CN": "高可信二手资料", en: "Trusted secondary source" },
    community_analysis: { "zh-CN": "社区分析", en: "Community analysis" },
    community_speculation: { "zh-CN": "社区推测", en: "Community speculation" },
    demo_hypothesis: { "zh-CN": "Demo 假设", en: "Demo hypothesis" },
  },
  sourceKind: {
    official: { "zh-CN": "官方", en: "Official" },
    game_text: { "zh-CN": "游戏文本", en: "Game text" },
    wiki: { "zh-CN": "Wiki", en: "Wiki" },
    trusted_wiki: { "zh-CN": "高可信 Wiki", en: "Trusted wiki" },
    community: { "zh-CN": "社区", en: "Community" },
    unknown_web: { "zh-CN": "网页", en: "Web" },
    demo: { "zh-CN": "Demo", en: "Demo" },
  },
} satisfies {
  profile: Record<Profile, Record<Language, string>>;
  progress: Record<Progress, Record<Language, string>>;
  spoiler: Record<SpoilerPreference, Record<Language, string>>;
  focus: Record<Focus, Record<Language, string>>;
  fact: Record<FactStatus, Record<Language, string>>;
  sourceKind: Record<SourceKind, Record<Language, string>>;
};

export function t(language: Language, zh: string, en: string) {
  return language === "zh-CN" ? zh : en;
}
