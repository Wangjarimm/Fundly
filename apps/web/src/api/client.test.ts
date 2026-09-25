import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, config, connection, NetworkError } from "./client";

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("klien API", () => {
  const saved = { ...config };
  beforeEach(() => {
    config.retryDelaysMs = [1, 1, 1];
    config.slowAfterMs = 20;
    config.timeoutMs = 50;
  });
  afterEach(() => {
    Object.assign(config, saved);
    vi.restoreAllMocks();
  });

  it("mengirim header CSRF dan JSON untuk permintaan yang mengubah data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(201, { id: "1" }));
    await api("POST", "/wallets", { body: { name: "Bank" } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/wallets");
    const headers = init!.headers as Record<string, string>;
    expect(headers["X-Requested-With"]).toBe("fundly");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init!.body).toBe('{"name":"Bank"}');
  });

  it("tidak mengirim header CSRF untuk GET", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, {}));
    await api("GET", "/me");
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-Requested-With"]).toBeUndefined();
  });

  it("mengulang GET saat server dingin (503) lalu berhasil", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(503, { error: { code: "db_unavailable", message: "x" } }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api("GET", "/wallets")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("tidak mengulang POST kecuali diminta", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("POST", "/transactions", { body: {} })).rejects.toBeInstanceOf(NetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mengulang POST idempoten bila retry: true", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json(201, { id: "t1" }));
    await expect(api("POST", "/transactions", { body: {}, retry: true })).resolves.toEqual({ id: "t1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("mengubah respons error menjadi ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(422, { error: { code: "validation_failed", message: "Jumlah harus lebih dari 0." } }),
    );
    const err = await api("POST", "/transactions", { body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: "validation_failed", message: "Jumlah harus lebih dari 0." });
  });

  it("menyerah setelah semua percobaan gagal", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("GET", "/me")).rejects.toBeInstanceOf(NetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("mengembalikan undefined untuk 204", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api("DELETE", "/transactions/1")).resolves.toBeUndefined();
  });

  it("menandai koneksi lambat setelah ambang waktu", async () => {
    let resolve!: (r: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((r) => (resolve = r)));
    const p = api("GET", "/me", { retry: false });
    expect(connection.isSlow()).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(connection.isSlow()).toBe(true);
    resolve(json(200, {}));
    await p;
    expect(connection.isSlow()).toBe(false);
  });
});
