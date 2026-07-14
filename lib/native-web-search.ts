import type {
  AnthropicContentBlock,
  AnthropicMessageResponse,
} from "@/lib/deepseek-anthropic";
import { normalizeSearchResultUrl } from "@/lib/search-result-url";

export interface NativeWebSearchResult {
  title: string;
  url: string;
  pageAge?: string;
  snippet?: string;
}

export interface ParsedNativeSearchResponse {
  answer: string;
  results: NativeWebSearchResult[];
  blockTypes: string[];
  nativeSearchRequests: number;
  stopReason?: string | null;
  answerTruncated: boolean;
}

function extractNativeResults(blocks: AnthropicContentBlock[]) {
  return blocks.flatMap((block) => {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) return [];
    return block.content.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const result = item as Record<string, unknown>;
      if (result.type !== "web_search_result" || typeof result.url !== "string") return [];
      return [{
        title: typeof result.title === "string" ? result.title : result.url,
        url: result.url,
        pageAge: typeof result.page_age === "string" ? result.page_age : undefined,
        snippet: typeof result.snippet === "string" ? result.snippet : undefined,
      } satisfies NativeWebSearchResult];
    });
  });
}

function dedupeNativeResults(results: NativeWebSearchResult[]) {
  const seen = new Set<string>();
  return results.flatMap((result) => {
    const destination = normalizeSearchResultUrl(result.url);
    if (!destination) return [];
    const parsed = new URL(destination);
    parsed.hash = "";
    const key = parsed.toString().replace(/\/$/u, "").toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...result, url: parsed.toString() }];
  });
}

function dedupeAnswerBlocks(blocks: string[]) {
  const seen = new Set<string>();
  return blocks.filter((block) => {
    const key = block.normalize("NFKC").replace(/\s+/gu, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join("\n\n");
}

function stripDeadCitationNumbers(value: string) {
  return value.replace(/\s*【\s*\d+(?:\s*[-,，、]\s*\d+)*\s*】/gu, "");
}

export function parseNativeWebSearchResponse(
  response: AnthropicMessageResponse,
): ParsedNativeSearchResponse {
  const lastSearchIndex = response.content.reduce(
    (last, block, index) => block.type === "web_search_tool_result" ? index : last,
    -1,
  );
  const textBlocks = response.content
    .map((block, index) =>
      block.type === "text" && typeof block.text === "string"
        ? { index, text: block.text.trim() }
        : null,
    )
    .filter((item): item is { index: number; text: string } => Boolean(item?.text));
  const finalTexts = textBlocks.filter((item) => item.index > lastSearchIndex);
  const selected = finalTexts.length ? finalTexts : textBlocks.slice(-1);
  return {
    answer: stripDeadCitationNumbers(dedupeAnswerBlocks(selected.map((item) => item.text))).trim(),
    results: dedupeNativeResults(extractNativeResults(response.content)),
    blockTypes: response.content.map((block) => block.type),
    nativeSearchRequests: response.usage?.server_tool_use?.web_search_requests ?? 0,
    stopReason: response.stop_reason,
    answerTruncated: response.stop_reason === "max_tokens",
  };
}
