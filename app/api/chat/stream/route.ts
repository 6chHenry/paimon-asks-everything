import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/lib/schemas";
import { formatTraceSse, makeTraceEvent } from "@/lib/trace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    key: `chat-stream:${getRequestRateLimitKey(request)}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: rateLimit.resetAt },
      { status: 429 },
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  async function send(eventName: string, payload: unknown) {
    await writer.write(encoder.encode(formatTraceSse(eventName, payload)));
  }

  void (async () => {
    let answerSent = false;
    try {
      await send(
        "trace",
        makeTraceEvent({
          stage: "classify",
          status: "running",
          message: "派蒙开始拆解问题",
        }),
      );
      const result = await runAgent(parsed.data, {
        emitTrace: (event) => send("trace", event),
        emitAnswer: async (answer) => {
          answerSent = true;
          await send("answer", answer);
        },
        emitResources: (resources) => send("resources", resources),
        signal: request.signal,
      });
      if (!answerSent) await send("answer", result);
      await send("done", { ok: true, resources: "complete" });
    } catch {
      await send(
        "error",
        makeTraceEvent({
          stage: "final",
          status: "error",
          message: "流式回答失败，请稍后重试",
        }),
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
