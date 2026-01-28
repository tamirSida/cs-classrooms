"use client";

import { useState, useCallback, useEffect } from "react";
import { IClassroom, IClassroomCreate, IClassroomUpdate } from "@/lib/models";
import { classroomService } from "@/lib/services";
import { useAuth } from "@/contexts/AuthContext";

export function useClassrooms() {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<IClassroom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClassrooms = useCallback(async () => {
    if (!user) return [];

    setLoading(true);
    setError(null);
    try {
      const data = await classroomService.getClassroomsForUser(user);
      setClassrooms(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch classrooms");
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchBookableClassrooms = useCallback(async () => {
    if (!user) return [];

    setLoading(true);
    setError(null);
    try {
      const data = await classroomService.getBookableClassroomsForUser(user);
      setClassrooms(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch classrooms");
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createClassroom = useCallback(async (data: IClassroomCreate) => {
    setLoading(true);
    setError(null);
    try {
      const newClassroom = await classroomService.createClassroom(data);
      setClassrooms((prev) => [...prev, newClassroom]);
      return { success: true, classroom: newClassroom };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create classroom";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateClassroom = useCallback(
    async (id: string, data: IClassroomUpdate) => {
      setLoading(true);
      setError(null);
      try {
        const updated = await classroomService.updateClassroom(id, data);
        if (updated) {
          setClassrooms((prev) =>
            prev.map((c) => (c.id === id ? updated : c))
          );
          return { success: true, classroom: updated };
        }
        return { success: false, error: "Classroom not found" };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to update classroom";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteClassroom = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const success = await classroomService.deleteClassroom(id);
      if (success) {
        setClassrooms((prev) => prev.filter((c) => c.id !== id));
        return { success: true };
      }
      return { success: false, error: "Failed to delete classroom" };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete classroom";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleActive = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await classroomService.toggleClassroomActive(id);
      if (updated) {
        setClassrooms((prev) =>
          prev.map((c) => (c.id === id ? updated : c))
        );
        return { success: true };
      }
      return { success: false, error: "Failed to toggle classroom" };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to toggle classroom";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchClassrooms();
    }
  }, [user, fetchClassrooms]);

  return {
    classrooms,
    loading,
    error,
    fetchClassrooms,
    fetchBookableClassrooms,
    createClassroom,
    updateClassroom,
    deleteClassroom,
    toggleActive,
    clearError: () => setError(null),
  };
}
