export type AnswerSegment =
  | { type: "text"; text: string }
  | { type: "citation"; sourceId: string; label: string };

const citationPattern =
  /(?:[（(]\s*(?:来源|source)\s*[:：]\s*((?:external|source)-\d+)\s*[)）])|(?:\^\[((?:external|source)-\d+)\])|(?:\[((?:external|source)-\d+)\])/giu;

export function citationLabel(sourceId: string) {
  return sourceId.replace(/\D/g, "") || sourceId;
}

export function parseAnswerCitationMarkers(text: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(citationPattern)) {
    const sourceId = match[1] || match[2] || match[3];
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, index) });
    }
    segments.push({
      type: "citation",
      sourceId,
      label: citationLabel(sourceId),
    });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }
  return segments.length ? segments : [{ type: "text", text }];
}
