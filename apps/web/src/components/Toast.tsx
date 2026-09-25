import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ToastData {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<(t: Omit<ToastData, "id">) => void>(() => {});

export const useToast = () => useContext(ToastContext);

/** Toast di atas navigasi bawah; pesan berbentuk kejadian selesai (DESIGN.md). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const counter = useRef(0);

  const show = useCallback((t: Omit<ToastData, "id">) => {
    counter.current += 1;
    setToast({ ...t, id: counter.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => clearTimeout(timer.current);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-6"
      >
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex min-h-12 w-full max-w-md items-center justify-between gap-3 rounded-md bg-ink px-4 py-2 text-body-small text-background shadow-lg"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="min-h-12 shrink-0 rounded-sm px-3 text-label font-semibold text-accent hover:underline"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
