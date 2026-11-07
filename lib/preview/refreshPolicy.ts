export const STALE_AFTER_MS = 180_000;
export const RETURN_TO_TODAY_MS = 300_000;
export const MIN_FETCH_GAP_MS = 10_000;

export function computeStaleness(lastSuccessAt: number | null, nowMs: number): boolean {
  return lastSuccessAt !== null && nowMs - lastSuccessAt > STALE_AFTER_MS;
}

export interface AnchorState {
  anchor: string;
  followToday: boolean;
  lastInteractionAt: number;
}

// Decides which date an unattended display should show.
export function nextAnchorDate(
  state: AnchorState,
  now: { campusDate: string; ms: number }
): { anchor: string; followToday: boolean } {
  if (state.followToday || now.ms - state.lastInteractionAt >= RETURN_TO_TODAY_MS) {
    return { anchor: now.campusDate, followToday: true };
  }
  return { anchor: state.anchor, followToday: false };
}

export function shouldFetch(
  lastSuccessAt: number | null,
  inFlight: boolean,
  nowMs: number,
  minGapMs = MIN_FETCH_GAP_MS
): boolean {
  if (inFlight) return false;
  return lastSuccessAt === null || nowMs - lastSuccessAt >= minGapMs;
}
