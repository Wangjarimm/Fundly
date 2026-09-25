import { describe, expect, it } from "vitest";
import { formatCompact, formatRupiah, formatSigned, groupThousands, keypadPress, parseDigits } from "./money";

describe("format uang", () => {
  it("mengelompokkan ribuan dengan titik", () => {
    expect(groupThousands(0)).toBe("0");
    expect(groupThousands(999)).toBe("999");
    expect(groupThousands(87500)).toBe("87.500");
    expect(groupThousands(1234567890)).toBe("1.234.567.890");
  });

  it("memformat rupiah dengan spasi setelah Rp", () => {
    expect(formatRupiah(87500)).toBe("Rp 87.500");
    expect(formatRupiah(-25000)).toBe("−Rp 25.000");
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("memberi tanda + dan − sesuai jenis", () => {
    expect(formatSigned(750000, "income")).toBe("+Rp 750.000");
    expect(formatSigned(25000, "expense")).toBe("−Rp 25.000");
  });

  it("memformat ringkas", () => {
    expect(formatCompact(87500)).toBe("87,5 rb");
    expect(formatCompact(6_500_000)).toBe("6,5 jt");
    expect(formatCompact(1_200_000_000)).toBe("1,2 M");
    expect(formatCompact(500)).toBe("500");
  });
});

describe("masukan angka", () => {
  it("mengambil digit saja", () => {
    expect(parseDigits("Rp 87.500")).toBe(87500);
    expect(parseDigits("")).toBe(0);
    expect(parseDigits("000")).toBe(0);
    expect(parseDigits("abc12")).toBe(12);
  });

  it("keypad menambah, menghapus, dan membatasi panjang", () => {
    let v = 0;
    for (const k of ["8", "7", "5", "0", "0"]) v = keypadPress(v, k);
    expect(v).toBe(87500);
    expect(keypadPress(v, "back")).toBe(8750);
    expect(keypadPress(0, "0")).toBe(0);
    expect(keypadPress(0, "000")).toBe(0);
    expect(keypadPress(5, "000")).toBe(5000);
    expect(keypadPress(9, "x")).toBe(9);
    const max = 999_999_999_999_999;
    expect(keypadPress(max, "9")).toBe(max);
    expect(keypadPress(0, "back")).toBe(0);
  });
});
