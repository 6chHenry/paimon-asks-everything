import type { Citation, Language } from "@/lib/domain";
import type { SearchIntent } from "@/lib/external-search";

const genericPagePattern =
  /欢迎来到|开放编辑|游戏数据库|图鉴资料|攻略内容|contents?\s+\d|navigation|overview\s+profile\s+storyline\s+voice-overs|dressing room\s+companion\s+gallery|wiki.*database|open(?:ly)? edited|game database/iu;
const gameplayPattern =
  /\/技能|\/天赋|\/命座|技能|天赋|命座|普通攻击|元素战技|元素爆发|长按|抗打断|倍率|冷却|伤害|skill|talent|constellation|normal attack|elemental skill|elemental burst|cooldown|damage/iu;

export function cleanEvidenceText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060\ufeff]/gu, "")
    .replace(/\[(?:\d{1,3}|编辑|edit)\]/giu, "")
    .replace(/\bToggle\b(?:\s+\w+){0,3}/giu, "")
    .replace(/\bContents?\b(?:\s+\d+(?:\.\d+)*)*/giu, "")
    .replace(/\bGallery\b|\bChange History\b|\bReferences\b|\bNavigation\b/giu, "")
    .replace(/&n(?:s)?bp;|&nbsp;/giu, " ")
    .replace(/\s+/gu, " ")
    .replace(/^[。；，、,.!?：:\s]+/u, "")
    .trim();
}

export function compactCleanEvidence(value: string, maxLength = 700) {
  const clean = cleanEvidenceText(value);
  if (clean.length <= maxLength) return clean;
  const candidate = clean.slice(0, maxLength);
  const boundary = Math.max(
    candidate.lastIndexOf("。"),
    candidate.lastIndexOf("！"),
    candidate.lastIndexOf("？"),
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? "),
  );
  return (boundary >= Math.floor(maxLength * 0.55)
    ? candidate.slice(0, boundary + 1)
    : candidate
  ).trim();
}

export function isGenericEvidence(citation: Citation) {
  return genericPagePattern.test(`${citation.title} ${citation.excerpt}`);
}

export function isGameplayEvidence(citation: Citation) {
  return gameplayPattern.test(
    `${decodeURIComponentSafe(citation.url)} ${citation.title} ${citation.excerpt}`,
  );
}

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function looksLikeGameplayQuestion(question: string) {
  return /技能|天赋|命座|倍率|伤害|冷却|配队|武器|圣遗物|玩法|机制|怎么打|build|skill|talent|constellation|damage|cooldown|weapon|artifact/iu.test(
    question,
  );
}

export function selectAnswerEvidence(
  citations: Citation[],
  input: { question: string; intent: SearchIntent },
) {
  return citations
    .filter((citation) => {
      if (!cleanEvidenceText(citation.excerpt || citation.title)) return false;
      if (isGenericEvidence(citation)) return false;
      if (
        citation.assessment?.contentKind === "gameplay_guide" &&
        !looksLikeGameplayQuestion(input.question)
      ) {
        return false;
      }
      if (
        (input.intent === "identity" || input.intent === "current_status") &&
        !looksLikeGameplayQuestion(input.question) &&
        isGameplayEvidence(citation)
      ) {
        return false;
      }
      return true;
    })
    .map((citation, index) => ({
      ...citation,
      id: citation.external ? `external-${index + 1}` : citation.id,
    }));
}

export function evidenceForGeneration(citation: Citation) {
  return {
    id: citation.id,
    title: cleanEvidenceText(citation.title),
    summary: compactCleanEvidence(citation.excerpt, 320),
    excerpt: compactCleanEvidence(citation.excerpt),
    sourceName: citation.sourceName,
    sourceKind: citation.sourceKind,
    credibility: citation.credibility,
    factStatus: citation.factStatus,
    external: true,
    sourceAssessment: citation.assessment,
  };
}

export function safeBoundaryAnswer(
  language: Language,
  subject: string | undefined,
  hasEvidence: boolean,
) {
  if (language === "zh-CN") {
    if (!hasEvidence) {
      return "派蒙暂时没找到足够可靠的资料，先不乱下结论。";
    }
    return subject
      ? `目前找到的资料还不足以稳妥回答“${subject}”这个问题。派蒙先不把外文摘要硬拼成结论，相关原文保留在下方来源里。`
      : "目前找到的资料还不足以稳妥下结论。派蒙先不把外文摘要硬拼进回答，相关原文保留在下方来源里。";
  }
  return hasEvidence
    ? "The available evidence is not strong enough for a reliable conclusion yet. The original sources are preserved below."
    : "Paimon could not find enough reliable evidence to answer without guessing.";
}
