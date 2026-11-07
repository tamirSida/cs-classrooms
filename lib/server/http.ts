import "server-only";
import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: Record<string, unknown>
  ) {
    super(message);
  }
}

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

// Wraps a route handler so HttpErrors become JSON responses and anything else a 500.
export function withErrors<A extends unknown[]>(label: string, handler: Handler<A>): Handler<A> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ message: error.message, ...error.body }, { status: error.status });
      }
      console.error(`[${label}]`, error);
      return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
    }
  };
}

export async function readJson<T>(request: Request): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Invalid JSON body");
  }
  return body as T;
}
