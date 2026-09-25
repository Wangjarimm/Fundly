import {
  ArrowDownLeft,
  ArrowUpRight,
  Bus,
  CircleEllipsis,
  Clapperboard,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Receipt,
  ShoppingBasket,
  Store,
  Tag,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/cn";

// Hanya ikon yang dipakai kategori bawaan yang diimpor (tree-shaking, bundel kecil).
const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-basket": ShoppingBasket,
  bus: Bus,
  receipt: Receipt,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  clapperboard: Clapperboard,
  house: House,
  users: Users,
  "hand-heart": HandHeart,
  "circle-ellipsis": CircleEllipsis,
  wallet: Wallet,
  store: Store,
  gift: Gift,
  "trending-up": TrendingUp,
  tag: Tag,
};

// Pasangan latar kontainer + warna ikon (kontras memadai, DESIGN.md).
const TONES: Record<string, string> = {
  "expense-container": "bg-expense-container text-expense",
  "income-container": "bg-income-container text-income",
  "warning-container": "bg-warning-container text-warning",
  "primary-container": "bg-primary-container text-on-primary-container",
  "surface-variant": "bg-surface-variant text-ink-muted",
};

export function CategoryIcon({
  icon,
  tone,
  kind,
  className,
}: {
  icon?: string;
  tone?: string;
  kind: "income" | "expense";
  className?: string;
}) {
  // Tanpa kategori: panah jenis transaksi (bukan hanya warna, DESIGN.md).
  const Icon = (icon && ICONS[icon]) || (kind === "income" ? ArrowDownLeft : ArrowUpRight);
  const toneClass =
    (tone && TONES[tone]) || (kind === "income" ? TONES["income-container"] : TONES["expense-container"]);
  return (
    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-sm", toneClass, className)}>
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  );
}
