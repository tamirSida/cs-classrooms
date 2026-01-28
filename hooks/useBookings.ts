"use client";

import { useState, useCallback } from "react";
import { IBooking, IBookingCreate, IBookingUpdate, BookingStatus } from "@/lib/models";
import { bookingService } from "@/lib/services";
import { useAuth } from "@/contexts/AuthContext";

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
        const result = await bookingService.createBooking(data, user);
        if (result.error) {
          setError(result.error);
          return { success: false, error: result.error };
        }
        setBookings((prev) => [...prev, result.booking]);
        return { success: true, booking: result.booking };
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
        const result = await bookingService.modifyBooking(bookingId, updates, user);
        if (result.error) {
          setError(result.error);
          return { success: false, error: result.error };
        }
        if (result.booking) {
          setBookings((prev) =>
            prev.map((b) => (b.id === bookingId ? result.booking! : b))
          );
        }
        return { success: true, booking: result.booking };
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
        const result = await bookingService.cancelBooking(bookingId, user);
        if (result.error) {
          setError(result.error);
          return { success: false, error: result.error };
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

  return {
    bookings,
    loading,
    error,
    fetchBookingsForClassroom,
    fetchUserBookings,
    createBooking,
    modifyBooking,
    cancelBooking,
    clearError: () => setError(null),
  };
}
