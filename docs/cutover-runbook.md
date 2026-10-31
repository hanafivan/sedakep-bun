# Runbook Cutover & Rollback — Sedakep (TypeScript/Hono)

Dokumen operasional Fase 14. Migrasi isi data (Fase 9/10) saat ini **ditunda** atas
keputusan pemilik; langkah di bawah berlaku saat keputusan go-live diambil.

## Prasyarat

```bash
# MySQL + MinIO hidup
/Applications/XAMPP/xamppfiles/bin/mysql -h127.0.0.1 -uroot -e "SELECT 1"
curl -s -o /dev/null -w 'minio=%{http_code}\n' http://127.0.0.1:9000/minio/health/live

# Migrasi schema 12/12, tanpa drift
MYSQL_DATABASE=sedakep NODE_ENV=development bun run migrate:status

# Gate kode hijau
NODE_ENV=development bunx tsc --noEmit -p tsconfig.json
NODE_ENV=development bun run typecheck:web
NODE_ENV=development bun test          # DB uji (sedakep_test), bukan sedakep
NODE_ENV=development bun run web:build
bun run mysql:verify
bun run storage:verify
```

## Urutan cutover

1. **Legacy read-only.** Cabut hak tulis aplikasi PHP lama (atau set DB legacy read-only).
   Catat waktu cut-off dan konfirmasi tidak ada penulisan baru.
2. **Final catch-up data & file.** Jalankan migrasi terakhir:
   `bun run migrate:legacy` lalu `bun run migrate:documents --resume` (dan `--final-scan`).
3. **Rebuild seluruh projection** kuota dari histori: `bun run quota:rebuild`.
4. **Laporan perbandingan** jumlah & saldo: `bun run report:go-live`
   → `docs/go-live-report.csv` + `docs/go-live-report.html`, plus `bun run quota:reconcile --year <tahun>`.
5. **Review discrepancy.** Setiap selisih harus punya alasan tertulis di laporan. Selisih
   yang diketahui:
   - Pelaporan InnoDB `TABLE_ROWS` tidak akurat → selalu pakai `COUNT(*)`.
   - Approval legacy duplikat/orphan → dikarantina & dicatat saat migrasi.
6. **Aktifkan write path TypeScript.** Alihkan trafik tulis ke aplikasi Hono (web baru).
7. **Pantau** audit (`audit_logs`), error API, dan object MinIO hilang.
8. **Pertahankan fallback legacy** (filesystem/MinIO → legacy) selama masa observasi.
9. **Retire legacy** setelah sign-off; arsipkan DB & berkas legacy.

## Rollback

- Kembalikan trafik tulis ke aplikasi PHP legacy (batalkan langkah 6).
- Schema target tidak perlu dibuang; `sedakep` tetap ada untuk observasi.
- Pulihkan berkas dari objek MinIO (tidak ada penghapusan selama migrasi).
- Jika data target rusak: restore dari backup (di bawah) lalu ulangi dari langkah 2.

## Backup & restore (operasional)

```bash
# Dump database aplikasi (terkontrol; tidak membuka endpoint restore ke user)
bun run backup                 # -> backups/db-<stamp>.sql

# Objek MinIO: mirror dengan versioning/retention (bukan salin manual)
mc alias set sedakep http://127.0.0.1:9000 <access> <secret>
mc mirror --overwrite sedakep/sedakep-documents backups/minio/
```

- Restore database: `mysql -h127.0.0.1 -uroot sedakep < backups/db-<stamp>.sql`.
- Restore objek: `mc mirror backups/minio/ sedakep/sedakep-documents`.
- **Jangan** menjalankan restore di lingkungan yang sedang melayani user tanpa persetujuan.

## Scheduler rollover kuota tahunan

Rollover projection dijalankan proses terpisah (bukan di dalam API) supaya tidak dobel bila
API di-scale. Meniru `cron_reset_cuti.php` legacy; idempoten lewat penanda
`settings` `scheduler.rollover.{tahun}` dan tercatat di `audit_logs`.

```bash
# Sekali jalan (untuk cron/systemd timer), lalu keluar
NODE_ENV=production bun run scheduler --once
# Uji tanpa menulis apa pun
NODE_ENV=production bun run scheduler --once --dry-run
# Loop internal tiap SCHEDULER_INTERVAL_MINUTES
NODE_ENV=production bun run scheduler
```

Environment terkait: `SCHEDULER_TZ` (default `Asia/Jakarta`), `SCHEDULER_ROLLOVER_MONTH`
(default `1`), `SCHEDULER_ROLLOVER_DAY` (default `1`), `SCHEDULER_INTERVAL_MINUTES`
(default `60`).

Contoh cron (tiap jam; job hanya jalan pada tanggal jatuh tempo):

```cron
0 * * * * cd /srv/sedakep && NODE_ENV=production /usr/local/bin/bun run scheduler --once >> logs/scheduler.log 2>&1
```

Status dan penanda terakhir terlihat di halaman **Pengaturan** (`/admin/settings`).

## Verifikasi pasca-cutover

- `GET /health` → 200.
- Login demo (`admin.sedakep`) → buat 1 permohonan uji → reserved naik → approval final →
  reserved turun (lihat `tests/leave-api.test.ts` sebagai acuan alur).
- Cetak PDF & pindai QR → halaman verifikasi (`GET /verify/{code}`) menampilkan ringkasan.
- `bun run report:go-live` tidak lagi menampilkan selisih tak terjelaskan.
