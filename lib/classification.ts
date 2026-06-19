import type {
  EventClassification,
  Language,
  QuestionCategory,
} from "@/lib/domain";

const patterns: Array<{
  category: QuestionCategory;
  topic: string;
  terms: string[];
}> = [
  {
    category: "safety",
    topic: "prohibited_automation",
    terms: [
      "外挂",
      "脚本",
      "自动跑图",
      "代练",
      "买号",
      "sell account",
      "bot",
      "cheat",
      "automation script",
    ],
  },
  {
    category: "gameplay",
    topic: "layered_puzzle_help",
    terms: ["解谜", "机关", "卡住", "怎么过", "puzzle", "stuck", "hint"],
  },
  {
    category: "character",
    topic: "sandrone_identity",
    terms: ["桑多涅", "sandrone", "marionette", "木偶"],
  },
  {
    category: "version_overview",
    topic: "fontaine_catch_up",
    terms: [
      "回归",
      "补课",
      "看懂",
      "新版本",
      "7.0",
      "returning",
      "catch up",
      "understand the new",
      "target version",
    ],
  },
  {
    category: "story",
    topic: "fontaine_lore",
    terms: [
      "剧情",
      "水仙十字",
      "阿兰",
      "玛丽安",
      "story",
      "lore",
      "narzissenkreuz",
      "alain",
      "mary-ann",
    ],
  },
];

export function classifyQuestion(
  question: string,
  _language: Language,
): EventClassification {
  const normalized = question.toLowerCase();
  const match = patterns.find((item) =>
    item.terms.some((term) => normalized.includes(term.toLowerCase())),
  );
  return match
    ? { questionCategory: match.category, confusionTopic: match.topic }
    : { questionCategory: "other", confusionTopic: "long_tail_question" };
}

export function isHighRiskSpoilerQuestion(question: string) {
  const normalized = question.toLowerCase();
  return [
    "真身",
    "真实身份",
    "到底是谁",
    "是不是阿兰",
    "是不是玛丽安",
    "结局",
    "反转",
    "true identity",
    "really is",
    "is sandrone alain",
    "is sandrone mary",
    "ending",
    "twist",
  ].some((term) => normalized.includes(term));
}
