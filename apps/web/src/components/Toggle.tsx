/** Sakelar hidup/mati dengan target sentuh 48 px dan role="switch". */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-12 w-16 shrink-0 items-center justify-center"
    >
      <span className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-primary" : "bg-outline"}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}
