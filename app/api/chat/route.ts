import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit({
      key: `chat:${getRequestRateLimitKey(request)}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rate_limited", resetAt: rateLimit.resetAt },
        { status: 429 },
      );
    }
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(await runAgent(parsed.data));
  } catch {
    return NextResponse.json(
      {
        error: "service_unavailable",
        message: "The chat service could not process this request.",
      },
      { status: 503 },
    );
  }
}
