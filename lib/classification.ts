import type {
  EventClassification,
  Language,
  QuestionCategory,
} from "@/lib/domain";
import { detectQuestionEntities } from "@/lib/entity-lexicon";

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
    category: "story",
    topic: "gnosis_collection_purpose",
    terms: [
      "为什么收集神之心",
      "收集神之心",
      "神之心用途",
      "why collect gnoses",
      "collecting gnoses",
      "gnosis plan",
    ],
  },
  {
    category: "story",
    topic: "tsaritsa_goal",
    terms: [
      "冰之女皇",
      "女皇目的",
      "女皇目标",
      "tsaritsa",
      "cry o archon",
      "cryo archon",
    ],
  },
  {
    category: "story",
    topic: "gnosis_third_descender",
    terms: [
      "第三降临者",
      "降临者遗骨",
      "third descender",
      "descender remains",
    ],
  },
  {
    category: "story",
    topic: "gnosis_journey",
    terms: [
      "神之心经历",
      "哪些神之心",
      "谁拿走",
      "火神之心",
      "雷神之心",
      "水神之心",
      "火神之心下落",
      "挪德卡莱",
      "月之七",
      "which gnoses",
      "what happened to the gnosis",
      "pyro gnosis",
      "electro gnosis",
      "hydro gnosis",
      "pyro gnosis whereabouts",
      "nod-krai",
      "luna vii",
    ],
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
  if (match) return { questionCategory: match.category, confusionTopic: match.topic };
  if (
    /传说任务|傳說任務|故事梗概|剧情梗概|劇情梗概|story\s*quest|legend(?:ary)?\s+quest/iu.test(
      question,
    )
  ) {
    return {
      questionCategory: "story",
      confusionTopic: "character_story_quest",
    };
  }
  const entity = detectQuestionEntities(question).find(
    (item) => item.kind === "character",
  );
  if (entity) {
    return {
      questionCategory: "character",
      confusionTopic: `character:${entity.canonical}`,
    };
  }
  return { questionCategory: "other", confusionTopic: "long_tail_question" };
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

export function isDeepStoryIntent(
  question: string,
  category?: QuestionCategory,
) {
  if (
    category === "gameplay" ||
    category === "safety" ||
    category === "version_overview"
  ) {
    return false;
  }
  const normalized = question.toLowerCase();
  const shortOnly = [
    "简单说",
    "简短",
    "一句话",
    "不要剧透",
    "briefly",
    "short answer",
    "no spoilers",
  ].some((term) => normalized.includes(term));
  if (shortOnly) return false;
  return [
    "讲一讲",
    "讲讲",
    "完整故事",
    "完整剧情",
    "全剧情",
    "故事线",
    "时间线",
    "梳理",
    "来龙去脉",
    "发生了什么",
    "详细说",
    "介绍一下",
    "故事梗概",
    "剧情梗概",
    "梗概",
    "tell me the story",
    "full story",
    "storyline",
    "timeline",
    "lore explained",
    "explain the lore",
    "what happened",
  ].some((term) => normalized.includes(term));
}
