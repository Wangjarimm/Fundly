// Mode tampilan: terang, gelap, atau ikuti sistem (DESIGN.md, F-08 KP1).

export type Theme = "system" | "light" | "dark";

const KEY = "fundly:theme";

export function applyTheme(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // abaikan
  }
}

/** Dipanggil sebelum React render agar tidak berkedip. */
export function initTheme(): void {
  let t: Theme = "system";
  try {
    t = (localStorage.getItem(KEY) as Theme | null) ?? "system";
  } catch {
    // abaikan
  }
  applyTheme(t);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    let cur: Theme = "system";
    try {
      cur = (localStorage.getItem(KEY) as Theme | null) ?? "system";
    } catch {
      // abaikan
    }
    if (cur === "system") applyTheme("system");
  });
}
