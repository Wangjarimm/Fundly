import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./api/client";
import { App } from "./App";
import { initTheme } from "./lib/theme";
import "./index.css";

initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Klien API sudah mengulang saat cold start; jangan dobel.
      retry: false,
      refetchOnWindowFocus: (q) => !(q.state.error instanceof ApiError && q.state.error.status === 401),
    },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("#root tidak ditemukan");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
