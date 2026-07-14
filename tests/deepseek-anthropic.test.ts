import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NATIVE_WEB_SEARCH_TOOL,
  requestDeepSeekAnthropic,
} from "@/lib/deepseek-anthropic";

const baseRequest = {
  baseUrl: "https://api.deepseek.com",
  apiKey: "secret",
  model: "deepseek-v4-flash",
  system: "使用中文",
  messages: [{ role: "user" as const, content: "冰之女皇是谁？" }],
  maxTokens: 900,
};

describe("DeepSeek Anthropic transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends UTF-8 Chinese text with the native search tool", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      content: [{ type: "text", text: "回答" }], stop_reason: "end_turn",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await requestDeepSeekAnthropic(baseRequest);
    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(String(url)).toBe("https://api.deepseek.com/anthropic/v1/messages");
    expect(body.tools[0]).toEqual(NATIVE_WEB_SEARCH_TOOL);
    expect(String(init?.body)).toContain("冰之女皇是谁？");
    expect(new Headers(init?.headers).get("x-api-key")).toBe("secret");
  });

  it("continues pause_turn only once", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [], stop_reason: "pause_turn" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: "text", text: "完成" }], stop_reason: "end_turn" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await requestDeepSeekAnthropic(baseRequest);
    expect(response.stop_reason).toBe("end_turn");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not continue a second pause_turn", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content: [], stop_reason: "pause_turn" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await requestDeepSeekAnthropic(baseRequest);
    expect(response.stop_reason).toBe("pause_turn");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
