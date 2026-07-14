import { describe, expect, it } from "vitest";
import { resolveLlmApiStyle, resolveLlmEndpoint } from "@/lib/llm-api-style";

describe("LLM API style", () => {
  it("defaults missing and invalid values to anthropic", () => {
    expect(resolveLlmApiStyle(undefined)).toBe("anthropic");
    expect(resolveLlmApiStyle("invalid")).toBe("anthropic");
  });

  it("keeps an explicit OpenAI selection", () => {
    expect(resolveLlmApiStyle("openai")).toBe("openai");
  });

  it.each([
    ["https://api.deepseek.com", "https://api.deepseek.com/anthropic/v1/messages"],
    ["https://api.deepseek.com/anthropic", "https://api.deepseek.com/anthropic/v1/messages"],
    ["https://api.deepseek.com/anthropic/v1", "https://api.deepseek.com/anthropic/v1/messages"],
    ["https://api.deepseek.com/anthropic/v1/messages", "https://api.deepseek.com/anthropic/v1/messages"],
  ])("resolves Anthropic endpoint from %s", (base, expected) => {
    expect(resolveLlmEndpoint(base, "anthropic").toString()).toBe(expected);
  });

  it("resolves the existing OpenAI endpoint", () => {
    expect(resolveLlmEndpoint("https://api.deepseek.com", "openai").toString())
      .toBe("https://api.deepseek.com/chat/completions");
  });
});
