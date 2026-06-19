import { describe, expect, it } from "vitest";
import { retrieveControlled } from "@/lib/retrieval";

describe("controlled retrieval", () => {
  it("prioritizes same-language Fontaine catch-up evidence", () => {
    const result = retrieveControlled({
      question: "我停在枫丹，现在还能看懂目标版本吗？",
      language: "zh-CN",
      progress: "fontaine",
      spoilerPreference: "low",
      focus: ["story", "overview"],
    });
    expect(result.entries[0]?.conceptId).toBe("fontaine-bridge");
    expect(result.entries[0]?.language).toBe("zh-CN");
    expect(result.entries.every((entry) => entry.language === "zh-CN")).toBe(
      true,
    );
    expect(result.topScore).toBeGreaterThan(3);
  });

  it("blocks level 3 evidence before explicit confirmation", () => {
    const result = retrieveControlled({
      question: "Tell me Sandrone's true identity and the twist",
      language: "en",
      progress: "fontaine",
      spoilerPreference: "full",
      focus: ["story", "character"],
    });
    expect(result.blockedHighRisk.length).toBeGreaterThan(0);
    expect(result.entries.every((entry) => entry.spoilerLevel < 3)).toBe(true);
  });

  it("does not treat language preference as a lexical match", () => {
    const result = retrieveControlled({
      question: "Who is Liben and why does he keep traveling?",
      language: "en",
      progress: "fontaine",
      spoilerPreference: "low",
      focus: ["character"],
    });
    expect(result.entries).toHaveLength(0);
    expect(result.topScore).toBe(0);
  });
});
