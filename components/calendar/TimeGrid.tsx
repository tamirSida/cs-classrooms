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
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import { IBooking, IClassroom, BookingStatus, TimeSlotFactory, UserRole } from "@/lib/models";
import { useAuth } from "@/contexts/AuthContext";

interface TimeGridProps {
  currentDate: Date;
  view: "day" | "week";
  bookings: IBooking[];
  operatingHours: { start: string; end: string };
  onSlotClick: (date: Date, startTime: string, endTime: string) => void;
  onBookingClick: (booking: IBooking) => void;
  classrooms?: IClassroom[]; // When provided, shows all classrooms view
}

export function TimeGrid({
  currentDate,
  view,
  bookings,
  operatingHours,
  onSlotClick,
  onBookingClick,
  classrooms,
}: TimeGridProps) {
  const isAllClassroomsView = !!classrooms;
  const { user } = useAuth();
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ date: Date; time: string } | null>(null);
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

  const getBookingsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return bookings.filter((b) => {
      if (b.date !== dateStr || b.status === BookingStatus.CANCELLED) return false;
      // Hide pending bookings from non-admins (unless it's their own booking)
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

  const isSlotBooked = (date: Date, time: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return bookings.some((b) => {
      if (b.date !== dateStr || b.status === BookingStatus.CANCELLED) return false;
      // Pending bookings from others don't block slots for non-admins
      if (b.status === BookingStatus.PENDING && !isAdmin && b.userId !== user?.id) {
        return false;
      }
      const bookingStart = parse(b.startTime, "HH:mm", new Date());
      const bookingEnd = parse(b.endTime, "HH:mm", new Date());
      const slotTime = parse(time, "HH:mm", new Date());
      return slotTime >= bookingStart && slotTime < bookingEnd;
    });
  };

  const handleSlotMouseDown = (date: Date, time: string) => {
    if (isAllClassroomsView) return; // Can't create bookings in all classrooms view
    if (isSlotInPast(date, time) || isSlotBooked(date, time)) return;
    setIsDragging(true);
    setDragStart({ date, time });
    setDragEnd(time);
  };

  const getClassroomName = (classroomId: string) => {
    if (!classrooms) return null;
    return classrooms.find(c => c.id === classroomId)?.name;
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

    onSlotClick(dragStart.date, actualStartTime, actualEndTime);

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const isSlotInDragRange = (date: Date, time: string) => {
    if (!isDragging || !dragStart || !dragEnd) return false;
    if (!isSameDay(date, dragStart.date)) return false;

    const startIndex = timeSlots.indexOf(dragStart.time);
    const endIndex = timeSlots.indexOf(dragEnd);
    const timeIndex = timeSlots.indexOf(time);

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    return timeIndex >= minIndex && timeIndex <= maxIndex;
  };

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
                className="h-12 border-b text-xs text-muted-foreground pr-2 text-right relative"
              >
                {index % 4 === 0 && (
                  <span className="absolute -top-2 right-2">{time}</span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayBookings = getBookingsForDay(day);

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
                  const canInteract = !isAllClassroomsView && !isPast && !isBooked;

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
                  const isOwn = booking.userId === user?.id;
                  const classroomName = getClassroomName(booking.classroomId);

                  return (
                    <div
                      key={booking.id}
                      className={cn(
                        "absolute left-1 right-1 rounded px-2 py-1 text-xs cursor-pointer overflow-hidden",
                        isOwn
                          ? booking.status === BookingStatus.PENDING
                            ? "bg-yellow-500/80 text-yellow-950"
                            : "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                        booking.status === BookingStatus.PENDING &&
                          "border-2 border-dashed border-yellow-600"
                      )}
                      style={style}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingClick(booking);
                      }}
                    >
                      {classroomName && (
                        <div className="font-semibold truncate text-[10px] opacity-80">{classroomName}</div>
                      )}
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
