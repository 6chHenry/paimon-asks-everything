import type {
  Language,
  Profile,
  QuestionCategory,
  QuestionEvent,
} from "@/lib/domain";

const templates: Array<{
  language: Language;
  profile: Profile;
  category: QuestionCategory;
  topic: string;
  count: number;
  consentSample?: string;
}> = [
  {
    language: "zh-CN",
    profile: "returning",
    category: "version_overview",
    topic: "fontaine_catch_up",
    count: 12,
    consentSample: "我停在枫丹，现在需要补哪些内容才能看懂新版本？",
  },
  {
    language: "en",
    profile: "returning",
    category: "version_overview",
    topic: "fontaine_catch_up",
    count: 8,
    consentSample: "I stopped after Fontaine. What context do I actually need?",
  },
  {
    language: "zh-CN",
    profile: "story",
    category: "character",
    topic: "sandrone_identity",
    count: 9,
    consentSample: "桑多涅和枫丹机械研究到底是什么关系？",
  },
  {
    language: "en",
    profile: "story",
    category: "character",
    topic: "sandrone_identity",
    count: 5,
  },
  {
    language: "en",
    profile: "exploration",
    category: "gameplay",
    topic: "layered_puzzle_help",
    count: 9,
    consentSample: "Can I get a hint without the full puzzle solution?",
  },
  {
    language: "zh-CN",
    profile: "exploration",
    category: "gameplay",
    topic: "layered_puzzle_help",
    count: 4,
  },
  {
    language: "zh-CN",
    profile: "new",
    category: "story",
    topic: "terminology",
    count: 5,
  },
  {
    language: "en",
    profile: "new",
    category: "story",
    topic: "terminology",
    count: 7,
  },
  {
    language: "zh-CN",
    profile: "returning",
    category: "story",
    topic: "gnosis_collection_purpose",
    count: 10,
    consentSample: "愚人众收集神之心到底想做什么？哪些是已经确认的？",
  },
  {
    language: "en",
    profile: "returning",
    category: "story",
    topic: "gnosis_collection_purpose",
    count: 6,
    consentSample: "What is actually confirmed about why the Fatui collect Gnoses?",
  },
  {
    language: "zh-CN",
    profile: "story",
    category: "story",
    topic: "tsaritsa_goal",
    count: 8,
    consentSample: "冰之女皇反对旧世界，是否就等于她要用神之心对抗天理？",
  },
  {
    language: "en",
    profile: "story",
    category: "story",
    topic: "tsaritsa_goal",
    count: 5,
  },
  {
    language: "zh-CN",
    profile: "returning",
    category: "story",
    topic: "gnosis_journey",
    count: 7,
    consentSample: "从六国到挪德卡莱，神之心分别经历了什么？",
  },
  {
    language: "en",
    profile: "returning",
    category: "story",
    topic: "gnosis_journey",
    count: 6,
  },
  {
    language: "zh-CN",
    profile: "story",
    category: "story",
    topic: "gnosis_third_descender",
    count: 5,
    consentSample: "神之心是第三降临者遗骨，这能证明女皇的计划吗？",
  },
  {
    language: "en",
    profile: "story",
    category: "story",
    topic: "gnosis_third_descender",
    count: 4,
  },
];

export const historicalEvents: QuestionEvent[] = templates.flatMap(
  (template, groupIndex) =>
    Array.from({ length: template.count }, (_, index) => ({
      id: `seed-${groupIndex}-${index}`,
      occurredAt: new Date(
        Date.UTC(2026, 5, 1 + ((groupIndex * 5 + index) % 17), 8 + (index % 8)),
      ).toISOString(),
      language: template.language,
      playerProfile: template.profile,
      questionCategory: template.category,
      confusionTopic: template.topic,
      spoilerGateTriggered: template.topic === "sandrone_identity" && index % 3 === 0,
      usedExternalSearch: index % 5 === 0,
      responseStatus: "answered",
      sourceKind: "historical_sample",
      questionText:
        template.consentSample && index === 0 ? template.consentSample : undefined,
      textConsent: Boolean(template.consentSample && index === 0),
    })),
);
