import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"] as const;

/** Papan angka 3 × 4, tombol ≥ 64 px (DESIGN.md: Keypad jumlah). */
export function Keypad({ onPress }: { onPress: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Papan angka">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onPress(k)}
          aria-label={k === "back" ? "Hapus satu angka" : k}
          className="flex h-16 items-center justify-center rounded-md bg-surface-variant text-headline text-ink tabular transition active:scale-[0.97] hover:brightness-95"
        >
          {k === "back" ? <Delete aria-hidden className="size-6" /> : k}
        </button>
      ))}
    </div>
  );
}
