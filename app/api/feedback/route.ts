import { NextResponse } from "next/server";
import { updateFeedback } from "@/lib/event-store";
import { feedbackSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = feedbackSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  await updateFeedback(parsed.data.eventId, parsed.data.helpful);
  return NextResponse.json({ ok: true });
}
