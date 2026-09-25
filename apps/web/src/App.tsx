import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { errorMessage, useMe } from "./api/hooks";
import { AppShell } from "./components/AppShell";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { ToastProvider } from "./components/Toast";
import { ErrorState, Spinner } from "./components/ui";
import { TransactionSheetProvider } from "./features/TransactionSheetContext";
import { applyTheme, type Theme } from "./lib/theme";
import { HomePage } from "./pages/HomePage";

// Pecah kode per rute: hanya beranda yang ikut bundel awal.
const AuthPage = lazy(() => import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const MorePage = lazy(() => import("./pages/MorePage").then((m) => ({ default: m.MorePage })));

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>;
}

/** Hanya untuk pengguna yang sudah masuk; selain itu ke /masuk. */
function Protected({ children }: { children: ReactNode }) {
  const me = useMe();
  useEffect(() => {
    if (me.data) applyTheme(me.data.theme as Theme);
  }, [me.data]);

  if (me.isPending) {
    return (
      <FullScreen>
        <Spinner label="Membuka Fundly…" />
      </FullScreen>
    );
  }
  if (me.isError) {
    // Backend/DB benar-benar tidak tersedia (F-07 KP7).
    return (
      <FullScreen>
        <div className="w-full max-w-md">
          <ErrorState message={errorMessage(me.error)} onRetry={() => void me.refetch()} />
        </div>
      </FullScreen>
    );
  }
  if (!me.data) return <Redirect to="/masuk" replace />;
  return (
    <TransactionSheetProvider>
      <AppShell>
        <Suspense fallback={<Spinner />}>{children}</Suspense>
      </AppShell>
    </TransactionSheetProvider>
  );
}

function GuestOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.data) return <Redirect to="/" replace />;
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

export function App() {
  return (
    <ToastProvider>
      <ConnectionStatus />
      <Switch>
        <Route path="/masuk">
          <GuestOnly>
            <AuthPage mode="login" />
          </GuestOnly>
        </Route>
        <Route path="/daftar">
          <GuestOnly>
            <AuthPage mode="register" />
          </GuestOnly>
        </Route>
        <Route path="/">
          <Protected>
            <HomePage />
          </Protected>
        </Route>
        <Route path="/transaksi">
          <Protected>
            <TransactionsPage />
          </Protected>
        </Route>
        <Route path="/laporan">
          <Protected>
            <ReportsPage />
          </Protected>
        </Route>
        <Route path="/lainnya">
          <Protected>
            <MorePage />
          </Protected>
        </Route>
        <Route>
          <Redirect to="/" replace />
        </Route>
      </Switch>
    </ToastProvider>
  );
}
