"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { CalendarHeader } from "./CalendarHeader";
import { TimeGrid } from "./TimeGrid";
import { BookingModal } from "./BookingModal";
import { IBooking, IClassroom, ISettings } from "@/lib/models";
import { useAuth } from "@/contexts/AuthContext";
import { useBookings, useClassrooms } from "@/hooks";
import { settingsService } from "@/lib/services";
import { Skeleton } from "@/components/ui/skeleton";

export function CalendarView() {
  const { user } = useAuth();
  const { bookings, loading: bookingsLoading, fetchBookingsForClassroom, fetchAllBookings, createBooking, modifyBooking, cancelBooking } = useBookings();
  const { classrooms, loading: classroomsLoading, fetchBookableClassrooms } = useClassrooms();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week">("week");
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("all");
  const [settings, setSettings] = useState<ISettings | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<IBooking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");
  const [selectedEndTime, setSelectedEndTime] = useState<string>("");

  // Responsive view handling
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setView("day");
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      const s = await settingsService.getSettings(user.id);
      setSettings(s);
    };
    loadSettings();
  }, [user]);

  // Load classrooms
  useEffect(() => {
    fetchBookableClassrooms();
  }, [fetchBookableClassrooms]);

  // Load bookings when classroom or date changes
  useEffect(() => {
    const start = view === "day"
      ? format(currentDate, "yyyy-MM-dd")
      : format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");

    const end = view === "day"
      ? format(currentDate, "yyyy-MM-dd")
      : format(endOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");

    if (selectedClassroomId === "all") {
      fetchAllBookings(start, end);
    } else {
      fetchBookingsForClassroom(selectedClassroomId, start, end);
    }
  }, [selectedClassroomId, currentDate, view, fetchBookingsForClassroom, fetchAllBookings]);

  const handleSlotClick = useCallback(
    (date: Date, startTime: string, endTime: string) => {
      // Don't allow creating bookings when viewing all classrooms
      if (selectedClassroomId === "all") return;

      setSelectedBooking(null);
      setSelectedDate(date);
      setSelectedStartTime(startTime);
      setSelectedEndTime(endTime);
      setModalOpen(true);
    },
    [selectedClassroomId]
  );

  const handleBookingClick = useCallback((booking: IBooking) => {
    setSelectedBooking(booking);
    setSelectedDate(null);
    setSelectedStartTime("");
    setSelectedEndTime("");
    setModalOpen(true);
  }, []);

  const handleSaveBooking = async (data: {
    date: string;
    startTime: string;
    endTime: string;
  }) => {
    if (!selectedClassroomId || selectedClassroomId === "all" || !user) {
      return { success: false, error: "Please select a classroom to create a booking" };
    }

    if (selectedBooking) {
      return modifyBooking(selectedBooking.id, data);
    }

    return createBooking({
      classroomId: selectedClassroomId,
      userId: user.id,
      userEmail: user.email,
      userName: user.displayName,
      ...data,
    });
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) {
      return { success: false, error: "No booking selected" };
    }
    return cancelBooking(selectedBooking.id);
  };

  const selectedClassroom = selectedClassroomId === "all"
    ? undefined
    : classrooms.find((c) => c.id === selectedClassroomId);

  if (classroomsLoading || !settings) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (classrooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center">
        <h3 className="text-lg font-semibold">No Classrooms Available</h3>
        <p className="text-muted-foreground mt-2">
          There are no classrooms available for booking at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        classrooms={classrooms}
        selectedClassroomId={selectedClassroomId}
        onDateChange={setCurrentDate}
        onViewChange={setView}
        onClassroomChange={setSelectedClassroomId}
      />

      <div className="flex-1 mt-4 overflow-auto">
        <TimeGrid
          currentDate={currentDate}
          view={view}
          bookings={bookings}
          operatingHours={settings.operatingHours}
          onSlotClick={handleSlotClick}
          onBookingClick={handleBookingClick}
          classrooms={selectedClassroomId === "all" ? classrooms : undefined}
        />
      </div>

      <BookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        booking={selectedBooking}
        classroom={selectedBooking ? classrooms.find(c => c.id === selectedBooking.classroomId) : selectedClassroom}
        selectedDate={selectedDate || undefined}
        selectedStartTime={selectedStartTime}
        selectedEndTime={selectedEndTime}
        operatingHours={settings.operatingHours}
        onSave={handleSaveBooking}
        onCancel={handleCancelBooking}
      />
    </div>
  );
}
