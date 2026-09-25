import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ChartColumn, House, Menu, Plus, ReceiptText, type LucideIcon } from "lucide-react";
import { useOpenTransaction } from "../features/TransactionSheetContext";
import { cn } from "../lib/cn";
import { Brand } from "./Brand";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/", label: "Beranda", icon: House },
  { href: "/transaksi", label: "Transaksi", icon: ReceiptText },
  { href: "/laporan", label: "Laporan", icon: ChartColumn },
  { href: "/lainnya", label: "Lainnya", icon: Menu },
];

function useActive() {
  const [location] = useLocation();
  return (href: string) => (href === "/" ? location === "/" : location.startsWith(href));
}

/**
 * Kerangka responsif (DESIGN.md: Breakpoint dan perilaku responsif):
 * < 768 px navigasi bawah 5 item; 768–1023 px rail ikon; ≥ 1024 px sidebar penuh.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const isActive = useActive();
  const openTx = useOpenTransaction();

  return (
    <div className="min-h-dvh md:flex">
      <a href="#konten" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[80] focus:rounded-md focus:bg-surface focus:p-3">
        Lewati ke konten
      </a>

      {/* Rail (tablet) dan sidebar (laptop/desktop) */}
      <nav
        aria-label="Navigasi utama"
        data-testid="side-nav"
        className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-2 border-r border-outline bg-surface px-2 py-4 md:flex md:w-24 lg:w-64 lg:px-4"
      >
        <div className="mb-4 flex h-12 items-center justify-center lg:justify-start lg:px-2">
          <Brand compactOnTablet />
        </div>
        <button
          type="button"
          onClick={() => openTx()}
          className="mb-2 flex min-h-14 flex-col items-center justify-center gap-1 rounded-md bg-accent px-2 text-label text-on-accent shadow-sm transition hover:brightness-105 lg:flex-row lg:justify-start lg:gap-3 lg:px-4"
        >
          <Plus aria-hidden className="size-6" strokeWidth={2.5} />
          <span className="text-xs lg:text-label">Catat</span>
        </button>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-2 text-xs transition lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-label",
              isActive(item.href) ? "bg-primary-container font-semibold text-on-primary-container" : "text-ink-muted hover:bg-surface-variant hover:text-ink",
            )}
          >
            <item.icon aria-hidden className="size-6" strokeWidth={1.75} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header HP */}
        <header className="pt-safe sticky top-0 z-30 border-b border-outline bg-surface md:hidden">
          <div className="flex h-14 items-center px-4">
            <Brand />
          </div>
        </header>

        <main id="konten" className="w-full max-w-[1120px] flex-1 px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-8 lg:px-10">
          {children}
        </main>
      </div>

      {/* Navigasi bawah (HP) */}
      <nav
        aria-label="Navigasi utama"
        data-testid="bottom-nav"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-outline bg-surface md:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-center">
          {NAV.slice(0, 2).map((item) => (
            <BottomLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => openTx()}
              aria-label="Tambah transaksi"
              className="-mt-6 flex size-[60px] items-center justify-center rounded-full bg-accent text-on-accent shadow-md transition active:scale-95"
            >
              <Plus aria-hidden className="size-7" strokeWidth={2.5} />
            </button>
          </div>
          {NAV.slice(2).map((item) => (
            <BottomLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs", active ? "font-semibold text-primary" : "text-ink-muted")}
    >
      <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition", active && "bg-primary-container")}>
        <item.icon aria-hidden className="size-5" strokeWidth={1.75} />
      </span>
      {item.label}
    </Link>
  );
}
