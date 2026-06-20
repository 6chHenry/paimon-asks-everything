import { z } from "zod";

export const chatRequestSchema = z.object({
  question: z.string().trim().min(2).max(800),
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
  ]),
  spoilerPreference: z.enum(["none", "low", "full"]),
  focus: z
    .array(z.enum(["story", "character", "gameplay", "overview"]))
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

export const preheatQuerySchema = z.object({
  topicId: z.string().trim().min(3).max(100),
  depth: z.enum(["guided", "research"]),
  language: z.enum(["zh-CN", "en"]),
  profile: z
    .enum(["new", "returning", "story", "exploration", "casual"])
    .default("returning"),
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
    ])
    .default("fontaine"),
  spoilerPreference: z.enum(["none", "low", "full"]).default("low"),
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

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type PreheatQuery = z.infer<typeof preheatQuerySchema>;
