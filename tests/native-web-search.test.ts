import { describe, expect, it } from "vitest";
import { parseNativeWebSearchResponse } from "@/lib/native-web-search";

describe("native web search parser", () => {
  it("selects text after the last search result and hides thinking", () => {
    const parsed = parseNativeWebSearchResponse({
      content: [
        { type: "thinking", thinking: "private" },
        { type: "text", text: "我先搜索一下" },
        { type: "server_tool_use", id: "tool-1", name: "web_search", input: {} },
        { type: "web_search_tool_result", tool_use_id: "tool-1", content: [
          { type: "web_search_result", title: "冰之女皇", url: "https://baike.baidu.com/item/冰之女皇" },
        ] },
        { type: "text", text: "冰之女皇是愚人众执行官的最高统领。【1】" },
      ],
      stop_reason: "end_turn",
      usage: { server_tool_use: { web_search_requests: 1 } },
    });
    expect(parsed.answer).toBe("冰之女皇是愚人众执行官的最高统领。");
    expect(parsed.blockTypes).toEqual(["thinking", "text", "server_tool_use", "web_search_tool_result", "text"]);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.nativeSearchRequests).toBe(1);
    expect(JSON.stringify(parsed)).not.toContain("private");
  });

  it("collects results from multiple blocks and deduplicates URLs", () => {
    const parsed = parseNativeWebSearchResponse({
      content: [
        { type: "web_search_tool_result", content: [{ type: "web_search_result", title: "A", url: "https://example.com/a" }] },
        { type: "web_search_tool_result", content: [{ type: "web_search_result", title: "A2", url: "https://example.com/a#part" }] },
        { type: "text", text: "完成" },
      ],
      stop_reason: "max_tokens",
    });
    expect(parsed.results).toHaveLength(1);
    expect(parsed.answerTruncated).toBe(true);
  });
});
