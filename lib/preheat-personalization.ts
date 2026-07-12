import type {
  Focus,
  KnowledgeEntry,
  PreheatDepth,
  Profile,
  Progress,
} from "@/lib/domain";

export type PreheatSection = "timeline" | "brief" | "relations";

export interface PersonalizationQuery {
  profile: Profile;
  progress: Progress;
  depth: PreheatDepth;
  focus: readonly Focus[];
}

export interface PersonalizationTimelineItem {
  id: string;
  region: Progress;
  locked: boolean;
  relationGraphId: string;
  participantIds: string[];
}

export interface PersonalizationGraph {
  id: string;
  nodes: Array<{ id: string }>;
}

export interface PreheatPresentation {
  sectionOrder: [PreheatSection, PreheatSection, PreheatSection];
  collapsedSections: PreheatSection[];
  narrationLimit: number;
  eventLimit: number;
  implicationLimit: number;
  questionLimit: number;
  defaultTimelineId?: string;
  defaultRelationGraphId?: string;
  defaultRelationNodeId?: string;
}

const focusOrder: Focus[] = ["story", "character", "gameplay", "overview"];
const profileRules: Record<
  Profile,
  Pick<
    PreheatPresentation,
    | "sectionOrder"
    | "collapsedSections"
    | "narrationLimit"
    | "eventLimit"
    | "implicationLimit"
    | "questionLimit"
  >
> = {
  new: { sectionOrder: ["timeline", "brief", "relations"], collapsedSections: ["relations"], narrationLimit: 5, eventLimit: 1, implicationLimit: 0, questionLimit: 2 },
  returning: { sectionOrder: ["timeline", "brief", "relations"], collapsedSections: [], narrationLimit: 6, eventLimit: 2, implicationLimit: 1, questionLimit: 3 },
  story: { sectionOrder: ["brief", "timeline", "relations"], collapsedSections: [], narrationLimit: 10, eventLimit: 3, implicationLimit: 3, questionLimit: 3 },
  exploration: { sectionOrder: ["relations", "timeline", "brief"], collapsedSections: ["brief"], narrationLimit: 6, eventLimit: 2, implicationLimit: 1, questionLimit: 3 },
  casual: { sectionOrder: ["brief", "timeline", "relations"], collapsedSections: ["timeline", "relations"], narrationLimit: 3, eventLimit: 1, implicationLimit: 0, questionLimit: 2 },
};

function normalizedFocus(focus: readonly Focus[]) {
  const selected = new Set(focus);
  return focusOrder.filter((item) => selected.has(item));
}

function entryScore(entry: KnowledgeEntry, query: PersonalizationQuery) {
  const scores: Record<Focus, number> = {
    story: entry.contentType === "story" ? 8 : 0,
    character: entry.contentType === "character" ? 8 : 0,
    gameplay: entry.tags.some((tag) => ["world", "artifact-text", "item-text"].includes(tag)) ? 8 : 0,
    overview: entry.contentType === "version_overview" ? 8 : 0,
  };
  const focusScore = normalizedFocus(query.focus).reduce(
    (sum, item, index) => sum + scores[item] * (4 - index),
    0,
  );
  const profileScore =
    query.profile === "new" && entry.tags.includes("definition")
      ? 12
      : query.profile === "story" && entry.factStatus === "narrative_implied"
        ? 6
        : query.profile === "casual" && entry.contentType === "version_overview"
          ? 6
          : 0;
  return focusScore + profileScore;
}

export function rankPreheatEntries(entries: KnowledgeEntry[], query: PersonalizationQuery) {
  return entries
    .map((entry, index) => ({ entry, index, score: entryScore(entry, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ entry }) => entry);
}

function questionScore(question: string, focus: Focus) {
  const patterns: Record<Focus, RegExp> = {
    story: /为什么|如何|因果|伏笔|事件链|why|how|thread/i,
    character: /谁|人物|角色|神子|纳西妲|博士|女士|仆人|队长|who|character|Venti|Dottore|Arlecchino|Capitano/i,
    gameplay: /探索|世界|场景|文本|玩法|explor|world|gameplay|text/i,
    overview: /版本|整体|变化|起点|衔接|说明|version|overall|change|starting point/i,
  };
  return patterns[focus].test(question) ? 10 : 0;
}

export function rankSuggestedQuestions(
  questions: string[],
  focus: readonly Focus[],
  profile: Profile,
) {
  const orderedFocus = normalizedFocus(focus);
  return questions
    .map((question, index) => ({
      question,
      index,
      score:
        orderedFocus.reduce(
          (sum, item, focusIndex) =>
            sum + questionScore(question, item) * (4 - focusIndex),
          0,
        ) + (profile === "casual" && question.length < 28 ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ question }) => question);
}

export function buildPreheatPresentation(
  query: PersonalizationQuery,
  timeline: PersonalizationTimelineItem[],
  graphs: Record<string, PersonalizationGraph>,
): PreheatPresentation {
  const unlocked = timeline.filter((item) => !item.locked);
  const defaultTimeline = query.profile === "new" ? unlocked[0] : unlocked.at(-1);
  const defaultGraph = defaultTimeline ? graphs[defaultTimeline.relationGraphId] : undefined;
  const participantIds = new Set(defaultTimeline?.participantIds ?? []);
  const defaultNode = query.focus.includes("character")
    ? defaultGraph?.nodes.find((node) => participantIds.has(node.id))
    : defaultGraph?.nodes[0];
  const limits = profileRules[query.profile];
  return {
    ...limits,
    narrationLimit: Math.min(
      limits.narrationLimit + (query.depth === "research" ? 2 : 0),
      12,
    ),
    implicationLimit: query.depth === "guided" ? 0 : limits.implicationLimit,
    defaultTimelineId: defaultTimeline?.id,
    defaultRelationGraphId: defaultTimeline?.relationGraphId,
    defaultRelationNodeId: defaultNode?.id,
  };
}
