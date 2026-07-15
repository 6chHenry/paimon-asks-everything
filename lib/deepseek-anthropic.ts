import { fetch as undiciFetch, ProxyAgent } from "undici";
import { resolveLlmEndpoint } from "@/lib/llm-api-style";

export const NATIVE_WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 1,
} as const;

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking?: string; [key: string]: unknown }
  | { type: "server_tool_use"; id?: string; name?: string; input?: unknown }
  | { type: "web_search_tool_result"; tool_use_id?: string; content?: unknown }
  | { type: string; [key: string]: unknown };

export interface AnthropicMessageResponse {
  content: AnthropicContentBlock[];
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
}

export interface DeepSeekAnthropicRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string | AnthropicContentBlock[] }>;
  maxTokens: number;
  tools?: ReadonlyArray<Record<string, unknown>>;
  signal?: AbortSignal;
}

let proxyAgent: ProxyAgent | undefined;

function getProxyAgent() {
  if (process.env.NODE_ENV === "test") return undefined;
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;
  if (!proxyUrl || !/^https?:\/\//iu.test(proxyUrl)) return undefined;
  proxyAgent ??= new ProxyAgent(proxyUrl);
  return proxyAgent;
}

function requestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(45_000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function postAnthropic(
  input: DeepSeekAnthropicRequest,
  body: Record<string, unknown>,
): Promise<AnthropicMessageResponse> {
  const endpoint = resolveLlmEndpoint(input.baseUrl, "anthropic");
  const init = {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    signal: requestSignal(input.signal),
  };
  const agent = getProxyAgent();
  const response = agent
    ? await undiciFetch(endpoint, { ...init, dispatcher: agent })
    : await fetch(endpoint, init);
  if (!response.ok) throw new Error(`Anthropic request failed with HTTP ${response.status}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Anthropic response was not valid JSON");
  }
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as AnthropicMessageResponse).content)) {
    throw new Error("Anthropic response did not contain content blocks");
  }
  return payload as AnthropicMessageResponse;
}

export async function requestDeepSeekAnthropic(input: DeepSeekAnthropicRequest) {
  const body = {
    model: input.model,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: input.messages,
    tools: input.tools ?? [NATIVE_WEB_SEARCH_TOOL],
  };
  let response = await postAnthropic(input, body);
  if (response.stop_reason === "pause_turn") {
    response = await postAnthropic(input, {
      ...body,
      messages: [
        ...input.messages,
        { role: "assistant", content: response.content },
      ],
    });
  }
  return response;
}
