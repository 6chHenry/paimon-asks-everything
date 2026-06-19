import { NextResponse } from "next/server";
import { runEvaluation } from "@/lib/evaluation";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    key: `evaluation:${getRequestRateLimitKey(request)}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: rateLimit.resetAt },
      { status: 429 },
    );
  }
  let caseId: string | undefined;
  try {
    const body = (await request.json()) as { caseId?: string };
    caseId = body.caseId;
  } catch {
    caseId = undefined;
  }
  return NextResponse.json(await runEvaluation(caseId));
}
