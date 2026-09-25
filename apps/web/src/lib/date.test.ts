import { describe, expect, it } from "vitest";
import { currentMonth, dayHeading, greeting, longDate, monthLabel, shiftMonth, todayISO } from "./date";

// 2026-09-24 17:30 UTC = 2026-09-25 00:30 WIB
const lateUTC = new Date("2026-09-24T17:30:00Z");

describe("tanggal zona Jakarta", () => {
  it("memakai tanggal Jakarta, bukan UTC", () => {
    expect(todayISO(lateUTC)).toBe("2026-09-25");
    expect(currentMonth(lateUTC)).toBe("2026-09");
  });

  it("menggeser bulan melewati batas tahun", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-09", 0)).toBe("2026-09");
  });

  it("membuat label bahasa Indonesia", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(longDate("2026-09-25")).toBe("Jumat, 25 September 2026");
  });

  it("judul grup harian", () => {
    expect(dayHeading("2026-09-25", lateUTC)).toBe("Hari ini");
    expect(dayHeading("2026-09-24", lateUTC)).toBe("Kemarin");
    expect(dayHeading("2026-09-21", lateUTC)).toBe("Senin, 21 September");
    expect(dayHeading("2025-12-31", lateUTC)).toBe("Rabu, 31 Desember 2025");
  });

  it("sapaan sesuai jam Jakarta", () => {
    expect(greeting(new Date("2026-09-25T00:00:00Z"))).toBe("Selamat pagi"); // 07:00 WIB
    expect(greeting(new Date("2026-09-25T13:00:00Z"))).toBe("Selamat malam"); // 20:00 WIB
  });
});
