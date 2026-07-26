import { NextResponse } from "next/server";
import { loadReleaseLabReport } from "@/lib/release-lab";

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(loadReleaseLabReport());
}
