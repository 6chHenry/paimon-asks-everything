import type { Language } from "@/lib/domain";
import type { ChatResult } from "@/lib/domain";

export type SnezhnayaNodeKind =
  | "character"
  | "organization"
  | "concept"
  | "event"
  | "item"
  | "text_clue";

export type SnezhnayaEvidenceTier =
  | "official_explicit"
  | "official_text_index"
  | "official_text_implication"
  | "community_theory";

export type SnezhnayaSourceType =
  | "official_video"
  | "quest_text"
  | "weapon_text"
  | "artifact_text"
  | "character_story"
  | "voice_over"
  | "wiki_text_index"
  | "community_analysis";

export type SnezhnayaGraphGroup =
  | "sovereign"
  | "organization"
  | "director"
  | "harbinger"
  | "lore";

export type SnezhnayaNodeStatus =
  | "active"
  | "former"
  | "deceased"
  | "dormant"
  | "unknown";

export type SnezhnayaEdgeDirection = "forward" | "bidirectional";
export type SnezhnayaEdgeTone =
  | "command"
  | "opposition"
  | "plan"
  | "lore";

export type LocalizedText = Record<Language, string>;
export type LocalizedParagraphs = Record<Language, string[]>;

export interface SnezhnayaGraphPosition {
  x: number;
  y: number;
}

export interface SnezhnayaVideoMeta {
  title: LocalizedText;
  description: LocalizedText;
  coverImageUrl: string;
  youtubeUrl: string;
  miyousheUrl: string;
}

export interface SnezhnayaTextClue {
  id: string;
  title: string;
  sourceType: SnezhnayaSourceType;
  tier: SnezhnayaEvidenceTier;
  url?: string;
  excerpt: LocalizedText;
}

export interface SnezhnayaNode {
  id: string;
  label: LocalizedText;
  aliases: string[];
  kind: SnezhnayaNodeKind;
  tier: SnezhnayaEvidenceTier;
  graphGroup?: SnezhnayaGraphGroup;
  graphPosition?: SnezhnayaGraphPosition;
  status?: SnezhnayaNodeStatus;
  statusLabel?: LocalizedText;
  harbingerRank?: number;
  imageUrl?: string;
  summary: LocalizedText;
  detail: LocalizedParagraphs;
  clues: SnezhnayaTextClue[];
  relatedNodeIds: string[];
  suggestedQuestions: Record<Language, string[]>;
}

export interface SnezhnayaEdge {
  id: string;
  from: string;
  to: string;
  tier: SnezhnayaEvidenceTier;
  label: LocalizedText;
  direction?: SnezhnayaEdgeDirection;
  tone?: SnezhnayaEdgeTone;
  showLabel?: boolean;
}

export interface SnezhnayaGraphData {
  video: SnezhnayaVideoMeta;
  nodes: SnezhnayaNode[];
  edges: SnezhnayaEdge[];
}

const evidenceTierLabels: Record<SnezhnayaEvidenceTier, LocalizedText> = {
  official_explicit: {
    "zh-CN": "官方明确",
    en: "Official explicit",
  },
  official_text_index: {
    "zh-CN": "官方文本索引",
    en: "Official text index",
  },
  official_text_implication: {
    "zh-CN": "官方文本暗示",
    en: "Official text implication",
  },
  community_theory: {
    "zh-CN": "社区推测",
    en: "Community theory",
  },
};

export function evidenceTierLabel(
  tier: SnezhnayaEvidenceTier,
  language: Language,
) {
  return evidenceTierLabels[tier][language];
}

export function localize(value: LocalizedText, language: Language) {
  return value[language] || value["zh-CN"] || value.en;
}

export function initialSnezhnayaNodeId(graph: SnezhnayaGraphData) {
  return graph.nodes[0]?.id ?? "";
}

export function nodeDetailFacts(node: SnezhnayaNode, language: Language) {
  const facts: Array<{ label: string; value: string }> = [];
  const isZh = language === "zh-CN";
  facts.push({ label: isZh ? "名称" : "Name", value: localize(node.label, language) });
  facts.push({ label: isZh ? "类型" : "Type", value: node.kind.replace("_", " ") });
  if (node.harbingerRank) {
    facts.push({
      label: isZh ? "席位" : "Seat",
      value: isZh ? `第 ${node.harbingerRank} 席` : `Seat ${node.harbingerRank}`,
    });
  }
  if (node.aliases.length) {
    facts.push({
      label: isZh ? "别名" : "Aliases",
      value: node.aliases.join(" / "),
    });
  }
  if (node.statusLabel) {
    facts.push({
      label: isZh ? "状态" : "Status",
      value: localize(node.statusLabel, language),
    });
  }
  facts.push({
    label: isZh ? "可信度" : "Evidence",
    value: evidenceTierLabel(node.tier, language),
  });
  return facts;
}

const sourceParentheticalPatterns = [
  /[（(]\s*(?:来自|来源|资料来自|参考|出处)\s*[:：]?\s*[^()（）]{1,80}?[)）]/giu,
  /[（(]\s*(?:from|source|via|according to)\s*[:：]?\s*[^()（）]{1,80}?[)）]/giu,
];

function cleanSourceParentheticals(text: string) {
  let cleaned = text;
  for (const pattern of sourceParentheticalPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned
    .replace(/\s+([，。！？；：,.!?;:])/gu, "$1")
    .replace(/([。！？.!?])\s*([。！？.!?])+/gu, "$1")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

export function cleanRelationshipAnswerForDisplay(result: ChatResult): ChatResult {
  return {
    ...result,
    answer: cleanSourceParentheticals(result.answer),
    answerParagraphs: result.answerParagraphs?.map((paragraph) => ({
      ...paragraph,
      text: cleanSourceParentheticals(paragraph.text),
    })),
  };
}

export function validateSnezhnayaGraph(graph: SnezhnayaGraphData) {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const clueIds = new Set<string>();

  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) errors.push(`node:${node.id}:duplicate`);
    nodeIds.add(node.id);

    if (!node.label["zh-CN"] || !node.label.en) {
      errors.push(`node:${node.id}:label`);
    }
    if (!node.summary["zh-CN"] || !node.summary.en) {
      errors.push(`node:${node.id}:summary`);
    }
    if (!node.detail["zh-CN"]?.length || !node.detail.en?.length) {
      errors.push(`node:${node.id}:detail`);
    }
    if (!node.graphGroup) {
      errors.push(`node:${node.id}:group`);
    }
    if (
      !node.graphPosition ||
      node.graphPosition.x < 0 ||
      node.graphPosition.x > 100 ||
      node.graphPosition.y < 0 ||
      node.graphPosition.y > 100
    ) {
      errors.push(`node:${node.id}:position`);
    }

    for (const clue of node.clues) {
      if (clueIds.has(clue.id)) errors.push(`clue:${clue.id}:duplicate`);
      clueIds.add(clue.id);
      if (!clue.excerpt["zh-CN"] || !clue.excerpt.en) {
        errors.push(`clue:${clue.id}:excerpt`);
      }
    }
  }

  for (const node of graph.nodes) {
    for (const relatedId of node.relatedNodeIds) {
      if (!nodeIds.has(relatedId)) {
        errors.push(`node:${node.id}:related:${relatedId}`);
      }
    }
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`edge:${edge.id}:from:${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) errors.push(`edge:${edge.id}:to:${edge.to}`);
    if (!edge.label["zh-CN"] || !edge.label.en) {
      errors.push(`edge:${edge.id}:label`);
    }
  }

  return errors;
}

function nodeContext(node: SnezhnayaNode, language: Language) {
  const label = localize(node.label, language);
  const aliases = node.aliases.length ? ` (${node.aliases.join(", ")})` : "";
  const clues = node.clues
    .slice(0, 4)
    .map((clue) => `${clue.title}: ${localize(clue.excerpt, language)}`)
    .join("\n");
  return `${label}${aliases}\n${localize(node.summary, language)}${
    clues ? `\n${clues}` : ""
  }`;
}

export function buildRelationshipQuestion({
  language,
  left,
  right,
}: {
  language: Language;
  left: SnezhnayaNode;
  right: SnezhnayaNode;
}) {
  const leftLabel = localize(left.label, language);
  const rightLabel = localize(right.label, language);

  if (language === "en") {
    return [
      `Based on official story text, official text indexes, and trustworthy sources, explain whether "${leftLabel}" and "${rightLabel}" have a confirmed relationship, textual implication, community theory, or no reliable evidence.`,
      "Treat trusted wiki transcriptions of in-game text as official text indexes, but identify that they are indexed or transcribed sources.",
      "Do not present community theories as official facts. Keep the answer in English and cite sources.",
      "",
      `Left node:\n${nodeContext(left, language)}`,
      "",
      `Right node:\n${nodeContext(right, language)}`,
    ].join("\n");
  }

  return [
    `请基于官方剧情文本、官方文本索引和可信资料，解释「${leftLabel}」和「${rightLabel}」之间是否存在已确认关系、文本暗示、社区推测或未证实内容。`,
    "可信 wiki 收录的游戏内文本、任务台词、武器/圣遗物/角色故事原文可以作为官方文本索引使用，但回答里要说明这是索引或转录来源。",
    "不要把社区推测说成官方事实。请用中文回答，并给出来源。",
    "",
    `节点 A：\n${nodeContext(left, language)}`,
    "",
    `节点 B：\n${nodeContext(right, language)}`,
  ].join("\n");
}
