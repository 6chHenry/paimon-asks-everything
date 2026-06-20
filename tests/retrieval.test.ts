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

  it("prioritizes the current Sandrone-Alain creation relationship", () => {
    const result = retrieveControlled({
      question: "桑多涅和阿兰的关系",
      language: "zh-CN",
      progress: "fontaine",
      spoilerPreference: "low",
      focus: ["story", "character"],
    });

    expect(result.entries[0]?.conceptId).toBe("sandrone-alain-creation");
    expect(result.entries[0]?.summary).toContain("阿兰");
    expect(result.entries[0]?.summary).toContain("造物");
  });

  it("does not retrieve unrelated relationship entries just because the question asks for a relationship", () => {
    const result = retrieveControlled({
      question: "雷电将军和雷电影的关系",
      language: "zh-CN",
      progress: "inazuma",
      spoilerPreference: "full",
      focus: ["story", "character"],
    });

    expect(
      result.entries.some((entry) => entry.conceptId === "sandrone-alain-creation"),
    ).toBe(false);
    expect(result.entries).toHaveLength(0);
  });

  it("retrieves the new Gnosis knowledge line for a preheat follow-up", () => {
    const result = retrieveControlled({
      question: "冰之女皇已经明确说过为什么收集神之心吗？",
      language: "zh-CN",
      progress: "fontaine",
      spoilerPreference: "low",
      focus: ["story", "overview"],
    });

    expect(
      result.entries.some(
        (entry) => entry.conceptId === "tsaritsa-plan-unknown",
      ),
    ).toBe(true);
    expect(
      result.entries.every((entry) => entry.language === "zh-CN"),
    ).toBe(true);
  });

  it("retrieves the released Nod-Krai fate of the Pyro Gnosis", () => {
    const result = retrieveControlled({
      question: "月之七最后火神之心去了哪里？",
      language: "zh-CN",
      progress: "nodkrai",
      spoilerPreference: "full",
      focus: ["story"],
    });

    expect(result.entries[0]?.conceptId).toBe("gnosis-nodkrai");
    expect(result.entries[0]?.summary).toContain("下落不明");
  });
});
