import type { Citation, Language } from "@/lib/domain";

export type SearchTier = "direct_reference" | "general_web";
export type SearchAttemptStatus = "ok" | "empty" | "timeout" | "error";

export interface SearchBackendRequest {
  question: string;
  language: Language;
  signal?: AbortSignal;
}

export interface SearchBackend {
  id: string;
  tier: SearchTier;
  search(request: SearchBackendRequest): Promise<Citation[]>;
}

export interface SearchAttempt {
  backendId: string;
  tier: SearchTier;
  status: SearchAttemptStatus;
  durationMs: number;
  resultCount: number;
}

export interface SearchRoutingResult {
  citations: Citation[];
  attempts: SearchAttempt[];
}

function normalizeText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function citationKey(citation: Citation) {
  return [
    normalizeUrl(citation.url),
    normalizeText(citation.title),
    normalizeText(citation.excerpt),
  ].join("::");
}

function dedupeCitations(citations: Citation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = citationKey(citation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

export async function runStagedSearch(
  backends: SearchBackend[],
  request: SearchBackendRequest & {
    isSufficient(citations: Citation[]): boolean | Promise<boolean>;
  },
): Promise<SearchRoutingResult> {
  const citations: Citation[] = [];
  const attempts: SearchAttempt[] = [];

  for (const tier of ["direct_reference", "general_web"] as const) {
    if (request.signal?.aborted) break;
    const tierBackends = backends.filter((backend) => backend.tier === tier);
    if (!tierBackends.length) continue;

    const settled = await Promise.all(
      tierBackends.map(async (backend) => {
        const started = Date.now();
        try {
          const items = await backend.search(request);
          return {
            items,
            attempt: {
              backendId: backend.id,
              tier,
              status: items.length ? ("ok" as const) : ("empty" as const),
              durationMs: Date.now() - started,
              resultCount: items.length,
            },
          };
        } catch (error) {
          return {
            items: [],
            attempt: {
              backendId: backend.id,
              tier,
              status: isTimeoutError(error)
                ? ("timeout" as const)
                : ("error" as const),
              durationMs: Date.now() - started,
              resultCount: 0,
            },
          };
        }
      }),
    );

    for (const result of settled) {
      citations.push(...result.items);
      attempts.push(result.attempt);
    }
    const unique = dedupeCitations(citations);
    citations.splice(0, citations.length, ...unique);
    if (await request.isSufficient(citations)) break;
  }

  return { citations, attempts };
}
