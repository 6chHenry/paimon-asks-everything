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

export type ChatRequest = z.infer<typeof chatRequestSchema>;
