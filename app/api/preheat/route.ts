import { NextResponse } from "next/server";
import { getPreheatView, validatePreheatCatalog } from "@/lib/preheat";
import { preheatQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = preheatQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const catalogErrors = validatePreheatCatalog();
  if (catalogErrors.length) {
    return NextResponse.json(
      { error: "invalid_catalog", details: catalogErrors },
      { status: 500 },
    );
  }
  return NextResponse.json(getPreheatView(parsed.data));
}
