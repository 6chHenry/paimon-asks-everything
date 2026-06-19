import { knowledgeEntries } from "@/data/knowledge";
import type {
  Focus,
  KnowledgeEntry,
  Language,
  Progress,
  SpoilerPreference,
} from "@/lib/domain";

const progressRank: Record<Progress, number> = {
  unknown: 0,
  mondstadt: 1,
  liyue: 2,
  inazuma: 3,
  sumeru: 4,
  fontaine: 5,
  natlan: 6,
};

const aliases: Record<string, string[]> = {
  桑多涅: ["sandrone", "marionette", "木偶"],
  sandrone: ["桑多涅", "木偶", "marionette"],
  枫丹: ["fontaine"],
  fontaine: ["枫丹"],
  水仙十字: ["narzissenkreuz"],
  narzissenkreuz: ["水仙十字"],
  阿兰: ["alain", "alain guillotin"],
  alain: ["阿兰", "阿兰吉约丹"],
  玛丽安: ["mary-ann", "marianne"],
  "mary-ann": ["玛丽安"],
  解谜: ["puzzle", "hint"],
  机关: ["puzzle", "mechanism", "解谜"],
  卡住: ["stuck", "hint", "解谜"],
  puzzle: ["解谜", "机关", "提示"],
};

const stopwords = new Set([
  "a",
  "an",
  "and",
  "are",
  "do",
  "does",
  "he",
  "her",
  "his",
  "how",
  "i",
  "is",
  "it",
  "me",
  "my",
  "of",
  "the",
  "to",
  "what",
  "who",
  "why",
  "you",
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .split(/\s+/)
    .filter((term) => term && !stopwords.has(term));
}

function expandedTerms(question: string) {
  const base = new Set(tokenize(question));
  const lowered = question.toLowerCase();
  for (const [key, values] of Object.entries(aliases)) {
    if (lowered.includes(key.toLowerCase())) {
      base.add(key.toLowerCase());
      values.flatMap(tokenize).forEach((term) => base.add(term));
    }
  }
  return [...base];
}

function allowedSpoilerLevel(preference: SpoilerPreference) {
  if (preference === "none") return 0;
  if (preference === "low") return 1;
  return 2;
}

export interface RetrievalResult {
  entries: Array<KnowledgeEntry & { score: number; crossLanguage: boolean }>;
  blockedHighRisk: KnowledgeEntry[];
  topScore: number;
}

export function retrieveControlled({
  question,
  language,
  progress,
  spoilerPreference,
  focus,
  allowHighRisk = false,
}: {
  question: string;
  language: Language;
  progress: Progress;
  spoilerPreference: SpoilerPreference;
  focus: Focus[];
  allowHighRisk?: boolean;
}): RetrievalResult {
  const terms = expandedTerms(question);
  const maxSpoiler = allowHighRisk ? 3 : allowedSpoilerLevel(spoilerPreference);
  const blockedHighRisk: KnowledgeEntry[] = [];

  const scored = knowledgeEntries
    .map((entry) => {
      const haystack = [
        entry.title,
        entry.summary,
        entry.content,
        ...entry.aliases,
        ...entry.tags,
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += term.length > 2 ? 2 : 1;
        if (entry.aliases.some((alias) => alias.toLowerCase().includes(term))) {
          score += 2;
        }
      }
      if (score > 0) {
        if (entry.language === language) score += 1.5;
        if (focus.includes(entry.contentType as Focus)) score += 0.75;
        if (
          entry.minimumProgress !== "unknown" &&
          progressRank[progress] < progressRank[entry.minimumProgress]
        ) {
          score -= 1;
        }
      }
      return { ...entry, score, crossLanguage: entry.language !== language };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const entry of scored) {
    if (entry.spoilerLevel === 3 && !allowHighRisk) {
      blockedHighRisk.push(entry);
    }
  }

  const safe = scored
    .filter((entry) => entry.spoilerLevel <= maxSpoiler)
    .filter(
      (entry, index, all) =>
        all.findIndex((candidate) => candidate.conceptId === entry.conceptId) ===
        index,
    )
    .slice(0, 4);

  return {
    entries: safe,
    blockedHighRisk,
    topScore: safe[0]?.score ?? 0,
  };
}
