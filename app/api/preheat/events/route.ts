import { NextResponse } from "next/server";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/rate-limit";
import { isValidPreheatTarget } from "@/lib/preheat";
import { recordPreheatEvent } from "@/lib/preheat-event-store";
import { preheatEventSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    key: `preheat:${getRequestRateLimitKey(request)}`,
    limit: 90,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: rateLimit.resetAt },
      { status: 429 },
    );
  }
  const parsed = preheatEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (
    !isValidPreheatTarget(
      parsed.data.topicId,
      parsed.data.interactionKind,
      parsed.data.targetId,
    )
  ) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  if (
    parsed.data.interactionKind === "depth_selected" &&
    parsed.data.depth !== parsed.data.targetId
  ) {
    return NextResponse.json({ error: "depth_mismatch" }, { status: 400 });
  }
  const event = {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    ...parsed.data,
    sourceKind: "live_increment" as const,
  };
  await recordPreheatEvent(event);
  return NextResponse.json({ ok: true, eventId: event.id }, { status: 201 });
}
