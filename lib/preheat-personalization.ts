import type { NamedProgress } from "@/data/preheat-region-guides";

export type PreheatSection = "timeline" | "brief" | "relations";

export interface StoryTimelineItem {
  id: string;
  relationGraphId: string;
  participantIds: string[];
}

export interface StoryRelationGraph {
  id: string;
  nodes: Array<{ id: string }>;
}

export interface StoryPreheatPresentation {
  sectionOrder: [PreheatSection, PreheatSection, PreheatSection];
  collapsedSections: PreheatSection[];
  defaultTimelineId?: string;
  defaultRelationGraphId?: string;
  defaultRelationNodeId?: string;
}

export function buildStoryPresentation(
  region: NamedProgress,
  timeline: StoryTimelineItem[],
  graphs: Record<string, StoryRelationGraph>,
  mappedTimelineId?: string,
): StoryPreheatPresentation {
  const defaultTimeline =
    timeline.find((item) => item.id === mappedTimelineId) ?? timeline.at(-1);
  const defaultGraph = defaultTimeline
    ? graphs[defaultTimeline.relationGraphId]
    : undefined;
  const participantIds = new Set(defaultTimeline?.participantIds ?? []);
  const defaultNode =
    defaultGraph?.nodes.find((node) => participantIds.has(node.id)) ??
    defaultGraph?.nodes[0];

  return {
    sectionOrder: ["timeline", "brief", "relations"],
    collapsedSections: [],
    defaultTimelineId: defaultTimeline?.id,
    defaultRelationGraphId: defaultTimeline?.relationGraphId,
    defaultRelationNodeId: defaultNode?.id,
  };
}
