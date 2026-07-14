import { z } from "zod";
import { normalizeVisibleProfile } from "@/lib/visible-profiles";

const focusValueSchema = z.enum(["story", "character", "gameplay", "overview"]);

export const chatRequestSchema = z.object({
  question: z.string().trim().min(2).max(800),
  apiStyle: z.enum(["openai", "anthropic"]).default("anthropic"),
  language: z.enum(["zh-CN", "en"]),
  profile: z.enum(["new", "returning", "story", "exploration", "casual"]),
  progress: z.enum([
    "unknown",
    "mondstadt",
    "liyue",
    "inazuma",
    "sumeru",
    "fontaine",
    "natlan",
    "nodkrai",
    "snezhnaya",
  ]),
  spoilerPreference: z.enum(["none", "low", "full"]),
  focus: z
    .array(focusValueSchema)
    .min(1)
    .max(4),
  allowQuestionTextStorage: z.boolean().default(false),
  sessionId: z.string().min(6).max(100),
});

export const spoilerConfirmationSchema = chatRequestSchema.extend({
  confirmationToken: z.string().min(10).max(500),
});

export const feedbackSchema = z.object({
  eventId: z.string().min(4).max(100),
  helpful: z.boolean(),
});

export const questionSuggestionRequestSchema = z
  .object({
    topicId: z.string().trim().min(3).max(100),
    customTopic: z.string().trim().min(2).max(60).optional(),
    language: z.enum(["zh-CN", "en"]),
    profile: z.enum(["new", "returning", "story", "exploration", "casual"]),
    progress: z.enum([
      "unknown",
      "mondstadt",
      "liyue",
      "inazuma",
      "sumeru",
      "fontaine",
      "natlan",
      "nodkrai",
      "snezhnaya",
    ]),
    spoilerPreference: z.enum(["none", "low", "full"]),
    focus: z
      .array(z.enum(["story", "character", "gameplay", "overview"]))
      .min(1)
      .max(4),
  })
  .strict();

export const preheatQuerySchema = z.object({
  topicId: z.string().trim().min(3).max(100),
  depth: z.enum(["guided", "research"]).default("guided"),
  language: z.enum(["zh-CN", "en"]),
  profile: z
    .enum(["new", "returning", "story", "exploration", "casual"])
    .default("returning")
    .transform(normalizeVisibleProfile),
  progress: z
    .enum([
      "unknown",
      "mondstadt",
      "liyue",
      "inazuma",
      "sumeru",
      "fontaine",
      "natlan",
      "nodkrai",
      "snezhnaya",
    ])
    .default("fontaine"),
  spoilerPreference: z.enum(["none", "low", "full"]).default("low"),
  focus: z
    .preprocess(
      (value) =>
        typeof value === "string"
          ? value.split(",").map((item) => item.trim()).filter(Boolean)
          : value,
      z.array(focusValueSchema).min(1).max(4),
    )
    .default(["story", "overview"]),
});

export const preheatEventSchema = z
  .object({
    language: z.enum(["zh-CN", "en"]),
    playerProfile: z.enum([
      "new",
      "returning",
      "story",
      "exploration",
      "casual",
    ]),
    topicId: z.string().trim().min(3).max(100),
    interactionKind: z.enum([
      "depth_selected",
      "timeline_node_opened",
      "relation_node_opened",
    ]),
    targetId: z.string().trim().min(2).max(100),
    depth: z.enum(["guided", "research"]).optional(),
  })
  .strict();

type ParsedChatRequest = z.output<typeof chatRequestSchema>;
export type ChatRequest = Omit<ParsedChatRequest, "apiStyle"> & {
  apiStyle?: ParsedChatRequest["apiStyle"];
};
export type PreheatQuery = z.infer<typeof preheatQuerySchema>;
export type QuestionSuggestionRequest = z.infer<
  typeof questionSuggestionRequestSchema
>;
