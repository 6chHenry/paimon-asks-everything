import type { Language } from "@/lib/domain";

export interface PaimonNote {
  id: string;
  title: Record<Language, string>;
  body: Record<Language, string>;
  href: string;
}

export interface TravelerDiscoveries {
  visitedNodeIds: string[];
  paimonEasterEggFound: boolean;
}

export const DISCOVERIES_STORAGE_KEY = "paimon-traveler-discoveries";
export const PAIMON_TAP_STORAGE_KEY = "paimon-brand-tap-count";
export const PAIMON_EGG_PENDING_KEY = "paimon-easter-egg-pending";
export const CLUE_CARD_UNLOCK_COUNT = 3;

export const emptyDiscoveries: TravelerDiscoveries = {
  visitedNodeIds: [],
  paimonEasterEggFound: false,
};

export function noteIndexForDate(date: Date, noteCount: number) {
  if (!Number.isFinite(noteCount) || noteCount <= 0) return 0;
  const localDay = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return ((localDay % noteCount) + noteCount) % noteCount;
}

export function discoverNode(
  discoveries: TravelerDiscoveries,
  nodeId: string,
): TravelerDiscoveries {
  if (!nodeId || discoveries.visitedNodeIds.includes(nodeId)) {
    return discoveries;
  }
  return {
    ...discoveries,
    visitedNodeIds: [...discoveries.visitedNodeIds, nodeId],
  };
}

export function hasUnlockedClueCard(discoveries: TravelerDiscoveries) {
  return discoveries.visitedNodeIds.length >= CLUE_CARD_UNLOCK_COUNT;
}

export function parseDiscoveries(raw: string | null): TravelerDiscoveries {
  if (!raw) return emptyDiscoveries;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const visitedNodeIds = Array.isArray(parsed.visitedNodeIds)
      ? [...new Set(parsed.visitedNodeIds.filter((item): item is string => typeof item === "string" && item.length > 0))]
      : [];
    return {
      visitedNodeIds,
      paimonEasterEggFound: parsed.paimonEasterEggFound === true,
    };
  } catch {
    return emptyDiscoveries;
  }
}

export function buildClueCardText(
  discoveries: TravelerDiscoveries,
  language: Language,
) {
  const count = discoveries.visitedNodeIds.length;
  return language === "zh-CN"
    ? `旅行者已在至冬权力与命运图谱中发现 ${count} 条线索。还有更多未解故事，等派蒙和你一起确认。`
    : `This Traveler has found ${count} clues in the Snezhnaya power and fate map. More unresolved stories are waiting for Paimon to investigate together.`;
}
