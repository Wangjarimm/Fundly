import { useSyncExternalStore } from "react";
import { CloudOff, LoaderCircle } from "lucide-react";
import { connection } from "../api/client";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Indikator kecil "Offline" dan "Menyambungkan…" yang tidak mengganggu (F-07 KP5). */
export function ConnectionStatus() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const slow = useSyncExternalStore(connection.subscribe, connection.isSlow, () => false);
  if (online && !slow) return null;
  return (
    <div role="status" aria-live="polite" className="fixed left-1/2 top-[calc(8px+env(safe-area-inset-top))] z-[70] -translate-x-1/2">
      <span className="inline-flex items-center gap-2 rounded-full bg-warning-container px-4 py-2 text-label text-warning shadow">
        {!online ? (
          <>
            <CloudOff aria-hidden className="size-4" /> Offline
          </>
        ) : (
          <>
            <LoaderCircle aria-hidden className="size-4 animate-spin" /> Menyambungkan…
          </>
        )}
      </span>
    </div>
  );
}
