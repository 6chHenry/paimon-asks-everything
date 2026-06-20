import { describe, expect, it } from "vitest";
import { suggestedQuestions } from "@/lib/suggested-questions";

describe("suggested questions", () => {
  it("does not include gameplay puzzle prompts in the ask page suggestions", () => {
    expect(suggestedQuestions["zh-CN"].join("\n")).not.toMatch(/机关|玩法/);
    expect(suggestedQuestions.en.join("\n")).not.toMatch(/mechanical puzzle|gameplay/i);
  });
});
