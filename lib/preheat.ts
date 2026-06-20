import { gnosisKnowledgeEntries } from "@/data/gnosis-knowledge";
import { relationGraphs, relationNodes } from "@/data/gnosis-relations";
import { gnosisTimeline } from "@/data/gnosis-timeline";
import {
  defaultPreheatTopicId,
  preheatTopics,
} from "@/data/preheat-topics";
import type {
  FactStatus,
  KnowledgeEntry,
  Language,
  PreheatDepth,
  PreheatTopic,
  Progress,
  RelationGraph,
  RelationNode,
  TimelineNode,
} from "@/lib/domain";
import type { PreheatQuery } from "@/lib/schemas";

const progressRank: Record<Progress, number> = {
  unknown: 0,
  mondstadt: 1,
  liyue: 2,
  inazuma: 3,
  sumeru: 4,
  fontaine: 5,
  natlan: 6,
  nodkrai: 7,
};

const depthLabels: Record<
  PreheatDepth,
  { zh: string; en: string; durationZh: string; durationEn: string }
> = {
  guided: {
    zh: "3 分钟轻剧透",
    en: "3-minute guided path",
    durationZh: "确认事件链与关键关系",
    durationEn: "Confirmed event chain and key ties",
  },
  research: {
    zh: "完整考据",
    en: "Research view",
    durationZh: "事件、暗示与争议边界",
    durationEn: "Events, implications, and disputed boundaries",
  },
};

function localizedEntry(conceptId: string, language: Language) {
  return gnosisKnowledgeEntries.find(
    (entry) => entry.conceptId === conceptId && entry.language === language,
  );
}

function entryVisible(
  entry: KnowledgeEntry,
  query: Pick<PreheatQuery, "progress">,
) {
  if (entry.minimumProgress === "unknown") return true;
  if (query.progress === "unknown") return false;
  return progressRank[entry.minimumProgress] <= progressRank[query.progress];
}

function localizeTopic(topic: PreheatTopic, language: Language) {
  return {
    id: topic.id,
    title: language === "zh-CN" ? topic.titleZh : topic.titleEn,
    intro: language === "zh-CN" ? topic.introZh : topic.introEn,
    suggestedQuestions:
      language === "zh-CN"
        ? topic.suggestedQuestionsZh
        : topic.suggestedQuestionsEn,
  };
}

function localizeRelationNode(node: RelationNode, language: Language) {
  return {
    id: node.id,
    label: language === "zh-CN" ? node.labelZh : node.labelEn,
    kind: node.kind,
    conceptIds: node.conceptIds,
  };
}

function localizeGraph(
  graph: RelationGraph,
  language: Language,
  query: Pick<PreheatQuery, "progress">,
) {
  const visibleEdges = graph.edges.filter((edge) =>
    edge.conceptIds.some((conceptId) => {
      const entry = localizedEntry(conceptId, language);
      return entry ? entryVisible(entry, query) : false;
    }),
  );
  const visibleNodeIds = new Set(
    visibleEdges.flatMap((edge) => [edge.from, edge.to]),
  );
  return {
    id: graph.id,
    nodes: graph.nodeIds
      .filter((id) => visibleNodeIds.has(id))
      .map((id) => relationNodes.find((node) => node.id === id))
      .filter((node): node is RelationNode => Boolean(node))
      .map((node) => localizeRelationNode(node, language)),
    edges: visibleEdges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: language === "zh-CN" ? edge.labelZh : edge.labelEn,
      factStatus: edge.factStatus,
      conceptIds: edge.conceptIds,
    })),
  };
}

function localizeTimelineNode(
  node: TimelineNode,
  query: PreheatQuery,
  includeImplications: boolean,
) {
  const eventEntries = node.eventConceptIds
    .map((id) => localizedEntry(id, query.language))
    .filter((entry): entry is KnowledgeEntry => Boolean(entry));
  const visibleEvents = eventEntries.filter((entry) =>
    entryVisible(entry, query),
  );
  const implications = includeImplications
    ? node.implicationConceptIds
        .map((id) => localizedEntry(id, query.language))
        .filter((entry): entry is KnowledgeEntry => Boolean(entry))
        .filter((entry) => entryVisible(entry, query))
    : [];
  const locked = visibleEvents.length === 0;
  return {
    id: node.id,
    region: node.region,
    title: locked
      ? query.language === "zh-CN"
        ? "该地区主线事件已锁定"
        : "Regional main-quest event locked"
      : query.language === "zh-CN"
        ? node.titleZh
        : node.titleEn,
    locked,
    events: visibleEvents,
    implications,
    relationGraphId: node.relationGraphId,
  };
}

function buildNarration(
  topic: PreheatTopic,
  depth: PreheatDepth,
  language: Language,
  entries: KnowledgeEntry[],
) {
  const visible = entries.slice(0, depth === "guided" ? 8 : 10);
  const lead =
    language === "zh-CN"
      ? depth === "guided"
        ? "先沿着已经确认的事件走一遍，再把“发生了什么”和“为什么发生”分开。"
        : "完整考据会把确定事件与文本暗示分层，也不会越过你尚未完成的地区主线。"
      : depth === "guided"
        ? "Follow the confirmed events first, then separate what happened from why it happened."
        : "The research view separates confirmed events from textual implications and never bypasses unfinished regional main quests.";
  return {
    lead,
    points: visible.map((entry) => entry.summary),
    factBoundary:
      language === "zh-CN"
        ? `当前主题由 ${topic.depthConceptIds[depth].length} 个受控概念编排；没有模型密钥也会返回同一事实结构。`
        : `This topic is orchestrated from ${topic.depthConceptIds[depth].length} controlled concepts; the fact structure stays deterministic without a model key.`,
  };
}

export function validatePreheatCatalog() {
  const conceptIds = new Set(gnosisKnowledgeEntries.map((entry) => entry.conceptId));
  const timelineIds = new Set(gnosisTimeline.map((node) => node.id));
  const graphIds = new Set(relationGraphs.map((graph) => graph.id));
  const relationNodeIds = new Set(relationNodes.map((node) => node.id));
  const errors: string[] = [];

  for (const topic of preheatTopics) {
    for (const conceptId of [
      ...topic.heroConceptIds,
      ...Object.values(topic.depthConceptIds).flat(),
    ]) {
      if (!conceptIds.has(conceptId)) errors.push(`topic:${topic.id}:${conceptId}`);
    }
    for (const nodeId of topic.timelineNodeIds) {
      if (!timelineIds.has(nodeId)) errors.push(`topic:${topic.id}:${nodeId}`);
    }
    if (!graphIds.has(topic.relationGraphId)) {
      errors.push(`topic:${topic.id}:${topic.relationGraphId}`);
    }
  }

  for (const node of gnosisTimeline) {
    for (const conceptId of [
      ...node.eventConceptIds,
      ...node.implicationConceptIds,
    ]) {
      if (!conceptIds.has(conceptId)) errors.push(`timeline:${node.id}:${conceptId}`);
    }
    if (!graphIds.has(node.relationGraphId)) {
      errors.push(`timeline:${node.id}:${node.relationGraphId}`);
    }
  }

  for (const graph of relationGraphs) {
    if (graph.nodeIds.length > 8) errors.push(`graph:${graph.id}:too_many_nodes`);
    for (const nodeId of graph.nodeIds) {
      if (!relationNodeIds.has(nodeId)) errors.push(`graph:${graph.id}:${nodeId}`);
    }
    for (const edge of graph.edges) {
      if (!graph.nodeIds.includes(edge.from) || !graph.nodeIds.includes(edge.to)) {
        errors.push(`edge:${edge.id}:outside_graph`);
      }
      for (const conceptId of edge.conceptIds) {
        if (!conceptIds.has(conceptId)) errors.push(`edge:${edge.id}:${conceptId}`);
      }
    }
  }
  return errors;
}

export function isValidPreheatTarget(
  topicId: string,
  kind: "depth_selected" | "timeline_node_opened" | "relation_node_opened",
  targetId: string,
) {
  const topic = preheatTopics.find((item) => item.id === topicId);
  if (!topic) return false;
  if (kind === "depth_selected") {
    return ["guided", "research"].includes(targetId);
  }
  if (kind === "timeline_node_opened") {
    return topic.timelineNodeIds.includes(targetId);
  }
  const graphIds = new Set([
    topic.relationGraphId,
    ...topic.timelineNodeIds
      .map((id) => gnosisTimeline.find((node) => node.id === id)?.relationGraphId)
      .filter((id): id is string => Boolean(id)),
  ]);
  return relationGraphs
    .filter((graph) => graphIds.has(graph.id))
    .some((graph) => graph.nodeIds.includes(targetId));
}

export function getPreheatView(query: PreheatQuery) {
  const topic =
    preheatTopics.find((item) => item.id === query.topicId) ??
    preheatTopics.find((item) => item.id === defaultPreheatTopicId)!;
  const entries = topic.depthConceptIds[query.depth]
    .map((conceptId) => localizedEntry(conceptId, query.language))
    .filter((entry): entry is KnowledgeEntry => Boolean(entry))
    .filter((entry) => entryVisible(entry, query))
    .filter(
      (entry) =>
        query.depth === "research" ||
        entry.factStatus !== "community_speculation",
    );
  const timeline = topic.timelineNodeIds
    .map((id) => gnosisTimeline.find((node) => node.id === id))
    .filter((node): node is TimelineNode => Boolean(node))
    .map((node) =>
      localizeTimelineNode(node, query, query.depth === "research"),
    );
  const graph = relationGraphs.find(
    (item) => item.id === topic.relationGraphId,
  )!;

  return {
    topic: localizeTopic(topic, query.language),
    topics: preheatTopics.map((item) => localizeTopic(item, query.language)),
    depth: {
      id: query.depth,
      label:
        query.language === "zh-CN"
          ? depthLabels[query.depth].zh
          : depthLabels[query.depth].en,
      description:
        query.language === "zh-CN"
          ? depthLabels[query.depth].durationZh
          : depthLabels[query.depth].durationEn,
    },
    narration: buildNarration(topic, query.depth, query.language, entries),
    evidence: entries,
    timeline,
    relationGraph: localizeGraph(graph, query.language, query),
    availableRelationGraphs: Object.fromEntries(
      [graph.id, ...timeline.map((node) => node.relationGraphId)].map((id) => {
        const target = relationGraphs.find((item) => item.id === id)!;
        return [id, localizeGraph(target, query.language, query)];
      }),
    ),
    contentNotice:
      query.language === "zh-CN"
        ? "至冬预热题设 · 只使用已实装内容 · 地区剧情按主线完成状态解锁"
        : "Snezhnaya preheat scenario · Released content only · Regional story unlocks by main-quest completion",
  };
}

export type PreheatView = ReturnType<typeof getPreheatView>;
export type PreheatFactStatus = FactStatus;
