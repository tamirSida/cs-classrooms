import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { readJson, withErrors } from "@/lib/server/http";
import { cancelSeries, CancelSeriesOptions } from "@/lib/server/bookingSeries";

// POST /api/bookings/series/:id/cancel - cancel this / following / all remaining dates.
// With dryRun it only reports what would be cancelled.
export const POST = withErrors(
  "API/bookings/series/:id/cancel",
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser(request);
    const { id } = await params;
    const body = await readJson<Partial<CancelSeriesOptions>>(request);
    return NextResponse.json(
      await cancelSeries(user, id, {
        scope: body.scope as CancelSeriesOptions["scope"],
        fromBookingId: body.fromBookingId,
        dryRun: body.dryRun === true,
      })
    );
  }
);
