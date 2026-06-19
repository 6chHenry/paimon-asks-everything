import { NextResponse } from "next/server";
import { listEvents } from "@/lib/event-store";
import { aggregateInsights } from "@/lib/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const events = await listEvents();
  return NextResponse.json(aggregateInsights(events));
}
