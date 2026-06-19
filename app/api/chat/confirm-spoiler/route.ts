import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { spoilerConfirmationSchema } from "@/lib/schemas";
import { verifySpoilerToken } from "@/lib/spoiler-token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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
