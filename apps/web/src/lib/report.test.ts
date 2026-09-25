import { describe, expect, it } from "vitest";
import { comparisonText } from "./report";

describe("kalimat banding bulan", () => {
  it("netral dan tanpa penilaian", () => {
    expect(comparisonText(8)).toBe("Pengeluaran naik 8% dari bulan lalu.");
    expect(comparisonText(-12.5)).toBe("Pengeluaran turun 12,5% dari bulan lalu.");
    expect(comparisonText(0)).toBe("Pengeluaran sama dengan bulan lalu.");
    expect(comparisonText(null)).toBe("Belum ada pengeluaran bulan lalu untuk dibandingkan.");
    for (const v of [50, -50]) expect(comparisonText(v)).not.toMatch(/boros|hemat|bagus|buruk/i);
  });
});
