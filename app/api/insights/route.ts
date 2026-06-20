import { NextResponse } from "next/server";
import { enrichInsightsWithAi } from "@/lib/ai-insights";
import { listEvents } from "@/lib/event-store";
import { aggregateInsights } from "@/lib/insights";
import { listPreheatEvents } from "@/lib/preheat-event-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [events, preheatEvents] = await Promise.all([
    listEvents(),
    listPreheatEvents(),
  ]);
  const base = aggregateInsights(events, preheatEvents);
  return NextResponse.json(await enrichInsightsWithAi(base));
}
