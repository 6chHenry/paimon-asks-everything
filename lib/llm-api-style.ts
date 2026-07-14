export type LlmApiStyle = "anthropic" | "openai";

export function resolveLlmApiStyle(
  value = process.env.LLM_API_STYLE,
): LlmApiStyle {
  return value?.trim().toLowerCase() === "openai" ? "openai" : "anthropic";
}

export function resolveLlmEndpoint(baseUrl: string, style: LlmApiStyle) {
  const url = new URL(baseUrl);
  const clean = url.pathname.replace(/\/+$/u, "");
  if (style === "openai") {
    url.pathname = /\/chat\/completions$/u.test(clean)
      ? clean
      : `${clean.replace(/\/anthropic(?:\/v1)?$/u, "")}/chat/completions`;
  } else {
    const root = clean.replace(/\/anthropic(?:\/v1(?:\/messages)?)?$/u, "");
    url.pathname = `${root}/anthropic/v1/messages`;
  }
  url.search = "";
  url.hash = "";
  return url;
}
