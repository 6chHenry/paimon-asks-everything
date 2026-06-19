import { NextResponse } from "next/server";
import { enrichInsightsWithAi } from "@/lib/ai-insights";
import { listEvents } from "@/lib/event-store";
import { aggregateInsights } from "@/lib/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const events = await listEvents();
  const base = aggregateInsights(events);
  return NextResponse.json(await enrichInsightsWithAi(base));
}
