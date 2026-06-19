import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/rate-limit";
import { spoilerConfirmationSchema } from "@/lib/schemas";
import { verifySpoilerToken } from "@/lib/spoiler-token";

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
    const parsed = spoilerConfirmationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const { confirmationToken, ...chatRequest } = parsed.data;
    if (!verifySpoilerToken(confirmationToken, chatRequest.question)) {
      return NextResponse.json(
        { error: "invalid_or_expired_confirmation" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      await runAgent(chatRequest, { confirmedHighRisk: true }),
    );
  } catch {
    return NextResponse.json(
      { error: "service_unavailable" },
      { status: 503 },
    );
  }
}
