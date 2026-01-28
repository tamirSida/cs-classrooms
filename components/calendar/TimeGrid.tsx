"use client";

import { useMemo, useState, useRef } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  parse,
  isToday,
  isBefore,
} from "date-fns";
import { cn } from "@/lib/utils";
import { IBooking, IClassroom, BookingStatus, TimeSlotFactory, UserRole, getClassroomColor, CLASSROOM_COLOR_OPTIONS } from "@/lib/models";
import { useAuth } from "@/contexts/AuthContext";

// User's own booking color
const USER_COLOR = { bg: "bg-primary", text: "text-primary-foreground", border: "border-primary", light: "bg-primary/20" };
const PENDING_COLOR = { bg: "bg-yellow-500", text: "text-yellow-950", border: "border-yellow-600", light: "bg-yellow-100" };

interface TimeGridProps {
  currentDate: Date;
  view: "day" | "week";
  bookings: IBooking[];
  operatingHours: { start: string; end: string };
  onSlotClick: (date: Date, startTime: string, endTime: string, classroomId?: string) => void;
  onBookingClick: (booking: IBooking) => void;
  classrooms?: IClassroom[];
  selectedClassroom?: IClassroom;
}

export function TimeGrid({
  currentDate,
  view,
  bookings,
  operatingHours,
  onSlotClick,
  onBookingClick,
  classrooms,
  selectedClassroom,
}: TimeGridProps) {
  const isAllClassroomsView = !!classrooms && classrooms.length > 0;
  const { user } = useAuth();
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ date: Date; time: string; classroomId?: string } | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);

  const timeSlots = useMemo(() => {
    return TimeSlotFactory.generateSlots(operatingHours.start, operatingHours.end, 15);
  }, [operatingHours]);

  const days = useMemo(() => {
    if (view === "day") {
      return [currentDate];
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, view]);

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  // Create a color map for classrooms using their configured color or fallback
  const classroomColorMap = useMemo(() => {
    const map = new Map<string, (typeof CLASSROOM_COLOR_OPTIONS)[number]>();
    if (classrooms) {
      classrooms.forEach((classroom, index) => {
        const color = getClassroomColor(classroom.color, index);
        map.set(classroom.id, color);
      });
    }
    return map;
  }, [classrooms]);

  const getBookingsForDayAndClassroom = (date: Date, classroomId?: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    // In single classroom view, filter by selected classroom to avoid showing stale data
    const filterClassroomId = classroomId || (selectedClassroom?.id);

    return bookings.filter((b) => {
      if (b.date !== dateStr || b.status === BookingStatus.CANCELLED) return false;
      if (filterClassroomId && b.classroomId !== filterClassroomId) return false;
      if (b.status === BookingStatus.PENDING && !isAdmin && b.userId !== user?.id) {
        return false;
      }
      return true;
    });
  };

  const getBookingStyle = (booking: IBooking) => {
    const startSlotIndex = timeSlots.findIndex((t) => t === booking.startTime);
    const endSlotIndex = timeSlots.findIndex((t) => t === booking.endTime);
    const slotCount = endSlotIndex - startSlotIndex;

    return {
      top: `${startSlotIndex * 48}px`,
      height: `${slotCount * 48 - 2}px`,
    };
  };

  const isSlotInPast = (date: Date, time: string) => {
    const slotDateTime = parse(time, "HH:mm", date);
    return isBefore(slotDateTime, new Date());
  };

  const isSlotBooked = (date: Date, time: string, classroomId?: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    // In single classroom view, filter by selected classroom
    const filterClassroomId = classroomId || (selectedClassroom?.id);

    return bookings.some((b) => {
      if (b.date !== dateStr || b.status === BookingStatus.CANCELLED) return false;
      if (filterClassroomId && b.classroomId !== filterClassroomId) return false;
      if (b.status === BookingStatus.PENDING && !isAdmin && b.userId !== user?.id) {
        return false;
      }
      const bookingStart = parse(b.startTime, "HH:mm", new Date());
      const bookingEnd = parse(b.endTime, "HH:mm", new Date());
      const slotTime = parse(time, "HH:mm", new Date());
      return slotTime >= bookingStart && slotTime < bookingEnd;
    });
  };

  const handleSlotMouseDown = (date: Date, time: string, classroomId?: string) => {
    if (isSlotInPast(date, time) || isSlotBooked(date, time, classroomId)) return;
    setIsDragging(true);
    setDragStart({ date, time, classroomId });
    setDragEnd(time);
  };

  const handleSlotMouseEnter = (time: string) => {
    if (!isDragging || !dragStart) return;
    setDragEnd(time);
  };

  const handleSlotMouseUp = () => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const startIndex = timeSlots.indexOf(dragStart.time);
    const endIndex = timeSlots.indexOf(dragEnd);

    const actualStartIndex = Math.min(startIndex, endIndex);
    const actualEndIndex = Math.max(startIndex, endIndex);

    const actualStartTime = timeSlots[actualStartIndex];
    const actualEndTime = timeSlots[actualEndIndex + 1] || operatingHours.end;

    onSlotClick(dragStart.date, actualStartTime, actualEndTime, dragStart.classroomId);

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const isSlotInDragRange = (date: Date, time: string, classroomId?: string) => {
    if (!isDragging || !dragStart || !dragEnd) return false;
    if (!isSameDay(date, dragStart.date)) return false;
    // In all classrooms view, check if we're in the same classroom column
    if (classroomId && dragStart.classroomId && classroomId !== dragStart.classroomId) return false;

    const startIndex = timeSlots.indexOf(dragStart.time);
    const endIndex = timeSlots.indexOf(dragEnd);
    const timeIndex = timeSlots.indexOf(time);

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    return timeIndex >= minIndex && timeIndex <= maxIndex;
  };

  const getBookingColor = (booking: IBooking) => {
    const isOwn = booking.userId === user?.id;

    if (booking.status === BookingStatus.PENDING) {
      return PENDING_COLOR;
    }

    if (isOwn) {
      return USER_COLOR;
    }

    // Use classroom color for other people's bookings
    // In single view, use selected classroom's color; in all view, use the booking's classroom color
    if (isAllClassroomsView) {
      return classroomColorMap.get(booking.classroomId) || getClassroomColor(undefined, 0);
    }

    // Single classroom view - use the selected classroom's configured color
    return getClassroomColor(selectedClassroom?.color, 0);
  };

  // Render the side-by-side classroom view for "all classrooms"
  if (isAllClassroomsView) {
    return (
      <div className="flex-1 overflow-auto">
        <div
          ref={gridRef}
          className="min-w-[800px]"
          onMouseUp={handleSlotMouseUp}
          onMouseLeave={handleSlotMouseUp}
        >
          {/* Classroom color legend */}
          <div className="sticky top-0 z-30 bg-background border-b p-2 flex flex-wrap gap-3">
            {classrooms.map((classroom) => {
              const color = classroomColorMap.get(classroom.id) || getClassroomColor(classroom.color, 0);
              return (
                <div key={classroom.id} className="flex items-center gap-1.5">
                  <div className={cn("w-3 h-3 rounded", color.bg)} />
                  <span className="text-xs font-medium">{classroom.name}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 ml-4 pl-4 border-l">
              <div className={cn("w-3 h-3 rounded", USER_COLOR.bg)} />
              <span className="text-xs font-medium">Your bookings</span>
            </div>
          </div>

          {/* Headers - Date + Classrooms for each day */}
          <div className="sticky top-[44px] z-20 bg-background border-b">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
              }}
            >
              <div className="border-r p-2" />
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  <div className="p-2 text-center border-b">
                    <div className="text-xs text-muted-foreground">
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold",
                        isToday(day) && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                  {/* Classroom sub-headers */}
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${classrooms.length}, 1fr)` }}>
                    {classrooms.map((classroom) => {
                      const color = classroomColorMap.get(classroom.id) || getClassroomColor(classroom.color, 0);
                      return (
                        <div
                          key={classroom.id}
                          className={cn(
                            "p-1 text-center text-[10px] font-medium border-r last:border-r-0 truncate",
                            color.light
                          )}
                          title={classroom.name}
                        >
                          {classroom.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Time grid with classroom columns */}
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
            }}
          >
            {/* Time labels */}
            <div className="border-r">
              {timeSlots.map((time, index) => (
                <div
                  key={time}
                  className="h-12 border-b text-xs text-muted-foreground pr-2 text-right flex items-start justify-end"
                >
                  {index % 4 === 0 && (
                    <span className="mt-[-6px]">{time}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns with classroom sub-columns */}
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-r grid",
                  isToday(day) && "bg-primary/5"
                )}
                style={{ gridTemplateColumns: `repeat(${classrooms.length}, 1fr)` }}
              >
                {classrooms.map((classroom, idx) => {
                  const dayBookings = getBookingsForDayAndClassroom(day, classroom.id);
                  const color = classroomColorMap.get(classroom.id) || getClassroomColor(classroom.color, idx);

                  return (
                    <div key={classroom.id} className="relative border-r last:border-r-0">
                      {/* Time slots for this classroom */}
                      {timeSlots.map((time) => {
                        const isPast = isSlotInPast(day, time);
                        const isBooked = isSlotBooked(day, time, classroom.id);
                        const isInDragRange = isSlotInDragRange(day, time, classroom.id);
                        const canInteract = !isPast && !isBooked;

                        return (
                          <div
                            key={time}
                            className={cn(
                              "h-12 border-b transition-colors",
                              isPast && "bg-muted/50",
                              idx % 2 === 1 && "bg-muted/20",
                              canInteract ? "cursor-pointer hover:bg-primary/10" : "cursor-default",
                              isInDragRange && "bg-primary/20"
                            )}
                            onMouseDown={() => handleSlotMouseDown(day, time, classroom.id)}
                            onMouseEnter={() => handleSlotMouseEnter(time)}
                          />
                        );
                      })}

                      {/* Bookings overlay */}
                      {dayBookings.map((booking) => {
                        const style = getBookingStyle(booking);
                        const bookingColor = getBookingColor(booking);
                        const isOwn = booking.userId === user?.id;
                        const isPending = booking.status === BookingStatus.PENDING;

                        return (
                          <div
                            key={booking.id}
                            className={cn(
                              "absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] cursor-pointer overflow-hidden",
                              bookingColor.bg,
                              bookingColor.text,
                              isPending && "border-2 border-dashed",
                              isPending && bookingColor.border
                            )}
                            style={style}
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookingClick(booking);
                            }}
                            title={`${booking.userName}: ${booking.startTime} - ${booking.endTime}`}
                          >
                            <div className="font-medium truncate">{booking.userName}</div>
                            <div className="truncate opacity-80">
                              {booking.startTime}-{booking.endTime}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Single classroom view (original layout with fixes)
  return (
    <div className="flex-1 overflow-auto">
      <div
        ref={gridRef}
        className="min-w-[300px]"
        onMouseUp={handleSlotMouseUp}
        onMouseLeave={handleSlotMouseUp}
      >
        {/* Day headers */}
        <div
          className="sticky top-0 z-20 bg-background border-b grid"
          style={{
            gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
          }}
        >
          <div className="border-r p-2" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "p-2 text-center border-r",
                isToday(day) && "bg-primary/5"
              )}
            >
              <div className="text-xs text-muted-foreground">
                {format(day, "EEE")}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold",
                  isToday(day) && "text-primary"
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
          }}
        >
          {/* Time labels */}
          <div className="border-r">
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className="h-12 border-b text-xs text-muted-foreground pr-2 text-right flex items-start justify-end"
              >
                {index % 4 === 0 && (
                  <span className="mt-[-6px]">{time}</span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayBookings = getBookingsForDayAndClassroom(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-r",
                  isToday(day) && "bg-primary/5"
                )}
              >
                {/* Time slots */}
                {timeSlots.map((time) => {
                  const isPast = isSlotInPast(day, time);
                  const isBooked = isSlotBooked(day, time);
                  const isInDragRange = isSlotInDragRange(day, time);
                  const canInteract = !isPast && !isBooked;

                  return (
                    <div
                      key={time}
                      className={cn(
                        "h-12 border-b transition-colors",
                        isPast && "bg-muted/50",
                        canInteract ? "cursor-pointer hover:bg-primary/10" : "cursor-default",
                        isInDragRange && "bg-primary/20"
                      )}
                      onMouseDown={() => handleSlotMouseDown(day, time)}
                      onMouseEnter={() => handleSlotMouseEnter(time)}
                    />
                  );
                })}

                {/* Bookings overlay */}
                {dayBookings.map((booking) => {
                  const style = getBookingStyle(booking);
                  const bookingColor = getBookingColor(booking);
                  const isPending = booking.status === BookingStatus.PENDING;

                  return (
                    <div
                      key={booking.id}
                      className={cn(
                        "absolute left-1 right-1 rounded px-2 py-1 text-xs cursor-pointer overflow-hidden",
                        bookingColor.bg,
                        bookingColor.text,
                        isPending && "border-2 border-dashed",
                        isPending && bookingColor.border
                      )}
                      style={style}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingClick(booking);
                      }}
                    >
                      <div className="font-medium truncate">{booking.userName}</div>
                      <div className="truncate">
                        {booking.startTime} - {booking.endTime}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
