import { describe, expect, it } from "vitest";
import {
  citationLabel,
  parseAnswerCitationMarkers,
} from "@/lib/citation-markers";

describe("answer citation markers", () => {
  it("turns inline source parentheticals into citation segments", () => {
    const segments = parseAnswerCitationMarkers(
      "此外，资料还提及他涉及切片技术（来源：external-4）。",
    );

    expect(segments).toEqual([
      { type: "text", text: "此外，资料还提及他涉及切片技术" },
      { type: "citation", sourceId: "external-4", label: "4" },
      { type: "text", text: "。" },
    ]);
  });

  it("normalizes legacy caret notes and plain source notes", () => {
    const segments = parseAnswerCitationMarkers(
      "证据显示她被雷电将军处决^[external-4][source-2]。",
    );

    expect(segments).toEqual([
      { type: "text", text: "证据显示她被雷电将军处决" },
      { type: "citation", sourceId: "external-4", label: "4" },
      { type: "citation", sourceId: "source-2", label: "2" },
      { type: "text", text: "。" },
    ]);
  });

  it("parses plain source notes without a caret", () => {
    const segments = parseAnswerCitationMarkers(
      "资料里是这样写的[external-4]。",
    );

    expect(segments).toEqual([
      { type: "text", text: "资料里是这样写的" },
      { type: "citation", sourceId: "external-4", label: "4" },
      { type: "text", text: "。" },
    ]);
  });

  it("extracts readable numeric labels from source ids", () => {
    expect(citationLabel("source-12")).toBe("12");
    expect(citationLabel("external-4")).toBe("4");
  });
});
