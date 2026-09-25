import { request, type FullConfig } from "@playwright/test";

export const STORAGE_STATE = "e2e/.auth/user.json";

/** Daftarkan satu pengguna untuk tes tampilan, simpan cookie sesinya. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/v1/auth/register", {
    headers: { "X-Requested-With": "fundly" },
    data: { email: `viewport-${Date.now()}@contoh.com`, password: "rahasia123", display_name: "Rina" },
  });
  if (!res.ok()) throw new Error(`register gagal: ${res.status()} ${await res.text()}`);
  const me = await res.json();
  // Beberapa transaksi agar layar berisi data.
  const wallets = (await (await ctx.get("/api/v1/wallets")).json()).items;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  for (const [merchant, amount, kind] of [
    ["Warung Bu Tini, nasi rames dan es teh manis", 25000, "expense"],
    ["Indomaret", 78500, "expense"],
    ["Gaji September", 5250000, "income"],
  ] as const) {
    await ctx.post("/api/v1/transactions", {
      headers: { "X-Requested-With": "fundly" },
      data: { wallet_id: wallets[0].id, kind, amount, occurred_on: today, merchant },
    });
  }
  await ctx.storageState({ path: STORAGE_STATE });
  await ctx.dispose();
  process.env.E2E_USER_ID = me.id;
}
