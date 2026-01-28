"use client";

import { useState, useEffect, useMemo } from "react";
import { format, parseISO, startOfWeek, endOfWeek, addDays, isToday, isBefore, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useBookings, useClassrooms } from "@/hooks";
import { IBooking, BookingStatus, getClassroomColor } from "@/lib/models";
import { cn } from "@/lib/utils";
import { Calendar, Table2, Trash2, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";

type ViewMode = "table" | "calendar";

export function MyBookingsView() {
  const { user } = useAuth();
  const { bookings, loading, fetchUserBookings, cancelBooking } = useBookings();
  const { classrooms, fetchClassrooms } = useClassrooms();

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<IBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchUserBookings();
    fetchClassrooms();
  }, [fetchUserBookings, fetchClassrooms]);

  const classroomMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    classrooms.forEach((c, idx) => {
      const color = getClassroomColor(c.color, idx);
      map.set(c.id, { name: c.name, color: color.bg });
    });
    return map;
  }, [classrooms]);

  // Filter to only show non-cancelled bookings sorted by date
  const activeBookings = useMemo(() => {
    return bookings
      .filter((b) => b.status !== BookingStatus.CANCELLED)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [bookings]);

  // Split into upcoming and past
  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm");

    const upcoming: IBooking[] = [];
    const past: IBooking[] = [];

    activeBookings.forEach((b) => {
      if (b.date > todayStr || (b.date === todayStr && b.endTime > currentTime)) {
        upcoming.push(b);
      } else {
        past.push(b);
      }
    });

    return { upcoming, past: past.reverse() };
  }, [activeBookings]);

  const handleCancelClick = (booking: IBooking) => {
    setBookingToCancel(booking);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;

    setCancelling(true);
    const result = await cancelBooking(bookingToCancel.id);
    setCancelling(false);

    if (result.success) {
      setCancelDialogOpen(false);
      setBookingToCancel(null);
      fetchUserBookings();
    }
  };

  const canCancel = (booking: IBooking) => {
    const now = new Date();
    const bookingDateTime = parse(
      `${booking.date} ${booking.startTime}`,
      "yyyy-MM-dd HH:mm",
      new Date()
    );
    return !isBefore(bookingDateTime, now);
  };

  // Calendar view data
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, IBooking[]>();
    activeBookings.forEach((b) => {
      const existing = map.get(b.date) || [];
      existing.push(b);
      map.set(b.date, existing);
    });
    return map;
  }, [activeBookings]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {activeBookings.length} active booking{activeBookings.length !== 1 ? "s" : ""}
        </div>
        <div className="flex border rounded-lg">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
            className="rounded-r-none"
          >
            <Table2 className="h-4 w-4 mr-2" />
            Table
          </Button>
          <Button
            variant={viewMode === "calendar" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("calendar")}
            className="rounded-l-none"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Calendar
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="space-y-6">
          {/* Upcoming bookings */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Upcoming</h3>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No upcoming bookings
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {upcoming.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    classroomInfo={classroomMap.get(booking.classroomId)}
                    onCancel={() => handleCancelClick(booking)}
                    canCancel={canCancel(booking)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Past bookings */}
          {past.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg text-muted-foreground">Past</h3>
              <div className="space-y-2 opacity-60">
                {past.slice(0, 10).map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    classroomInfo={classroomMap.get(booking.classroomId)}
                    isPast
                  />
                ))}
                {past.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    And {past.length - 10} more past bookings...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Calendar navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentDate(addDays(currentDate, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentDate(addDays(currentDate, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="font-medium">
              {format(weekDays[0], "MMM d")} - {format(weekDays[6], "MMM d, yyyy")}
            </span>
          </div>

          {/* Week calendar */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDate.get(dateStr) || [];
              const isPast = isBefore(day, new Date()) && !isToday(day);

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "border rounded-lg min-h-[200px] p-2",
                    isToday(day) && "border-primary bg-primary/5",
                    isPast && "opacity-60"
                  )}
                >
                  <div className="text-center mb-2">
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
                  <div className="space-y-1">
                    {dayBookings.map((booking) => {
                      const classroom = classroomMap.get(booking.classroomId);
                      return (
                        <div
                          key={booking.id}
                          className={cn(
                            "text-xs p-1.5 rounded cursor-pointer hover:opacity-80",
                            classroom?.color || "bg-primary",
                            "text-white"
                          )}
                          onClick={() => !isPast && canCancel(booking) && handleCancelClick(booking)}
                          title={`${classroom?.name || "Unknown"}: ${booking.startTime} - ${booking.endTime}`}
                        >
                          <div className="font-medium truncate">
                            {booking.startTime}
                          </div>
                          <div className="truncate opacity-80">
                            {classroom?.name || "Unknown"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking?
            </DialogDescription>
          </DialogHeader>
          {bookingToCancel && (
            <div className="py-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {classroomMap.get(bookingToCancel.classroomId)?.name || "Unknown Classroom"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(parseISO(bookingToCancel.date), "EEEE, MMMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{bookingToCancel.startTime} - {bookingToCancel.endTime}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface BookingCardProps {
  booking: IBooking;
  classroomInfo?: { name: string; color: string };
  onCancel?: () => void;
  canCancel?: boolean;
  isPast?: boolean;
}

function BookingCard({ booking, classroomInfo, onCancel, canCancel, isPast }: BookingCardProps) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("w-2 h-12 rounded-full", classroomInfo?.color || "bg-primary")} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{classroomInfo?.name || "Unknown Classroom"}</span>
              {booking.status === BookingStatus.PENDING && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Pending Approval
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(booking.date), "EEE, MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {booking.startTime} - {booking.endTime}
              </span>
            </div>
          </div>
        </div>
        {!isPast && canCancel && onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
