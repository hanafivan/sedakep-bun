# codebase-hono

Boilerplate backend lean berbasis **Bun + Hono + SQLite**, dengan pemisahan
`command` (tulis) dan `query` (baca) yang eksplisit.

## Kebutuhan

- [Bun](https://bun.sh) v1.1 atau lebih baru

Cek versi:

```sh
bun --version
```

## Instalasi

```sh
bun install
```

## Konfigurasi

Salin env contoh, lalu sesuaikan bila perlu:

```sh
cp .env.example .env
```

Isi `.env`:

```env
PORT=3000
DB_PATH=data/app.sqlite

JWT_SECRET=dev-secret-ganti-di-produksi

BASIC_AUTH_USERNAME=***
BASIC_AUTH_PASSWORD=***
BASIC_AUTH_SALT=dev-salt-ganti-di-produksi
BASIC_AUTH_ITERATIONS=100000
# BASIC_AUTH_PASSWORD_HASH=<isi dengan output dari: bun run hash:basic-auth ***>
```

Semua `process.env` hanya dibaca di `api/config/index.ts` dan divalidasi
memakai zod saat boot. Modul lain wajib `import { config } from '../config'`.
Kalau env tidak valid, server langsung gagal start dengan pesan yang jelas.

Catatan:

- `DB_PATH=:memory:` dipakai otomatis saat test, jadi test tidak menyentuh file DB lokal.
- Folder `data/` dibuat otomatis saat pertama kali dijalankan.
- Di `NODE_ENV=production`, `BASIC_AUTH_PASSWORD_HASH` wajib ada dan
  `BASIC_AUTH_SALT` tidak boleh masih default.

## Menjalankan Server

Mode development (auto restart saat file berubah):

```sh
bun run dev
```

Mode biasa:

```sh
bun run start
```

Atau langsung tanpa script:

```sh
bun run api/index.ts
```

Server default di `http://localhost:3000`. Override port dengan env:

```sh
PORT=4000 bun run dev
```

## Test

Semua test:

```sh
bun test
```

File test tertentu:

```sh
bun test tests/app.test.ts
```

Filter berdasarkan nama test:

```sh
bun test -t "register"
```

Mode watch:

```sh
bun test --watch
```

## Typecheck

```sh
bun run typecheck
```

Setara dengan `bunx tsc --noEmit`.

## Frontend dan Swagger

### Backend (Hono)

Hono hanya melayani API dan dokumentasi:

```text
GET /health          health check
GET /openapi.json    OpenAPI 3.0 spec (dari zod schema)
GET /docs            Swagger UI
```

Metadata OpenAPI dipisah di `api/docs/openapi.ts`, bukan ditulis di `app.ts`,
supaya `app.ts` hanya merangkai route.

### Frontend (React + Vite)

Frontend ada di `web/`, terpisah dari backend, dan memanggil API lewat proxy Vite.

```text
web/api/
├── main.tsx              # bootstrap React + router
├── App.tsx               # layout card + <Outlet />
├── api.ts                # wrapper fetch + token localStorage
├── styles.css
└── pages/
    ├── Home.tsx
    ├── Login.tsx
    ├── Register.tsx
    └── Dashboard.tsx
```

Menjalankan backend dan frontend sekaligus (dua terminal):

```sh
# terminal 1 — backend di :3000
bun run dev

# terminal 2 — frontend di :5173
bun run web
```

Atau satu perintah:

```sh
bun run dev:all
```

Buka `http://localhost:5173`.

Vite mem-proxy `/api`, `/health`, `/openapi.json`, dan `/docs` ke
`http://localhost:3000` (ubah lewat env `API_TARGET`).

Build frontend untuk produksi:

```sh
bun run web:build     # hasil di web/dist
bun run web:preview   # cek hasil build
```

Typecheck frontend terpisah:

```sh
bun run typecheck:web
```

Alur di UI:

1. `/register` — daftar user baru.
2. `/login` — login, JWT disimpan di `localStorage`.
3. `/dashboard` — otomatis memanggil `GET /api/v1/users/me` dengan Bearer token.

## Endpoint

| Method | Path | Keterangan | Status sukses |
|---|---|---|---|
| GET | `/` | Info service | 200 |
| GET | `/health` | Health check | 200 |
| POST | `/api/v1/users/register` | Daftar user baru | 200 |
| POST | `/api/v1/users/login` | Login, balas JWT | 200 |
| GET | `/api/v1/users/me` | Data user dari JWT | 200 |
| GET | `/api/v1/admin/status` | Status admin (Basic Auth) | 200 |

### Health check

```sh
curl http://localhost:3000/health
```

```json
{ "success": true, "data": { "status": "ok" }, "message": "", "code": 200 }
```

### Register

```sh
curl -X POST http://localhost:3000/api/v1/users/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"hanafi","password":"password123"}'
```

```json
{
  "success": true,
  "data": null,
  "message": "User berhasil didaftarkan",
  "code": 200
}
```

Register tidak mengembalikan data apa pun.

### Login

```sh
curl -X POST http://localhost:3000/api/v1/users/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"hanafi","password":"password123"}'
```

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6dda6fde-5d6e-4239-99c9-e16141f95b9d",
      "username": "hanafi",
      "createdAt": "2026-10-07 09:40:00"
    }
  },
  "message": "Login berhasil",
  "code": 200
}
```

### Bentuk error

Semua error memakai bentuk yang sama:

```json
{
  "success": false,
  "data": null,
  "message": "Validasi gagal",
  "code": 422,
  "details": { "username": ["Username minimal 3 karakter"] }
}
```

| Kode | Kapan muncul |
|---|---|
| 401 | Password salah, token JWT tidak valid, atau Basic Auth salah |
| 404 | Endpoint tidak ditemukan |
| 409 | Username sudah dipakai |
| 422 | Payload tidak lolos validasi zod |
| 500 | Error tak terduga |

## Middleware Auth

Ada dua middleware di `api/middleware/`.

**1. `basicAuth.ts`** — untuk endpoint internal/admin.

Username dibaca dari `BASIC_AUTH_USERNAME`. Password diverifikasi sebagai
hash PBKDF2-SHA-256 dengan salt dari `BASIC_AUTH_SALT` dan jumlah iterasi dari
`BASIC_AUTH_ITERATIONS`. Salt tidak disimpan terpisah di hash; config menyimpan
salt dan hash sebagai dua nilai environment.

Untuk development, `BASIC_AUTH_PASSWORD` boleh dipakai dan hash diturunkan
saat aplikasi pertama kali membutuhkan Basic Auth. Untuk production, buat hash
sekali lalu simpan `BASIC_AUTH_PASSWORD_HASH`:

```sh
BASIC_AUTH_SALT='salt-produksi-yang-panjang-dan-random' \
BASIC_AUTH_ITERATIONS=100000 \
bun run hash:basic-auth 'password-admin'
```

Masukkan output command tadi ke `.env`:

```env
NODE_ENV=production
BASIC_AUTH_USERNAME=admin
BASIC_AUTH_SALT=salt-produksi-yang-panjang-dan-random
BASIC_AUTH_ITERATIONS=100000
BASIC_AUTH_PASSWORD_HASH=<output-hash-tadi>
```

Jangan commit `BASIC_AUTH_PASSWORD`, `BASIC_AUTH_PASSWORD_HASH`, atau salt
production ke repository.

```sh
curl -u admin:admin http://localhost:3000/api/v1/admin/status
```

```json
{
  "success": true,
  "data": { "status": "operational", "environment": "development" },
  "message": "",
  "code": 200
}
```

Tanpa kredensial:

```sh
curl -i http://localhost:3000/api/v1/admin/status
```

```text
HTTP/1.1 401 Unauthorized
{"success":false,"data":null,"message":"Basic authentication required","code":401}
```

**2. `bearerAuth.ts`** — untuk endpoint yang butuh user login.

Memverifikasi JWT dengan `JWT_SECRET`, lalu menaruh user ke context (`c.get('user')`).

Ambil token dulu:

```sh
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/users/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"hanafi","password":"password123"}' \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
```

Pakai token:

```sh
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "success": true,
  "data": {
    "id": "6dda6fde-5d6e-4239-99c9-e16141f95b9d",
    "username": "hanafi",
    "createdAt": "2026-10-07 09:40:00"
  },
  "message": "Data user berhasil diambil",
  "code": 200
}
```

Tanpa token atau token palsu → `401`.

Dipakai di route:

```ts
// modul user
userRoutes.get('/me', bearerAuth, (c) => {
  const user = service().getById(c.get('user').id);
  return successResponse(c, user, 'Data user berhasil diambil');
});

// modul admin (berlaku untuk semua route di bawah prefix)
adminRoutes.use('*', basicAuth);
```

Contoh memicu 409 (username duplikat):

```sh
curl -X POST http://localhost:3000/api/v1/users/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"hanafi","password":"password123"}'
```

## Inspeksi Database

Lihat isi tabel `users` dengan SQLite CLI:

```sh
sqlite3 data/app.sqlite 'SELECT id, username, created_at FROM users;'
```

Contoh output:

```text
6dda6fde-5d6e-4239-99c9-e16141f95b9d|hanafi|2026-10-07 09:40:00
```

Query cepat lewat Bun:

```sh
bun -e '
const { Database } = require("bun:sqlite");
const db = new Database("data/app.sqlite");
console.table(db.query("SELECT id, username FROM users").all());
'
```

Contoh output:

```text
┌─────────┬──────────────────────────────────────┬─────────┐
│ (idx)   │ id                                   │ username│
├─────────┼──────────────────────────────────────┼─────────┤
│ 0       │ 6dda6fde-5d6e-4239-99c9-e16141f95b9d │ hanafi  │
└─────────┴──────────────────────────────────────┴─────────┘
```

Reset database (hapus semua data):

```sh
rm -f data/app.sqlite data/app.sqlite-wal data/app.sqlite-shm
```

Tabel dibuat ulang otomatis saat server dijalankan lagi.

## Struktur

```text
api/
├── app.ts                         # Hono app + middleware + error handler
├── index.ts                       # Bun HTTP server
├── db.ts                          # SQLite + migrasi sederhana
├── shared/
│   ├── errors.ts                  # AppError + helper error
│   ├── logger.ts
│   ├── response.ts                # wrapper success/fail
│   └── validator.ts               # zod validator (error 422)
├── docs/
│   └── openapi.ts                 # metadata OpenAPI + mount /openapi.json
├── middleware/
│   ├── basicAuth.ts               # Basic Auth (admin/internal)
│   └── bearerAuth.ts              # JWT bearer (user login)
├── modules/user/
│   ├── user.routes.ts             # HTTP boundary
│   ├── command/index.ts           # semua SQL tulis
│   ├── query/index.ts             # semua SQL baca
│   ├── service/index.ts           # logika bisnis + orkestrasi (tanpa SQL)
│   └── schema/
│       ├── index.ts               # zod schema + tipe input/response
│       └── types.ts               # tipe row database
└── modules/admin/
    └── admin.routes.ts            # route admin, diproteksi basicAuth

tests/
├── app.test.ts                    # integration test lewat app.request()
├── auth.test.ts                   # test basicAuth & bearerAuth
└── architecture.test.ts           # guard: service tidak boleh berisi SQL
```

Alur request:

```text
route → zod validation → service → command/query → SQLite
```

Aturan modul:

- SQL hanya boleh ada di `command/` dan `query/`.
- `service/` berisi logika bisnis dan orkestrasi, tanpa SQL.
- `schema/` menampung validasi request dan tipe data.
