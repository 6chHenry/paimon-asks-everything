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
  | "natlan";
export type SpoilerPreference = "none" | "low" | "full";
export type Focus = "story" | "character" | "gameplay" | "overview";
export type FactStatus =
  | "official_explicit"
  | "narrative_implied"
  | "trusted_secondary"
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
}

export interface Claim {
  text: string;
  citationIds: string[];
  factStatus: FactStatus;
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
