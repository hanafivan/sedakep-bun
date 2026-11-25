# ==========================================
# Stage 1: Build Frontend (Vite + React)
# ==========================================
FROM oven/bun:1-alpine AS web-builder

WORKDIR /app

# Salin konfigurasi dependensi
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Salin source frontend dan tsconfig
COPY web ./web
COPY tsconfig.json ./

# Kompilasi frontend React SPA (hasil di web/dist)
RUN bun run web:build

# ==========================================
# Stage 2: Production Runtime (Pure Bun)
# ==========================================
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Salin dependensi dan pasang paket produksi saja
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile || bun install --production

# Salin kode sumber backend API, scripts, assets, dan konfigurasi
COPY api ./api
COPY scripts ./scripts
COPY assets ./assets
COPY tsconfig.json ./

# Salin hasil kompilasi frontend dari stage 1
COPY --from=web-builder /app/web/dist ./web/dist

# Salin startup script
COPY docker/start.sh ./docker/start.sh
RUN chmod +x ./docker/start.sh && mkdir -p storage

# Port aplikasi
EXPOSE 3000

# Healthcheck native via Bun (tanpa butuh curl / paket tambahan)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Jalankan startup script
CMD ["/app/docker/start.sh"]
