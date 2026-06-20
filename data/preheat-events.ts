import type {
  Language,
  PreheatDepth,
  PreheatInteractionEvent,
  PreheatInteractionKind,
  Profile,
} from "@/lib/domain";

const templates: Array<{
  language: Language;
  profile: Profile;
  topicId: string;
  interactionKind: PreheatInteractionKind;
  targetId: string;
  depth?: PreheatDepth;
  count: number;
}> = [
  { language: "zh-CN", profile: "returning", topicId: "why-fatui-collect-gnoses", interactionKind: "depth_selected", targetId: "guided", depth: "guided", count: 18 },
  { language: "en", profile: "returning", topicId: "why-fatui-collect-gnoses", interactionKind: "depth_selected", targetId: "guided", depth: "guided", count: 11 },
  { language: "zh-CN", profile: "story", topicId: "tsaritsa-known-unknown", interactionKind: "depth_selected", targetId: "research", depth: "research", count: 14 },
  { language: "en", profile: "story", topicId: "seven-gnosis-journeys", interactionKind: "depth_selected", targetId: "guided", depth: "guided", count: 8 },
  { language: "zh-CN", profile: "returning", topicId: "why-fatui-collect-gnoses", interactionKind: "timeline_node_opened", targetId: "sumeru-gnoses", count: 16 },
  { language: "zh-CN", profile: "story", topicId: "why-fatui-collect-gnoses", interactionKind: "timeline_node_opened", targetId: "fontaine-gnosis", count: 13 },
  { language: "en", profile: "returning", topicId: "seven-gnosis-journeys", interactionKind: "timeline_node_opened", targetId: "natlan-gnosis", count: 12 },
  { language: "zh-CN", profile: "story", topicId: "seven-gnosis-journeys", interactionKind: "timeline_node_opened", targetId: "nodkrai-gnosis", count: 15 },
  { language: "zh-CN", profile: "story", topicId: "tsaritsa-known-unknown", interactionKind: "relation_node_opened", targetId: "third-descender", count: 10 },
];

export const historicalPreheatEvents: PreheatInteractionEvent[] =
  templates.flatMap((template, groupIndex) =>
    Array.from({ length: template.count }, (_, index) => ({
      id: `preheat-seed-${groupIndex}-${index}`,
      occurredAt: new Date(
        Date.UTC(2026, 5, 1 + ((groupIndex * 3 + index) % 17), 9 + (index % 7)),
      ).toISOString(),
      language: template.language,
      playerProfile: template.profile,
      topicId: template.topicId,
      interactionKind: template.interactionKind,
      targetId: template.targetId,
      depth: template.depth,
      sourceKind: "historical_sample",
    })),
  );
