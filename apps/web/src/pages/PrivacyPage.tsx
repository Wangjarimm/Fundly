import { Link } from "wouter";
import { Brand } from "../components/Brand";

/**
 * Kebijakan privasi sederhana (F-08 KP3). Pemilik proyek wajib meninjau
 * kewajiban hukum (termasuk UU Pelindungan Data Pribadi) sebelum rilis komersial.
 */
export function PrivacyPage({ standalone }: { standalone?: boolean }) {
  const content = (
    <article className="flex max-w-[65ch] flex-col gap-4 text-body text-ink">
      <h1 className="text-headline">Kebijakan privasi</h1>
      <p className="text-body-small text-ink-muted">Berlaku sejak September 2026.</p>

      <h2 className="text-title">Data yang disimpan</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Email, nama panggilan, dan password yang di-hash (tidak bisa dibaca siapa pun).</li>
        <li>Bila masuk dengan Google: ID akun Google dan email. Fundly tidak meminta akses ke data Google lainnya.</li>
        <li>Dompet, kategori, transaksi, dan anggaran yang kamu catat.</li>
        <li>Sesi masuk (cookie) agar kamu tidak perlu masuk berulang kali.</li>
      </ul>

      <h2 className="text-title">Yang tidak dilakukan</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Tidak ada iklan dan tidak ada pelacak pihak ketiga.</li>
        <li>Data tidak dijual atau dibagikan kepada pihak lain.</li>
        <li>Fundly tidak terhubung ke rekening bank atau e-wallet mana pun.</li>
      </ul>

      <h2 className="text-title">Penyimpanan</h2>
      <p>
        Data disimpan di database PostgreSQL (Supabase, region Singapura) dan aplikasi berjalan di Vercel. Koneksi selalu terenkripsi (HTTPS).
      </p>

      <h2 className="text-title">Hakmu</h2>
      <p>
        Kamu bisa mengunduh semua transaksi (CSV) dan menghapus akun beserta seluruh datanya kapan saja lewat halaman Pengaturan. Penghapusan
        bersifat permanen.
      </p>
    </article>
  );
  if (!standalone) return content;
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
      <Link href="/masuk" className="self-start">
        <Brand />
      </Link>
      {content}
    </main>
  );
}
