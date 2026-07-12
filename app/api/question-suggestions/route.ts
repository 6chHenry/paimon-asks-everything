import { NextResponse } from "next/server";
import {
  findQuestionSuggestionTopic,
  getQuestionSuggestionResult,
} from "@/lib/question-suggestions";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/rate-limit";
import { questionSuggestionRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    key: `question-suggestions:${getRequestRateLimitKey(request)}`,
    limit: 12,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: rateLimit.resetAt },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = questionSuggestionRequestSchema.safeParse(body);
  if (!parsed.success || !findQuestionSuggestionTopic(parsed.data.topicId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await getQuestionSuggestionResult(parsed.data);
  return NextResponse.json(result);
}
