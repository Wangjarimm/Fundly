// Klien API dengan penanganan cold start (D-16, F-07 KP6):
// - timeout wajar (20 detik),
// - retry dengan backoff untuk permintaan yang aman diulang,
// - status "Menyambungkan…" bila respons lebih dari ~2 detik.

import type { components } from "./schema";

export type Schemas = components["schemas"];

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Error jaringan/timeout: server belum bisa dihubungi. */
export class NetworkError extends ApiError {
  constructor(message = "Server belum bisa dihubungi. Periksa koneksi lalu coba lagi.") {
    super(0, "network", message);
    this.name = "NetworkError";
  }
}

export interface RequestOptions {
  body?: unknown;
  /** Ulangi otomatis bila gagal jaringan / 502–504. Default: true untuk GET. */
  retry?: boolean;
  signal?: AbortSignal;
  /** Timeout per percobaan; default config.timeoutMs. */
  timeoutMs?: number;
}

export const config = {
  timeoutMs: 20_000,
  slowAfterMs: 2_000,
  retryDelaysMs: [1_000, 2_000, 4_000],
};

// --- Status koneksi global (dipakai indikator "Menyambungkan…") ---

type Listener = () => void;
const listeners = new Set<Listener>();
let slowCount = 0;

export const connection = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  isSlow: () => slowCount > 0,
};

function setSlow(delta: number) {
  slowCount = Math.max(0, slowCount + delta);
  listeners.forEach((l) => l());
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const RETRYABLE = new Set([502, 503, 504]);

async function once(method: string, path: string, opts: RequestOptions): Promise<Response> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? config.timeoutMs);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (method !== "GET") headers["X-Requested-With"] = "fundly";
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    return await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: "same-origin",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

/** Kirim permintaan ke /api/v1 dan kembalikan JSON (atau undefined untuk 204). */
export async function api<T = unknown>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const retry = opts.retry ?? method === "GET";
  const attempts = retry ? config.retryDelaysMs.length + 1 : 1;

  let slow = false;
  const slowTimer = setTimeout(() => {
    slow = true;
    setSlow(1);
  }, config.slowAfterMs);

  try {
    for (let i = 0; i < attempts; i++) {
      let res: Response;
      try {
        res = await once(method, path, opts);
      } catch (err) {
        if (opts.signal?.aborted) throw err;
        if (i < attempts - 1) {
          await sleep(config.retryDelaysMs[i]!, opts.signal);
          continue;
        }
        throw new NetworkError();
      }
      if (RETRYABLE.has(res.status) && i < attempts - 1) {
        await sleep(config.retryDelaysMs[i]!, opts.signal);
        continue;
      }
      if (res.status === 204) return undefined as T;
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const e = data?.error;
        throw new ApiError(
          res.status,
          e?.code ?? "unknown",
          e?.message ?? "Terjadi kesalahan. Coba lagi sebentar lagi.",
        );
      }
      return data as T;
    }
    throw new NetworkError();
  } finally {
    clearTimeout(slowTimer);
    if (slow) setSlow(-1);
  }
}
