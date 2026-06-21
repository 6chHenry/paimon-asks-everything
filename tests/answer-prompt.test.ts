import { describe, expect, it } from "vitest";
import { answerSystemPrompt } from "@/lib/answer-prompt";

describe("answer prompt", () => {
  it("allows relationship answers to use recorded story cuts as secondary dialogue evidence", () => {
    const prompt = answerSystemPrompt("zh-CN", false);

    expect(prompt).toContain("relationship questions");
    expect(prompt).toContain("story cut");
    expect(prompt).toContain("full dialogue");
    expect(prompt).toContain("do not dismiss reproduced in-game dialogue as mere speculation");
    expect(prompt).toContain("concrete in-game event");
    expect(prompt).toContain("creator's interpretation");
  });
});
