"use client";

import { useEffect, useState } from "react";
import {
  BookingSeriesSummary,
  SeriesCancelResult,
  SeriesCreateResult,
  SeriesDateEntry,
  SeriesInput,
  SeriesPreview,
} from "@/lib/models";
import { CancelScope } from "@/lib/recurrence";
import { authedFetch, readApiResult } from "@/lib/utils";

const PREVIEW_DEBOUNCE_MS = 400;

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number; data?: unknown };

async function postJson<T>(url: string, body: unknown, fallbackError: string, signal?: AbortSignal): Promise<ApiResult<T>> {
  try {
    const response = await authedFetch(url, { method: "POST", body: JSON.stringify(body), signal });
    return readApiResult<T>(response, fallbackError);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : fallbackError, status: 0 };
  }
}

export function createSeries(input: SeriesInput) {
  return postJson<SeriesCreateResult>("/api/bookings/series", input, "Failed to create recurring booking");
}

export function cancelSeries(
  seriesId: string,
  options: { scope: CancelScope; fromBookingId?: string; dryRun?: boolean }
) {
  return postJson<SeriesCancelResult>(
    `/api/bookings/series/${seriesId}/cancel`,
    options,
    "Failed to cancel recurring booking"
  );
}

export async function fetchSeriesSummaries(ids: string[]): Promise<BookingSeriesSummary[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const response = await authedFetch(`/api/bookings/series?ids=${encodeURIComponent(unique.join(","))}`);
  const result = await readApiResult<BookingSeriesSummary[]>(response, "Failed to load recurring bookings");
  return result.ok ? result.data : [];
}

// Extracts the refreshed date list from a 409 create response.
export function previewFromConflict(result: ApiResult<unknown>): SeriesDateEntry[] | null {
  if (result.ok || result.status !== 409) return null;
  const preview = (result.data as { preview?: SeriesDateEntry[] } | undefined)?.preview;
  return Array.isArray(preview) ? preview : null;
}

export interface SeriesPreviewState {
  preview: SeriesPreview | null;
  error: string | null;
  loading: boolean;
}

interface KeyedResult<T> {
  key: string;
  value: T;
}

// Debounced, abortable preview. loading stays true until a result for the current inputs arrives.
export function useSeriesPreview(input: SeriesInput | null): SeriesPreviewState {
  const key = input ? JSON.stringify(input) : null;
  const [result, setResult] = useState<KeyedResult<{ preview: SeriesPreview | null; error: string | null }> | null>(
    null
  );

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const response = await postJson<SeriesPreview>(
        "/api/bookings/series/preview",
        JSON.parse(key),
        "Failed to check dates",
        controller.signal
      );
      if (controller.signal.aborted) return;
      setResult({
        key,
        value: response.ok ? { preview: response.data, error: null } : { preview: null, error: response.error },
      });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  if (!key) return { preview: null, error: null, loading: false };
  if (result?.key !== key) return { preview: null, error: null, loading: true };
  return { ...result.value, loading: false };
}

export function useSeriesSummary(seriesId: string | undefined): BookingSeriesSummary | null {
  const [result, setResult] = useState<KeyedResult<BookingSeriesSummary | null> | null>(null);

  useEffect(() => {
    if (!seriesId) return;
    let active = true;
    fetchSeriesSummaries([seriesId]).then(([found]) => {
      if (active) setResult({ key: seriesId, value: found ?? null });
    });
    return () => {
      active = false;
    };
  }, [seriesId]);

  return seriesId && result?.key === seriesId ? result.value : null;
}
