import { NextRequest, NextResponse } from "next/server";
import { classroomService, bookingService, settingsService } from "@/lib/services";
import { BookingStatus } from "@/lib/models";

// GET /api/preview - Public endpoint for preview display
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Fetch all data in parallel
    const [classrooms, settings, allBookings] = await Promise.all([
      classroomService.getActiveClassrooms(),
      settingsService.getSettings("system"),
      bookingService.getAllBookingsForDateRange(startDate, endDate),
    ]);

    // Filter to only show confirmed bookings on public preview
    const bookings = allBookings.filter(
      (b) => b.status === BookingStatus.CONFIRMED
    );

    return NextResponse.json({
      classrooms,
      settings,
      bookings,
    });
  } catch (error) {
    console.error("Preview API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preview data" },
      { status: 500 }
    );
  }
}
