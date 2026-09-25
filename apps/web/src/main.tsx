import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createStore, del, get, set } from "idb-keyval";
import { registerSW } from "virtual:pwa-register";
import { ApiError } from "./api/client";
import { App } from "./App";
import { initTheme } from "./lib/theme";
import "./index.css";

initTheme();

// Service worker: precache cangkang aplikasi agar kunjungan ulang tampil instan
// walau backend sedang "dingin" atau perangkat offline (F-07 KP2, D-16a).
if (import.meta.env.PROD) registerSW({ immediate: true });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Simpan data terakhir dilihat selama 7 hari untuk dibaca saat offline (F-07 KP3).
      gcTime: 7 * 24 * 60 * 60 * 1000,
      // Klien API sudah mengulang saat cold start; jangan dobel.
      retry: false,
      refetchOnWindowFocus: (q) => !(q.state.error instanceof ApiError && q.state.error.status === 401),
    },
  },
});

const idb = createStore("fundly", "query-cache");
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get<string>(k, idb).then((v) => v ?? null),
    setItem: (k, v) => set(k, v, idb),
    removeItem: (k) => del(k, idb),
  },
  throttleTime: 1000,
});

const root = document.getElementById("root");
if (!root) throw new Error("#root tidak ditemukan");

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        buster: "fundly-v1",
        dehydrateOptions: {
          // Status "belum masuk" (me = null) tidak disimpan agar tidak dipulihkan setelah login.
          shouldDehydrateQuery: (q) => q.state.status === "success" && !(q.queryKey[0] === "me" && q.state.data == null),
        },
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
);
