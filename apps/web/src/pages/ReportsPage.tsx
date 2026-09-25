import { Card, PageTitle } from "../components/ui";

/** Laporan bulanan dibangun di M3 (F-05); halaman ini sengaja ringan. */
export function ReportsPage() {
  return (
    <div>
      <PageTitle>Laporan</PageTitle>
      <Card>
        <p className="text-body text-ink">Laporan bulanan sedang disiapkan. Sementara itu, ringkasan bulan ini ada di Beranda.</p>
      </Card>
    </div>
  );
}
