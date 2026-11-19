import { API_URL } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
  get isNetwork() { return this.status === 0; }
}

const TIMEOUT_MS = 15_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Options { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal }

async function once<T>(path: string, { method = "GET", body, signal }: Options): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, json?.error?.code ?? "HTTP_ERROR", json?.error?.message ?? `Request failed (${res.status})`);
    }
    return json as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "NETWORK", "Can't reach GlamDesk. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GETs retry on network failures and 5xx with backoff (slow mobile data). POSTs never auto-retry:
 * a timed-out booking may still have been created, so the caller must check "My bookings" instead.
 */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  if ((opts.method ?? "GET") !== "GET") return once<T>(path, opts);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await once<T>(path, opts);
    } catch (e) {
      lastError = e;
      const retryable = e instanceof ApiError && (e.isNetwork || e.status >= 500);
      if (!retryable || attempt === 2) break;
      await sleep(600 * 2 ** attempt);
    }
  }
  throw lastError;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
