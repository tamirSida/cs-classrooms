import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { readJson, withErrors } from "@/lib/server/http";
import { createSeries, getSeriesSummaries, parseSeriesInput } from "@/lib/server/bookingSeries";

// POST /api/bookings/series - create a recurring booking in one transaction.
export const POST = withErrors("API/bookings/series POST", async (request: NextRequest) => {
  const user = await requireUser(request);
  const input = parseSeriesInput(await readJson(request));
  return NextResponse.json(await createSeries(user, input));
});

// GET /api/bookings/series?ids=a,b - pattern details for display. Excludes email addresses.
export const GET = withErrors("API/bookings/series GET", async (request: NextRequest) => {
  await requireUser(request);
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  return NextResponse.json(await getSeriesSummaries(ids));
});
