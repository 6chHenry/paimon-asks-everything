import type {
  AnswerParagraph,
  ChatResult,
  Citation,
  VerificationStatus,
} from "@/lib/domain";

export function determineVerificationStatus(input: {
  status: ChatResult["status"];
  answerParagraphs?: AnswerParagraph[];
  citations: Citation[];
  origin?: "evidence" | "model_knowledge";
}): VerificationStatus | undefined {
  if (input.status !== "answered") return undefined;
  if (input.origin === "model_knowledge") return "model_knowledge";

  const acceptedIds = new Set(input.citations.map((citation) => citation.id));
  const paragraphs = (input.answerParagraphs ?? []).filter((paragraph) =>
    paragraph.text.trim(),
  );
  const supported = paragraphs.filter(
    (paragraph) =>
      paragraph.citationIds.length > 0 &&
      paragraph.citationIds.every((id) => acceptedIds.has(id)),
  );

  if (paragraphs.length > 0 && supported.length === paragraphs.length) {
    return "verified";
  }
  if (supported.length > 0) return "partially_verified";
  return undefined;
}
