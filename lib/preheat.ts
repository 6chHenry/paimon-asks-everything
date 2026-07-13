import { gnosisKnowledgeEntries } from "@/data/gnosis-knowledge";
import { relationGraphs, relationNodes } from "@/data/gnosis-relations";
import { gnosisTimeline } from "@/data/gnosis-timeline";
import {
  getPreheatRegionGuide,
  namedProgress,
  validatePreheatRegionGuides,
  type NamedProgress,
} from "@/data/preheat-region-guides";
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
import { buildStoryPresentation } from "@/lib/preheat-personalization";
import { normalizeVisibleProfile } from "@/lib/visible-profiles";

const progressRank: Record<Progress, number> = {
  unknown: 0,
  mondstadt: 1,
  liyue: 2,
  inazuma: 3,
  sumeru: 4,
  fontaine: 5,
  natlan: 6,
  nodkrai: 7,
  snezhnaya: 8,
};

const depthLabels: Record<
  PreheatDepth,
  { zh: string; en: string; durationZh: string; durationEn: string }
> = {
  guided: {
    zh: "已过剧情回顾",
    en: "Story recap",
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
  options: { allowFutureRegions?: boolean } = {},
) {
  if (options.allowFutureRegions) return true;
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

function localizeTopicHeader(topic: PreheatTopic, language: Language) {
  const localized = localizeTopic(topic, language);
  return {
    id: localized.id,
    title: localized.title,
    intro: localized.intro,
  };
}

function localizeRelationDetail(entry: KnowledgeEntry) {
  return {
    id: entry.conceptId,
    title: entry.title,
    summary: entry.summary,
    factStatus: entry.factStatus,
    sourceTitle: entry.source.title,
    sourceUrl: entry.source.url,
  };
}

function relationNodeDetails(
  node: RelationNode,
  edges: RelationGraph["edges"],
  language: Language,
  query: Pick<PreheatQuery, "progress">,
  options: { allowFutureRegions?: boolean } = {},
) {
  const incidentConceptIds = edges
    .filter((edge) => edge.from === node.id || edge.to === node.id)
    .flatMap((edge) => edge.conceptIds);
  const conceptIds = [...new Set([...node.conceptIds, ...incidentConceptIds])];
  return conceptIds
    .map((conceptId) => localizedEntry(conceptId, language))
    .filter((entry): entry is KnowledgeEntry => Boolean(entry))
    .filter((entry) => entryVisible(entry, query, options))
    .map(localizeRelationDetail)
    .slice(0, 4);
}

function localizeRelationNode(
  node: RelationNode,
  language: Language,
  details: ReturnType<typeof relationNodeDetails>,
) {
  return {
    id: node.id,
    label: language === "zh-CN" ? node.labelZh : node.labelEn,
    kind: node.kind,
    conceptIds: node.conceptIds,
    details,
  };
}

function localizeGraph(
  graph: RelationGraph,
  language: Language,
  query: Pick<PreheatQuery, "progress">,
  options: { allowFutureRegions?: boolean } = {},
) {
  const visibleEdges = graph.edges.filter((edge) =>
    edge.conceptIds.some((conceptId) => {
      const entry = localizedEntry(conceptId, language);
      return entry ? entryVisible(entry, query, options) : false;
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
      .map((node) =>
        localizeRelationNode(
          node,
          language,
          relationNodeDetails(node, visibleEdges, language, query, options),
        ),
      ),
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
  options: { allowFutureRegions?: boolean } = {},
) {
  const eventEntries = node.eventConceptIds
    .map((id) => localizedEntry(id, query.language))
    .filter((entry): entry is KnowledgeEntry => Boolean(entry));
  const visibleEvents = eventEntries.filter((entry) =>
    entryVisible(entry, query, options),
  );
  const implications = includeImplications
    ? node.implicationConceptIds
        .map((id) => localizedEntry(id, query.language))
        .filter((entry): entry is KnowledgeEntry => Boolean(entry))
        .filter((entry) => entryVisible(entry, query, options))
    : [];
  const locked = visibleEvents.length === 0;
  return {
    id: node.id,
    region: node.region,
    participantIds: node.participantIds,
    title: locked
      ? query.language === "zh-CN"
        ? "该地区主线事件已锁定"
        : "Regional main-quest event locked"
      : query.language === "zh-CN"
        ? node.titleZh
        : node.titleEn,
    locked,
    suggestedQuestions:
      query.language === "zh-CN"
        ? node.suggestedQuestionsZh
        : node.suggestedQuestionsEn,
    events: visibleEvents,
    implications,
    relationGraphId: node.relationGraphId,
  };
}

function buildNarration(
  entries: KnowledgeEntry[],
  limit: number,
) {
  const visible = entries.slice(0, limit);
  return {
    lead: "",
    points: visible.map((entry) => entry.summary),
    factBoundary: "",
  };
}

export function validatePreheatCatalog() {
  const conceptIds = new Set(gnosisKnowledgeEntries.map((entry) => entry.conceptId));
  const timelineIds = new Set(gnosisTimeline.map((node) => node.id));
  const graphIds = new Set(relationGraphs.map((graph) => graph.id));
  const relationNodeIds = new Set(relationNodes.map((node) => node.id));
  const errors: string[] = [];

  errors.push(...validatePreheatRegionGuides());

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

  for (const region of namedProgress) {
    const guide = getPreheatRegionGuide(region, "zh-CN");
    if (guide.timelineNodeId && !timelineIds.has(guide.timelineNodeId)) {
      errors.push(`region-guide:${region}:${guide.timelineNodeId}`);
    }
    if (guide.relationGraphId && !graphIds.has(guide.relationGraphId)) {
      errors.push(`region-guide:${region}:${guide.relationGraphId}`);
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

type LocalizedTopicHeader = ReturnType<typeof localizeTopicHeader>;
type LocalizedTimelineNode = ReturnType<typeof localizeTimelineNode>;
type LocalizedGraph = ReturnType<typeof localizeGraph>;

interface BasePreheatView {
  topic: LocalizedTopicHeader;
  topics: LocalizedTopicHeader[];
  selectedRegion: Progress;
  contentNotice: string;
}

export interface RegionRequiredPreheatView extends BasePreheatView {
  kind: "region_required";
}

export interface NewPlayerPreheatView extends BasePreheatView {
  kind: "new";
  region: NamedProgress;
  guide: ReturnType<typeof getPreheatRegionGuide>["newPlayer"];
}

export interface ReturningPlayerPreheatView extends BasePreheatView {
  kind: "returning";
  region: NamedProgress;
  recap: {
    points: ReturnType<typeof getPreheatRegionGuide>["returningPlayer"]["recapPoints"];
    hooks: string[];
    relationGraph?: LocalizedGraph;
  };
}

export interface StoryPlayerPreheatView extends BasePreheatView {
  kind: "story";
  region: NamedProgress;
  topicQuestions: string[];
  narration: ReturnType<typeof buildNarration>;
  evidence: KnowledgeEntry[];
  timeline: LocalizedTimelineNode[];
  relationGraph: LocalizedGraph;
  availableRelationGraphs: Record<string, LocalizedGraph>;
  presentation: ReturnType<typeof buildStoryPresentation>;
}

export type PreheatView =
  | RegionRequiredPreheatView
  | NewPlayerPreheatView
  | ReturningPlayerPreheatView
  | StoryPlayerPreheatView;

export function getPreheatView(query: PreheatQuery): PreheatView {
  const topic =
    preheatTopics.find((item) => item.id === query.topicId) ??
    preheatTopics.find((item) => item.id === defaultPreheatTopicId)!;
  const profile = normalizeVisibleProfile(query.profile);
  const topicHeader = localizeTopicHeader(topic, query.language);
  const topics = preheatTopics.map((item) =>
    localizeTopicHeader(item, query.language),
  );
  const common = {
    topic: topicHeader,
    topics,
    selectedRegion: query.progress,
  };

  if (query.progress === "unknown") {
    return {
      ...common,
      kind: "region_required",
      contentNotice:
        query.language === "zh-CN"
          ? "请选择一个地区，再展开对应身份的预热内容。"
          : "Choose a region to open role-specific preheat content.",
    };
  }

  const region = query.progress as NamedProgress;
  const guide = getPreheatRegionGuide(region, query.language);

  if (profile === "new") {
    return {
      ...common,
      kind: "new",
      region,
      guide: guide.newPlayer,
      contentNotice:
        query.language === "zh-CN"
          ? "地区入门：通俗说明阵营与剧情起点，不包含关键结局。"
          : "Region primer: plain-language factions and story setup without key outcomes.",
    };
  }

  if (profile === "returning") {
    const relationGraph = guide.relationGraphId
      ? relationGraphs.find((item) => item.id === guide.relationGraphId)
      : undefined;
    return {
      ...common,
      kind: "returning",
      region,
      recap: {
        points: guide.returningPlayer.recapPoints,
        hooks: guide.returningPlayer.hooks,
        relationGraph: relationGraph
          ? localizeGraph(relationGraph, query.language, query)
          : undefined,
      },
      contentNotice:
        query.language === "zh-CN"
          ? "地区回顾：完整回忆所选地区，后续只保留值得继续追问的线索。"
          : "Region catch-up: the selected story is recapped in full; later threads remain open questions.",
    };
  }

  const entries = topic.depthConceptIds.research
    .map((conceptId) => localizedEntry(conceptId, query.language))
    .filter((entry): entry is KnowledgeEntry => Boolean(entry))
    .filter((entry) =>
      entryVisible(entry, query, { allowFutureRegions: true }),
    );
  const timeline = topic.timelineNodeIds
    .map((id) => gnosisTimeline.find((node) => node.id === id))
    .filter((node): node is TimelineNode => Boolean(node))
    .map((node) =>
      localizeTimelineNode(node, query, true, {
        allowFutureRegions: true,
      }),
    );
  const graph = relationGraphs.find(
    (item) => item.id === topic.relationGraphId,
  )!;
  const localizedGraphs = Object.fromEntries(
    [graph.id, ...timeline.map((node) => node.relationGraphId)].map((id) => {
      const target = relationGraphs.find((item) => item.id === id)!;
      return [
        id,
        localizeGraph(target, query.language, query, {
          allowFutureRegions: true,
        }),
      ];
    }),
  );
  const presentation = buildStoryPresentation(
    region,
    timeline,
    localizedGraphs,
    guide.timelineNodeId,
  );
  const localizedTopic = localizeTopic(topic, query.language);
  const relationGraph =
    localizedGraphs[presentation.defaultRelationGraphId ?? ""] ??
    localizedGraphs[graph.id];

  return {
    ...common,
    kind: "story",
    region,
    topicQuestions: localizedTopic.suggestedQuestions,
    narration: buildNarration(entries, 12),
    evidence: entries,
    timeline,
    relationGraph,
    availableRelationGraphs: localizedGraphs,
    presentation,
    contentNotice:
      query.language === "zh-CN"
        ? "完整剧情档案：展开全部已实装事件、文本暗示与证据边界。"
        : "Complete story archive: all released events, textual implications, and evidence boundaries.",
  };
}

export type PreheatFactStatus = FactStatus;
