import { NextResponse } from "next/server";
import { runEvaluation } from "@/lib/evaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let caseId: string | undefined;
  try {
    const body = (await request.json()) as { caseId?: string };
    caseId = body.caseId;
  } catch {
    caseId = undefined;
  }
  return NextResponse.json(await runEvaluation(caseId));
}
