#!/bin/sh
set -e

cd /app

echo "=================================================="
echo " Starting SEDAKEP Application (Hono + React + Bun)"
echo "=================================================="

# Jalankan migrasi database otomatis saat container start
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[init] Menjalankan migrasi database..."
  bun run migrate || echo "[warn] Migrasi gagal atau database belum siap, melanjutkan startup..."
fi

# Jalankan background scheduler jika diaktifkan
if [ "${RUN_SCHEDULER:-false}" = "true" ]; then
  echo "[init] Menjalankan background scheduler..."
  bun run scheduler &
fi

# Jalankan Bun API sebagai PID 1 (menerima sinyal OS langsung untuk graceful shutdown)
echo "[init] Menjalankan Bun server pada port ${PORT:-3000}..."
exec bun run api/index.ts
