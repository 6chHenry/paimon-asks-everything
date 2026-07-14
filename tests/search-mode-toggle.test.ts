import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chatRequestSchema,
  spoilerConfirmationSchema,
} from "@/lib/schemas";

const request = {
  question: "桑多涅和阿兰是什么关系？",
  language: "zh-CN" as const,
  profile: "story" as const,
  progress: "fontaine" as const,
  spoilerPreference: "low" as const,
  focus: ["story" as const],
  sessionId: "demo-session",
};

describe("demo search mode request", () => {
  it("accepts both routes and preserves the server default for older clients", () => {
    expect(chatRequestSchema.parse({ ...request, apiStyle: "openai" }).apiStyle)
      .toBe("openai");
    expect(chatRequestSchema.parse({ ...request, apiStyle: "anthropic" }).apiStyle)
      .toBe("anthropic");
    expect(chatRequestSchema.parse(request).apiStyle).toBe("anthropic");
    expect(() =>
      chatRequestSchema.parse({ ...request, apiStyle: "automatic" }),
    ).toThrow();
  });

  it("keeps the original route in a spoiler-confirmation request", () => {
    const confirmed = spoilerConfirmationSchema.parse({
      ...request,
      apiStyle: "openai",
      confirmationToken: "confirmation-token",
    });

    expect(confirmed.apiStyle).toBe("openai");
  });
});

describe("demo search mode UI contract", () => {
  const pageSource = readFileSync("app/ask/page.tsx", "utf8");
  const componentSource = readFileSync(
    "components/search-mode-toggle.tsx",
    "utf8",
  );
  const cssSource = readFileSync("app/globals.css", "utf8");

  it("defaults the demo selector to the designed route and sends it per request", () => {
    expect(pageSource).toContain('useState<LlmApiStyle>("openai")');
    expect(pageSource).toContain("apiStyle: requestApiStyle");
    expect(pageSource).toContain("disabled={loading}");
  });

  it("presents two accessible routes without extra workflow UI", () => {
    expect(componentSource).toContain('role="radiogroup"');
    expect(componentSource).toContain('role="radio"');
    expect(componentSource).toContain("aria-checked");
    expect(componentSource).toContain("OpenAI");
    expect(componentSource).toContain("Anthropic");
    expect(componentSource).toContain("自研检索");
    expect(componentSource).toContain("原生 Web Search");
    expect(componentSource).toContain("我的流程");
  });

  it("keeps the switch compact and responsive", () => {
    expect(cssSource).toContain(".search-mode-toggle");
    expect(cssSource).toContain('[aria-checked="true"]');
    expect(cssSource).toContain("@media (max-width: 640px)");
  });
});
