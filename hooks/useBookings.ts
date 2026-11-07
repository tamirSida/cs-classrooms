"use client";

import { useState, useCallback } from "react";
import { IBooking, IBookingCreate, IBookingUpdate, BookingStatus } from "@/lib/models";
import { bookingService } from "@/lib/services";
import { useAuth } from "@/contexts/AuthContext";
import { authedFetch, readApiResult } from "@/lib/utils";

export function useBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<IBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookingsForClassroom = useCallback(
    async (classroomId: string, startDate: string, endDate: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await bookingService.getBookingsForClassroom(
          classroomId,
          startDate,
          endDate
        );
        setBookings(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch bookings");
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchAllBookings = useCallback(
    async (startDate: string, endDate: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await bookingService.getAllBookingsForDateRange(startDate, endDate);
        setBookings(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch bookings");
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchUserBookings = useCallback(async () => {
    if (!user) return [];

    setLoading(true);
    setError(null);
    try {
      const data = await bookingService.getBookingsForUser(user.id);
      setBookings(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch bookings");
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  const fetchPendingBookings = useCallback(async (classroomId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await bookingService.getPendingBookings(classroomId);
      setBookings(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch pending bookings");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

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
          return { success: false, error: result.error };
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
    createBooking,
    modifyBooking,
    cancelBooking,
    approveBooking,
    rejectBooking,
    reviewSeries,
    clearError: () => setError(null),
  };
}
