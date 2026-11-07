"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { CalendarHeader } from "./CalendarHeader";
import { TimeGrid } from "./TimeGrid";
import { BookingModal, BookingSaveData, BookingSaveResult } from "./BookingModal";
import { FindClassroomModal } from "./FindClassroomModal";
import { IBooking, IClassroom, ISettings, UserRole } from "@/lib/models";
import { useAuth } from "@/contexts/AuthContext";
import { useBookings, useClassrooms, createSeries, previewFromConflict } from "@/hooks";
import { settingsService } from "@/lib/services";
import { Skeleton } from "@/components/ui/skeleton";

export function CalendarView() {
  const { user } = useAuth();
  const { bookings, fetchBookingsForClassroom, fetchAllBookings, createBooking, modifyBooking, cancelBooking, refetch } = useBookings();
  const { classrooms, loading: classroomsLoading, fetchBookableClassrooms } = useClassrooms();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week">("week");
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("all");
  const [settings, setSettings] = useState<ISettings | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [findModalOpen, setFindModalOpen] = useState(false);
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

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const s = await settingsService.getSettings(user.id);
    setSettings(s);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    settingsService.getSettings(user.id).then(setSettings);
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

  // Get selected classroom for single view
  const selectedClassroom = selectedClassroomId !== "all"
    ? classrooms.find((c) => c.id === selectedClassroomId)
    : undefined;

  const handleSlotClick = useCallback(
    (date: Date, startTime: string, endTime: string, classroomId?: string) => {
      // If clicking in all classrooms view, use the clicked classroom
      // Otherwise use the selected classroom
      const targetClassroomId = classroomId || (selectedClassroomId !== "all" ? selectedClassroomId : null);

      if (!targetClassroomId) return;

      // Temporarily set the classroom if clicked from all view
      if (classroomId && selectedClassroomId === "all") {
        setSelectedClassroomId(classroomId);
      }

      setSelectedBooking(null);
      setSelectedDate(date);
      setSelectedStartTime(startTime);
      setSelectedEndTime(endTime);
      setModalOpen(true);
      // Pick up permission changes (e.g. the recurring switch) without a reload.
      loadSettings();
    },
    [selectedClassroomId, loadSettings]
  );

  const handleBookingClick = useCallback((booking: IBooking) => {
    setSelectedBooking(booking);
    setSelectedDate(null);
    setSelectedStartTime("");
    setSelectedEndTime("");
    setModalOpen(true);
  }, []);

  const handleSaveBooking = async (data: BookingSaveData): Promise<BookingSaveResult> => {
    const { recurrence, ...slot } = data;
    if (selectedBooking) {
      return modifyBooking(selectedBooking.id, slot);
    }

    if (!selectedClassroomId || selectedClassroomId === "all" || !user) {
      return { success: false, error: "Please select a classroom to create a booking" };
    }

    if (recurrence) {
      const result = await createSeries({
        classroomId: selectedClassroomId,
        startDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        rule: recurrence.rule,
        skipDates: recurrence.skipDates,
      });
      if (result.ok) {
        await refetch();
        return { success: true };
      }
      return { success: false, error: result.error, preview: previewFromConflict(result) ?? undefined };
    }

    return createBooking({
      classroomId: selectedClassroomId,
      userId: user.id,
      userEmail: user.email,
      userName: user.displayName,
      ...slot,
    });
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) {
      return { success: false, error: "No booking selected" };
    }
    return cancelBooking(selectedBooking.id);
  };

  const handleFindClassroomSelect = (classroomId: string, date: Date, startTime: string, endTime: string) => {
    setSelectedClassroomId(classroomId);
    setSelectedBooking(null);
    setSelectedDate(date);
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
    setCurrentDate(date);
    setModalOpen(true);
  };

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
        onFindClick={() => setFindModalOpen(true)}
      />

      <div className="flex-1 mt-4 overflow-auto">
        <TimeGrid
          key={selectedClassroomId}
          currentDate={currentDate}
          view={view}
          bookings={bookings}
          operatingHours={settings.operatingHours}
          onSlotClick={handleSlotClick}
          onBookingClick={handleBookingClick}
          classrooms={selectedClassroomId === "all" ? classrooms : undefined}
          selectedClassroom={selectedClassroom}
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
        onSeriesChanged={() => refetch()}
        canOverride={
          !!user && (
            user.role === UserRole.SUPER_ADMIN ||
            (user.role === UserRole.ADMIN && !!settings.adminCanOverrideBookings)
          )
        }
        canRecur={
          !!user && (user.role !== UserRole.STUDENT || !!settings.allowRecurringForAllUsers)
        }
      />

      <FindClassroomModal
        isOpen={findModalOpen}
        onClose={() => setFindModalOpen(false)}
        classrooms={classrooms}
        bookings={bookings}
        operatingHours={settings.operatingHours}
        onSelectClassroom={handleFindClassroomSelect}
      />
    </div>
  );
}
