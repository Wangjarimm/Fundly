import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { errorMessage, useMe } from "./api/hooks";
import { AppShell } from "./components/AppShell";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { ToastProvider } from "./components/Toast";
import { ErrorState, Spinner } from "./components/ui";
import { TransactionSheetProvider } from "./features/TransactionSheetContext";
import { SyncManager } from "./offline/SyncManager";
import { applyTheme, type Theme } from "./lib/theme";
import { HomePage } from "./pages/HomePage";

// Pecah kode per rute: hanya beranda yang ikut bundel awal.
const AuthPage = lazy(() => import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const MorePage = lazy(() => import("./pages/MorePage").then((m) => ({ default: m.MorePage })));
const BudgetsPage = lazy(() => import("./pages/BudgetsPage").then((m) => ({ default: m.BudgetsPage })));
const WalletsPage = lazy(() => import("./pages/WalletsPage").then((m) => ({ default: m.WalletsPage })));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage").then((m) => ({ default: m.CategoriesPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const StatusPage = lazy(() => import("./pages/StatusPage").then((m) => ({ default: m.StatusPage })));

/** Kebijakan privasi bisa dibuka tanpa masuk. */
function PrivacyRoute() {
  const me = useMe();
  if (me.data) {
    return (
      <Protected>
        <PrivacyPage />
      </Protected>
    );
  }
  return (
    <Suspense fallback={<Spinner />}>
      <PrivacyPage standalone />
    </Suspense>
  );
}

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>;
}

/** Hanya untuk pengguna yang sudah masuk; selain itu ke /masuk. */
function Protected({ children }: { children: ReactNode }) {
  const me = useMe();
  useEffect(() => {
    if (me.data) applyTheme(me.data.theme as Theme);
  }, [me.data]);

  // Data dari cache (termasuk saat offline) tetap dipakai walau refetch gagal (F-07 KP3).
  if (me.isPending && !me.data) {
    return (
      <FullScreen>
        <Spinner label="Membuka Fundly…" />
      </FullScreen>
    );
  }
  if (me.isError && me.data === undefined) {
    // Backend/DB benar-benar tidak tersedia (F-07 KP7).
    return (
      <FullScreen>
        <div className="w-full max-w-md">
          <ErrorState message={errorMessage(me.error)} onRetry={() => void me.refetch()} />
          <a href="/status" className="mt-3 inline-flex min-h-12 items-center text-label text-primary underline-offset-4 hover:underline">
            Lihat status layanan
          </a>
        </div>
      </FullScreen>
    );
  }
  if (!me.data) return <Redirect to="/masuk" replace />;
  return (
    <TransactionSheetProvider>
      <SyncManager />
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
        <Route path="/anggaran">
          <Protected>
            <BudgetsPage />
          </Protected>
        </Route>
        <Route path="/dompet">
          <Protected>
            <WalletsPage />
          </Protected>
        </Route>
        <Route path="/kategori">
          <Protected>
            <CategoriesPage />
          </Protected>
        </Route>
        <Route path="/pengaturan">
          <Protected>
            <SettingsPage />
          </Protected>
        </Route>
        <Route path="/privasi">
          <PrivacyRoute />
        </Route>
        <Route path="/status">
          <Suspense fallback={<Spinner />}>
            <StatusPage />
          </Suspense>
        </Route>
        <Route>
          <Redirect to="/" replace />
        </Route>
      </Switch>
    </ToastProvider>
  );
}
