export type Language = "zh-CN" | "en";
export type Profile =
  | "new"
  | "returning"
  | "story"
  | "exploration"
  | "casual";
export type Progress =
  | "unknown"
  | "mondstadt"
  | "liyue"
  | "inazuma"
  | "sumeru"
  | "fontaine"
  | "natlan"
  | "nodkrai";
export type SpoilerPreference = "none" | "low" | "full";
export type Focus = "story" | "character" | "gameplay" | "overview";
export type PreheatDepth = "guided" | "research";
export type PreheatInteractionKind =
  | "depth_selected"
  | "timeline_node_opened"
  | "relation_node_opened";
export type FactStatus =
  | "official_explicit"
  | "narrative_implied"
  | "trusted_secondary"
  | "community_analysis"
  | "community_speculation"
  | "demo_hypothesis";
export type SourceKind =
  | "official"
  | "game_text"
  | "wiki"
  | "trusted_wiki"
  | "community"
  | "unknown_web"
  | "demo";
export type SourceCredibility =
  | "official"
  | "trusted_wiki"
  | "community"
  | "unknown_web";
export type PlatformKind =
  | "official_site"
  | "official_operated_wiki"
  | "community"
  | "video_platform"
  | "general_web";
export type PublisherKind =
  | "genshin_official"
  | "verified_aggregator"
  | "user"
  | "unknown";
export type ContentKind =
  | "announcement"
  | "character_profile"
  | "game_text_reference"
  | "neutral_reference"
  | "gameplay_guide"
  | "lore_analysis"
  | "speculation";
export type SourceAuthority =
  | "official"
  | "curated_reference"
  | "community_analysis"
  | "community_speculation";
export type QuestionCategory =
  | "story"
  | "character"
  | "gameplay"
  | "version_overview"
  | "community"
  | "safety"
  | "other";

export type ReadingResourceKind =
  | "official_video"
  | "official_text"
  | "story_guide"
  | "analysis_video"
  | "discussion";

export type ReadingResourceAuthority =
  | "official"
  | "reference"
  | "community";

export interface ReadingResource {
  id: string;
  title: string;
  url: string;
  platform: string;
  kind: ReadingResourceKind;
  authority: ReadingResourceAuthority;
  spoilerLevel: 0 | 1 | 2 | 3;
  reason: string;
  language: Language | "multi";
}

export interface Preferences {
  language: Language;
  profile: Profile;
  progress: Progress;
  spoilerPreference: SpoilerPreference;
  focus: Focus[];
  allowQuestionTextStorage: boolean;
}

export interface Source {
  title: string;
  url: string;
  sourceName: string;
  sourceKind: SourceKind;
}

export interface KnowledgeEntry {
  id: string;
  conceptId: string;
  language: Language;
  title: string;
  content: string;
  summary: string;
  aliases: string[];
  tags: string[];
  contentType: QuestionCategory;
  spoilerLevel: 0 | 1 | 2 | 3;
  minimumProgress: Progress;
  factStatus: FactStatus;
  source: Source;
  reviewed: true;
}

export interface Citation {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceKind: SourceKind;
  credibility?: SourceCredibility;
  factStatus: FactStatus;
  excerpt: string;
  external: boolean;
  crossLanguage: boolean;
  assessment?: SourceAssessment;
}

export interface SourceAssessment {
  platformKind: PlatformKind;
  publisherKind: PublisherKind;
  contentKind: ContentKind;
  authority: SourceAuthority;
  officialAccountId?: string;
  signals: string[];
  confidence: "high" | "medium" | "low";
}

export interface Claim {
  text: string;
  citationIds: string[];
  factStatus: FactStatus;
}

export interface AnswerParagraph {
  text: string;
  citationIds: string[];
}

export interface EventClassification {
  questionCategory: QuestionCategory;
  confusionTopic: string;
}

export interface ChatResult {
  status:
    | "answered"
    | "spoiler_confirmation_required"
    | "refused"
    | "insufficient_evidence";
  answer: string;
  answerParagraphs?: AnswerParagraph[];
  language: Language;
  answerMode:
    | "minimal_catch_up"
    | "evidence_answer"
    | "deep_story"
    | "layered_hint"
    | "safe_refusal"
    | "limited_answer";
  claims: Claim[];
  citations: Citation[];
  spoilerAction: "none" | "filtered" | "confirmation_required" | "confirmed";
  usedExternalSources: boolean;
  confidence: "high" | "medium" | "low";
  eventClassification: EventClassification;
  eventRecorded: boolean;
  eventId?: string;
  confirmationToken?: string;
  reason?: string;
  hints?: [string, string, string];
  deepStory?: boolean;
  readingRecommendations?: ReadingResource[];
}

export interface QuestionEvent {
  id: string;
  occurredAt: string;
  language: Language;
  playerProfile: Profile;
  questionCategory: QuestionCategory;
  confusionTopic: string;
  spoilerGateTriggered: boolean;
  usedExternalSearch: boolean;
  responseStatus: ChatResult["status"];
  helpfulFeedback?: boolean;
  sourceKind: "historical_sample" | "live_increment";
  questionText?: string;
  textConsent: boolean;
}

export interface PreheatTopic {
  id: string;
  titleZh: string;
  titleEn: string;
  introZh: string;
  introEn: string;
  heroConceptIds: string[];
  depthConceptIds: Record<PreheatDepth, string[]>;
  timelineNodeIds: string[];
  relationGraphId: string;
  suggestedQuestionsZh: string[];
  suggestedQuestionsEn: string[];
}

export interface TimelineNode {
  id: string;
  region: Progress;
  titleZh: string;
  titleEn: string;
  eventConceptIds: string[];
  implicationConceptIds: string[];
  participantIds: string[];
  relationGraphId: string;
}

export interface RelationNode {
  id: string;
  labelZh: string;
  labelEn: string;
  kind: "person" | "faction" | "object" | "concept";
  conceptIds: string[];
}

export interface RelationEdge {
  id: string;
  from: string;
  to: string;
  labelZh: string;
  labelEn: string;
  factStatus: FactStatus;
  conceptIds: string[];
}

export interface RelationGraph {
  id: string;
  nodeIds: string[];
  edges: RelationEdge[];
}

export interface PreheatInteractionEvent {
  id: string;
  occurredAt: string;
  language: Language;
  playerProfile: Profile;
  topicId: string;
  interactionKind: PreheatInteractionKind;
  targetId: string;
  depth?: PreheatDepth;
  sourceKind: "historical_sample" | "live_increment";
}
