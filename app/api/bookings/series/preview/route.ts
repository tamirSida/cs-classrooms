import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { readJson, withErrors } from "@/lib/server/http";
import { parseSeriesInput, previewSeries } from "@/lib/server/bookingSeries";

// POST /api/bookings/series/preview - expand a rule and report each date's availability. Writes nothing.
export const POST = withErrors("API/bookings/series/preview", async (request: NextRequest) => {
  const user = await requireUser(request);
  const input = parseSeriesInput(await readJson(request));
  return NextResponse.json(await previewSeries(user, input));
});
