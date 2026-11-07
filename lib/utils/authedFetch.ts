import { getFirebaseAuth } from "@/lib/firebase/config";

// fetch() that sends the signed-in user's Firebase ID token to our API routes.
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}

// Parses a JSON API response into a uniform result.
export async function readApiResult<T>(
  response: Response,
  fallbackError: string
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; data?: unknown }> {
  const data = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: data as T };
  return { ok: false, error: data?.message || data?.error || fallbackError, status: response.status, data };
}
