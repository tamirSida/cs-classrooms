"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDaysToDateString, CampusNow, nowInCampus } from "@/lib/time";
import { computeStaleness, nextAnchorDate, shouldFetch } from "@/lib/preview/refreshPolicy";

export interface PreviewClassroom {
  id: string;
  name: string;
}

export interface PreviewBooking {
  id: string;
  classroomId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface PreviewSettings {
  operatingHours: { start: string; end: string };
  signupCode?: string;
}

interface PreviewPayload {
  classrooms: PreviewClassroom[];
  settings: PreviewSettings;
  bookings: PreviewBooking[];
}

export type PreviewView = "day" | "week";

const REFRESH_INTERVAL_MS = 60_000;
const CLOCK_TICK_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const WEEK_VIEW_DAYS = 4;

// Data and clock for the unattended public display: follows campus "today", polls,
// refreshes on wake, times out hung requests and reports when data is stale.
export function usePreviewData(view: PreviewView, autoRefresh: boolean) {
  const [now, setNow] = useState<{ campus: CampusNow; ms: number }>(() => ({ campus: nowInCampus(), ms: Date.now() }));
  const [anchorState, setAnchorState] = useState(() => ({ anchor: nowInCampus().date, followToday: true }));
  const [data, setData] = useState<PreviewPayload | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);

  const lastInteractionRef = useRef(0);
  const lastSuccessRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const sequenceRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const anchor = anchorState.anchor;
  const endDate = view === "day" ? anchor : addDaysToDateString(anchor, WEEK_VIEW_DAYS - 1);

  const fetchData = useCallback(
    async (force: boolean) => {
      if (!force && !shouldFetch(lastSuccessRef.current, inFlightRef.current, Date.now())) return;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const sequence = ++sequenceRef.current;
      inFlightRef.current = true;

      try {
        const response = await fetch(`/api/preview?startDate=${anchor}&endDate=${endDate}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Preview request failed: ${response.status}`);
        const payload = (await response.json()) as PreviewPayload;
        if (sequence !== sequenceRef.current) return;
        setData(payload);
        lastSuccessRef.current = Date.now();
        setLastSuccessAt(lastSuccessRef.current);
      } catch (error) {
        if (sequence === sequenceRef.current) console.error("[preview] refresh failed:", error);
      } finally {
        clearTimeout(timeout);
        if (sequence === sequenceRef.current) inFlightRef.current = false;
      }
    },
    [anchor, endDate]
  );

  // New date range: fetch immediately, superseding any request for the old range.
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Clock runs independently of the network so the date still rolls over while offline.
  useEffect(() => {
    const tick = () => {
      const current = { campus: nowInCampus(), ms: Date.now() };
      setNow(current);
      setAnchorState((prev) =>
        nextAnchorDate(
          { ...prev, lastInteractionAt: lastInteractionRef.current },
          { campusDate: current.campus.date, ms: current.ms }
        )
      );
    };
    const timer = setInterval(tick, CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const refresh = () => fetchData(false);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [autoRefresh, fetchData]);

  const navigate = useCallback((days: number) => {
    lastInteractionRef.current = Date.now();
    setAnchorState((prev) => ({ anchor: addDaysToDateString(prev.anchor, days), followToday: false }));
  }, []);

  const goToToday = useCallback(() => {
    setAnchorState({ anchor: nowInCampus().date, followToday: true });
  }, []);

  return {
    classrooms: data?.classrooms ?? [],
    settings: data?.settings ?? null,
    bookings: data?.bookings ?? [],
    loading: data === null,
    stale: computeStaleness(lastSuccessAt, now.ms),
    lastSuccessAt,
    campusNow: now.campus,
    anchor,
    navigate,
    goToToday,
    refresh: () => fetchData(true),
  };
}
