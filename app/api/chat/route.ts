import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { chatRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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
