import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Bottom sheet di HP (< 768 px) dan dialog di tengah untuk layar lebih besar
 * (DESIGN.md: Bottom sheet, F-13 KP2). Esc menutup, fokus dikunci di dalam.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    (panel?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0]!;
        const last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-lg border-t border-outline bg-surface md:max-h-[88dvh] md:max-w-[520px] md:rounded-lg md:border"
      >
        <div className="flex items-center justify-between px-4 pt-2 md:pt-4">
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-outline md:hidden" />
          <h2 className="pt-3 text-title text-ink md:pt-0">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="mt-2 flex size-12 items-center justify-center rounded-full text-ink-muted hover:bg-surface-variant md:mt-0"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <div className="border-t border-outline px-4 pb-safe pt-3 [&>*]:mb-3">{footer}</div>}
      </div>
    </div>
  );
}
