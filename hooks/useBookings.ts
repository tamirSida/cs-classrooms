"use client";

import { useState, useCallback, useRef } from "react";
import { IBooking, IBookingCreate, IBookingUpdate, BookingStatus } from "@/lib/models";
import { bookingService } from "@/lib/services";
import { useAuth } from "@/contexts/AuthContext";
import { authedFetch, readApiResult } from "@/lib/utils";

export function useBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<IBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastLoaderRef = useRef<(() => Promise<IBooking[]>) | null>(null);
  const loadSequenceRef = useRef(0);

  // Runs a loader, remembering it so refetch() can repeat the last view's query.
  // Responses from superseded loads are ignored so a slow old query can't overwrite a newer view.
  const load = useCallback(async (loader: () => Promise<IBooking[]>, silent = false) => {
    lastLoaderRef.current = loader;
    const sequence = ++loadSequenceRef.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await loader();
      if (sequence === loadSequenceRef.current) setBookings(data);
      return data;
    } catch (err) {
      if (sequence === loadSequenceRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch bookings");
      }
      return [];
    } finally {
      if (!silent && sequence === loadSequenceRef.current) setLoading(false);
    }
  }, []);

  const fetchBookingsForClassroom = useCallback(
    (classroomId: string, startDate: string, endDate: string) =>
      load(() => bookingService.getBookingsForClassroom(classroomId, startDate, endDate)),
    [load]
  );

  const fetchAllBookings = useCallback(
    (startDate: string, endDate: string) =>
      load(() => bookingService.getAllBookingsForDateRange(startDate, endDate)),
    [load]
  );

  const fetchUserBookings = useCallback(async () => {
    if (!user) return [];
    const userId = user.id;
    return load(() => bookingService.getBookingsForUser(userId));
  }, [user, load]);

  // Re-runs the last query without showing the loading skeleton.
  const refetch = useCallback(async () => {
    const loader = lastLoaderRef.current;
    return loader ? load(loader, true) : [];
  }, [load]);

  const createBooking = useCallback(
    async (data: IBookingCreate) => {
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }

      setLoading(true);
      setError(null);
      try {
        // Use API route for booking creation (server-side email sending)
        const response = await authedFetch("/api/bookings", {
          method: "POST",
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.message || "Failed to create booking");
          return { success: false, error: result.message };
        }

        setBookings((prev) => [...prev, result]);
        return { success: true, booking: result };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to create booking";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const modifyBooking = useCallback(
    async (bookingId: string, updates: IBookingUpdate) => {
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }

      setLoading(true);
      setError(null);
      try {
        const response = await authedFetch(`/api/bookings/${bookingId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        const data = await response.json();
        if (!response.ok) {
          const errorMsg = data?.message || "Failed to modify booking";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
        const updated = data as IBooking;
        setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
        return { success: true, booking: updated };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to modify booking";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const cancelBooking = useCallback(
    async (bookingId: string) => {
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }

      setLoading(true);
      setError(null);
      try {
        const response = await authedFetch(`/api/bookings/${bookingId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: BookingStatus.CANCELLED }),
        });
        const data = await response.json();
        if (!response.ok) {
          const errorMsg = data?.message || "Failed to cancel booking";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId ? { ...b, status: BookingStatus.CANCELLED } : b
          )
        );
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to cancel booking";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const fetchPendingBookings = useCallback(
    (classroomId?: string) => load(() => bookingService.getPendingBookings(classroomId)),
    [load]
  );

  const review = useCallback(
    async (target: { bookingId?: string; seriesId?: string }, decision: "approve" | "reject") => {
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }

      setError(null);
      try {
        const response = await authedFetch("/api/bookings/review", {
          method: "POST",
          body: JSON.stringify({ ...target, decision }),
        });
        const result = await readApiResult<{ reviewed: string[] }>(response, `Failed to ${decision} booking`);
        if (!result.ok) {
          setError(result.error);
          const conflicts = (result.data as { conflicts?: string[] } | undefined)?.conflicts;
          return { success: false, error: result.error, conflicts };
        }
        const reviewed = new Set(result.data.reviewed);
        const status = decision === "approve" ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;
        setBookings((prev) => prev.map((b) => (reviewed.has(b.id) ? { ...b, status } : b)));
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : `Failed to ${decision} booking`;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [user]
  );

  const approveBooking = useCallback((bookingId: string) => review({ bookingId }, "approve"), [review]);
  const rejectBooking = useCallback((bookingId: string) => review({ bookingId }, "reject"), [review]);
  const reviewSeries = useCallback(
    (seriesId: string, decision: "approve" | "reject") => review({ seriesId }, decision),
    [review]
  );

  return {
    bookings,
    loading,
    error,
    fetchBookingsForClassroom,
    fetchAllBookings,
    fetchUserBookings,
    fetchPendingBookings,
    refetch,
    createBooking,
    modifyBooking,
    cancelBooking,
    approveBooking,
    rejectBooking,
    reviewSeries,
    clearError: () => setError(null),
  };
}
