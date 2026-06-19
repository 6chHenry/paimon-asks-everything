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
