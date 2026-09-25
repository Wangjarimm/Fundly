// Pembungkus localStorage yang aman (bisa gagal di mode privat).

export function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // abaikan
  }
}

export const LAST_WALLET_KEY = "fundly:last-wallet";
