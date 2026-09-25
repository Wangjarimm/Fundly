import { cn } from "../lib/cn";

/**
 * Logo Fundly (konsep 2 "Koin", F-14): logo mark sebagai file SVG statis
 * (tidak menambah bundel JS) + tulisan "Fundly" yang mengikuti warna tema.
 * compactOnTablet: di rail tablet hanya logo mark.
 */
export function Brand({ compactOnTablet, size = 32, className }: { compactOnTablet?: boolean; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight text-primary", className)}>
      <img src="/brand/logo-mark.svg" alt="" width={size} height={size} className="shrink-0" />
      <span className={cn(compactOnTablet && "md:sr-only lg:not-sr-only")}>Fundly</span>
    </span>
  );
}
