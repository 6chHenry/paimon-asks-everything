import { describe, expect, it } from "vitest";
import type { AnswerParagraph, Citation } from "@/lib/domain";
import { determineVerificationStatus } from "@/lib/verification";

function citation(id: string): Citation {
  return {
    id,
    title: id,
    url: `https://example.com/${id}`,
    sourceName: "Accepted evidence",
    sourceKind: "trusted_wiki",
    factStatus: "trusted_secondary",
    excerpt: `Evidence for ${id}`,
    external: true,
    crossLanguage: false,
  };
}

function paragraph(text: string, citationIds: string[]): AnswerParagraph {
  return { text, citationIds };
}

describe("answer verification", () => {
  it("marks an answer verified only when every non-empty paragraph is covered", () => {
    expect(
      determineVerificationStatus({
        status: "answered",
        answerParagraphs: [
          paragraph("First claim", ["source-1"]),
          paragraph("Second claim", ["external-1"]),
        ],
        citations: [citation("source-1"), citation("external-1")],
      }),
    ).toBe("verified");
  });

  it("marks an answer partially verified when only some paragraphs are covered", () => {
    expect(
      determineVerificationStatus({
        status: "answered",
        answerParagraphs: [
          paragraph("Supported", ["source-1"]),
          paragraph("Unsupported", []),
        ],
        citations: [citation("source-1")],
      }),
    ).toBe("partially_verified");
  });

  it("does not count citation ids absent from the final accepted list", () => {
    expect(
      determineVerificationStatus({
        status: "answered",
        answerParagraphs: [paragraph("Claim", ["rejected-dirty-candidate"])],
        citations: [citation("source-1")],
      }),
    ).toBeUndefined();
  });

  it.each([
    "spoiler_confirmation_required",
    "refused",
    "insufficient_evidence",
  ] as const)("does not attach verification to %s", (status) => {
    expect(
      determineVerificationStatus({
        status,
        answerParagraphs: [paragraph("Text", ["source-1"])],
        citations: [citation("source-1")],
      }),
    ).toBeUndefined();
  });

  it("uses the explicit model knowledge origin without inventing citations", () => {
    expect(
      determineVerificationStatus({
        status: "answered",
        answerParagraphs: [paragraph("Tentative answer", [])],
        citations: [],
        origin: "model_knowledge",
      }),
    ).toBe("model_knowledge");
  });
});
