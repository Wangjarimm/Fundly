import { useSyncExternalStore } from "react";
import { CloudOff, LoaderCircle, RefreshCw } from "lucide-react";
import { connection } from "../api/client";
import { queue } from "../offline/queue";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Indikator kecil "Offline", "Menyambungkan…", dan "Menyinkronkan" yang tidak mengganggu (F-07 KP5). */
export function ConnectionStatus() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const slow = useSyncExternalStore(connection.subscribe, connection.isSlow, () => false);
  const syncing = useSyncExternalStore(queue.subscribe, queue.isSyncing, () => false);
  const pendingCount = useSyncExternalStore(queue.subscribe, () => queue.snapshot().length, () => 0);

  let content: React.ReactNode = null;
  if (!online) {
    content = (
      <>
        <CloudOff aria-hidden className="size-4" /> Offline{pendingCount > 0 ? ` · ${pendingCount} menunggu sinkron` : ""}
      </>
    );
  } else if (syncing) {
    content = (
      <>
        <RefreshCw aria-hidden className="size-4 animate-spin" /> Menyinkronkan
      </>
    );
  } else if (slow) {
    content = (
      <>
        <LoaderCircle aria-hidden className="size-4 animate-spin" /> Menyambungkan…
      </>
    );
  }
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed left-1/2 top-[calc(8px+env(safe-area-inset-top))] z-[70] -translate-x-1/2">
      {content && (
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-warning-container px-4 py-2 text-label text-warning shadow">
          {content}
        </span>
      )}
    </div>
  );
}
