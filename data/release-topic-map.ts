/**
 * Release Decision Center — topic normalization mapping.
 *
 * Bridges question confusion topics, preheat topic IDs, timeline node IDs,
 * relation graph node IDs, and candidate content formats under unified
 * release-topic keys so the scoring engine can aggregate across signals.
 */

export interface ReleaseTopic {
  /** Stable key shared by all signal layers (e.g. "gnosis_journey"). */
  id: string;
  /** Human-readable labels. */
  labelZh: string;
  labelEn: string;
  /** Which content formats this topic can realistically support. */
  availableFormats: Array<
    | "timeline"
    | "faq"
    | "relationship_map"
    | "preheat_feature"
    | "social_post"
  >;
  /** Question confusion topics that map here. */
  questionTopicIds: string[];
  /** Preheat topic IDs that map here. */
  preheatTopicIds: string[];
  /** Timeline node IDs that belong here. */
  timelineNodeIds: string[];
  /** Snezhnaya graph (relation) node IDs that belong here. */
  graphNodeIds: string[];
}

/**
 * Central registry of all release topics the system recognises.
 * A topic appears here only when at least one signal layer has data for it.
 *
 * To add a new topic at data time (not code time), extend the mapping at the
 * API layer instead — see `extendReleaseTopicMap` below.
 */
const RELEASE_TOPIC_REGISTRY: ReleaseTopic[] = [
  {
    id: "gnosis_journey",
    labelZh: "各国神之心流转",
    labelEn: "The journey of each Gnosis",
    availableFormats: ["timeline", "faq", "preheat_feature"],
    questionTopicIds: ["gnosis_journey"],
    preheatTopicIds: ["seven-gnosis-journeys"],
    timelineNodeIds: [
      "mondstadt-gnosis",
      "liyue-gnosis",
      "inazuma-gnosis",
      "sumeru-gnoses",
      "fontaine-gnosis",
      "natlan-gnosis",
      "nodkrai-gnosis",
    ],
    graphNodeIds: ["gnosis", "third-descender"],
  },
  {
    id: "gnosis_purpose",
    labelZh: "愚人众收集神之心的目的",
    labelEn: "Why the Fatui collect Gnoses",
    availableFormats: ["faq", "preheat_feature", "social_post"],
    questionTopicIds: ["gnosis_collection_purpose"],
    preheatTopicIds: ["why-fatui-collect-gnoses"],
    timelineNodeIds: [],
    graphNodeIds: ["tsaritsa", "gnosis"],
  },
  {
    id: "tsaritsa_goal",
    labelZh: "冰之女皇目标",
    labelEn: "Tsaritsa's goal",
    availableFormats: ["faq", "social_post"],
    questionTopicIds: ["tsaritsa_goal"],
    preheatTopicIds: ["tsaritsa-known-unknown"],
    timelineNodeIds: [],
    graphNodeIds: ["tsaritsa"],
  },
  {
    id: "sandrone_identity",
    labelZh: "桑多涅身份与关系",
    labelEn: "Sandrone identity & ties",
    availableFormats: ["relationship_map", "faq", "social_post"],
    questionTopicIds: ["sandrone_identity"],
    preheatTopicIds: [],
    timelineNodeIds: [],
    graphNodeIds: ["sandrone"],
  },
  {
    id: "fontaine_catch_up",
    labelZh: "枫丹回归补课",
    labelEn: "Fontaine catch-up",
    availableFormats: ["faq", "timeline", "social_post"],
    questionTopicIds: ["fontaine_catch_up"],
    preheatTopicIds: [],
    timelineNodeIds: [],
    graphNodeIds: [],
  },
  {
    id: "terminology",
    labelZh: "术语理解",
    labelEn: "Terminology",
    availableFormats: ["faq"],
    questionTopicIds: ["terminology"],
    preheatTopicIds: [],
    timelineNodeIds: [],
    graphNodeIds: [],
  },
  {
    id: "gnosis_third_descender",
    labelZh: "神之心与第三降临者",
    labelEn: "Gnoses & Third Descender",
    availableFormats: ["faq", "social_post"],
    questionTopicIds: ["gnosis_third_descender"],
    preheatTopicIds: [],
    timelineNodeIds: [],
    graphNodeIds: ["third-descender"],
  },
  {
    id: "harbinger_hierarchy",
    labelZh: "执行官层级与名称混淆",
    labelEn: "Harbinger hierarchy & name confusion",
    availableFormats: ["relationship_map", "faq"],
    questionTopicIds: [],
    preheatTopicIds: [],
    timelineNodeIds: [],
    graphNodeIds: [
      "pierro",
      "dottore",
      "columbina",
      "capitano",
      "pulcinella",
      "pantalone",
      "sandrone",
      "signora",
      "arlecchino",
      "tartaglia",
      "scaramouche",
    ],
  },
];

/** Lookup by id. */
const byId = new Map<string, ReleaseTopic>(
  RELEASE_TOPIC_REGISTRY.map((t) => [t.id, t]),
);

export function getReleaseTopic(id: string): ReleaseTopic | undefined {
  return byId.get(id);
}

export function listReleaseTopics(): ReleaseTopic[] {
  return RELEASE_TOPIC_REGISTRY;
}

/**
 * Reverse-lookup: given a question confusion topic id, return every
 * ReleaseTopic that references it.
 */
export function releaseTopicsForQuestionTopic(
  questionTopicId: string,
): ReleaseTopic[] {
  return RELEASE_TOPIC_REGISTRY.filter((t) =>
    t.questionTopicIds.includes(questionTopicId),
  );
}

/**
 * Reverse-lookup: given a preheat topic id, return every ReleaseTopic
 * that references it.
 */
export function releaseTopicsForPreheatTopic(
  preheatTopicId: string,
): ReleaseTopic[] {
  return RELEASE_TOPIC_REGISTRY.filter((t) =>
    t.preheatTopicIds.includes(preheatTopicId),
  );
}

/**
 * Reverse-lookup: given a graph node id, return every ReleaseTopic
 * that references it.
 */
export function releaseTopicsForGraphNode(graphNodeId: string): ReleaseTopic[] {
  return RELEASE_TOPIC_REGISTRY.filter((t) =>
    t.graphNodeIds.includes(graphNodeId),
  );
}

/**
 * Extend the topic map at runtime with topics that exist in data but
 * haven't been pre-registered. Returns a merged list of ReleaseTopics.
 */
export function extendReleaseTopicMap(
  extraTopics: ReleaseTopic[],
): ReleaseTopic[] {
  const existing = new Map(byId);
  for (const t of extraTopics) {
    existing.set(t.id, t);
  }
  return [...existing.values()];
}
