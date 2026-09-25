import { cn } from "../lib/cn";

/**
 * Identitas merek. Sementara hanya wordmark teks; logo SVG final dipasang
 * setelah pemilik proyek memilih salah satu dari 3 konsep (F-14).
 */
export function Brand({ compactOnTablet, className }: { compactOnTablet?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-title font-bold text-primary", className)}>
      <span aria-hidden className="flex size-8 items-center justify-center rounded-sm bg-primary text-on-primary">
        F
      </span>
      <span className={cn(compactOnTablet && "md:sr-only lg:not-sr-only")}>Fundly</span>
    </span>
  );
}
