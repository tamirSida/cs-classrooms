export interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export interface ActiveBooking extends TimeSlot {
  id: string;
  classroomId: string;
  userId: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return a.date === b.date && a.startTime < b.endTime && b.startTime < a.endTime;
}

// Dates whose slot overlaps a live booking in the same classroom.
export function conflictingDates(
  bookings: ActiveBooking[],
  classroomId: string,
  slots: TimeSlot[],
  excludeIds: Set<string> = new Set()
): Set<string> {
  const relevant = bookings.filter((b) => b.classroomId === classroomId && !excludeIds.has(b.id));
  return new Set(
    slots.filter((slot) => relevant.some((b) => slotsOverlap(slot, b))).map((slot) => slot.date)
  );
}

// Classroom value wins when set (>0) or unlimited (-1); 0 defers to the global value.
// Returns null for unlimited (any value <= 0 after resolution, matching BookingService).
export function resolveDailyLimit(classroomMax: number | undefined, globalMax: number): number | null {
  const effective = classroomMax && classroomMax !== 0 ? classroomMax : globalMax;
  return effective > 0 ? effective : null;
}

export function usedMinutes(
  bookings: ActiveBooking[],
  userId: string,
  classroomId: string,
  date: string
): number {
  return bookings
    .filter((b) => b.userId === userId && b.classroomId === classroomId && b.date === date)
    .reduce((sum, b) => sum + toMinutes(b.endTime) - toMinutes(b.startTime), 0);
}

export function validateSlotBasics(
  hours: { start: string; end: string },
  startTime: string,
  endTime: string
): string | null {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return "Invalid time";
  if (startTime >= endTime) return "End time must be after start time";
  if (startTime < hours.start || endTime > hours.end) {
    return `Booking must be within operating hours (${hours.start} - ${hours.end})`;
  }
  return null;
}
