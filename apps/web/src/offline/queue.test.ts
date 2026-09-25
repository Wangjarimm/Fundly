import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clear, createStore } from "idb-keyval";
import { ApiError, NetworkError } from "../api/client";
import { __resetForTests, clearQueue, enqueue, flushQueue, loadQueue, queue, type TransactionCreate } from "./queue";

const body = (id: string, amount = 1000): TransactionCreate => ({
  client_id: id,
  wallet_id: "w1",
  kind: "expense",
  amount,
  occurred_on: "2026-09-25",
});

describe("antrean transaksi offline", () => {
  beforeEach(async () => {
    await clear(createStore("fundly", "tx-queue"));
    __resetForTests();
  });

  it("menyimpan ke IndexedDB dan bertahan setelah muat ulang", async () => {
    await enqueue("u1", body("a"));
    await enqueue("u1", body("b"));
    expect(queue.snapshot().map((i) => i.clientId)).toEqual(["a", "b"]);
    __resetForTests(); // seolah halaman dimuat ulang
    await loadQueue();
    expect(queue.snapshot().map((i) => i.clientId)).toEqual(["a", "b"]);
  });

  it("client_id yang sama tidak ganda di antrean", async () => {
    await enqueue("u1", body("a", 1));
    await enqueue("u1", body("a", 2));
    expect(queue.snapshot()).toHaveLength(1);
    expect(queue.snapshot()[0]!.body.amount).toBe(2);
  });

  it("mengirim berurutan dengan client_id asli lalu mengosongkan antrean", async () => {
    await enqueue("u1", body("a"));
    await enqueue("u1", body("b"));
    const send = vi.fn().mockResolvedValue({});
    const r = await flushQueue("u1", send);
    expect(r).toMatchObject({ sent: 2, stoppedByNetwork: false });
    expect(send.mock.calls.map((c) => c[0].client_id)).toEqual(["a", "b"]);
    expect(queue.snapshot()).toHaveLength(0);
  });

  it("berhenti saat jaringan gagal dan menyimpan sisanya", async () => {
    await enqueue("u1", body("a"));
    await enqueue("u1", body("b"));
    const send = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new NetworkError());
    const r = await flushQueue("u1", send);
    expect(r).toMatchObject({ sent: 1, stoppedByNetwork: true });
    expect(queue.snapshot().map((i) => i.clientId)).toEqual(["b"]);
  });

  it("server 503 dianggap belum siap, bukan gagal permanen", async () => {
    await enqueue("u1", body("a"));
    const r = await flushQueue("u1", vi.fn().mockRejectedValue(new ApiError(503, "db_unavailable", "x")));
    expect(r.stoppedByNetwork).toBe(true);
    expect(queue.snapshot()).toHaveLength(1);
  });

  it("validasi 4xx dikeluarkan dan dilaporkan", async () => {
    await enqueue("u1", body("a"));
    await enqueue("u1", body("b"));
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(422, "validation_failed", "Dompet ini sudah diarsipkan."))
      .mockResolvedValueOnce({});
    const r = await flushQueue("u1", send);
    expect(r.sent).toBe(1);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0]!.message).toBe("Dompet ini sudah diarsipkan.");
    expect(queue.snapshot()).toHaveLength(0);
  });

  it("hanya mengirim milik pengguna yang sedang masuk", async () => {
    await enqueue("u1", body("a"));
    await enqueue("u2", body("b"));
    const send = vi.fn().mockResolvedValue({});
    await flushQueue("u2", send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].client_id).toBe("b");
    expect(queue.snapshot().map((i) => i.userId)).toEqual(["u1"]);
    await clearQueue("u1");
    expect(queue.snapshot()).toHaveLength(0);
  });
});
