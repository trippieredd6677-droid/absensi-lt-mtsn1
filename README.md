# Absensi LT — MTsN 1 Kebumen

Sistem absensi guru ledger — panel guru & admin. Frontend React + Vite, backend Express, PostgreSQL.

## Tech Stack
- **Frontend:** React 18, Vite 5, React Router 6, Phosphor Icons, Axios, exceljs
- **Backend:** Node 18+, Express 4, PostgreSQL `pg`, JWT + refresh rotation, bcryptjs, Multer, Nodemailer (OTP)
- **DB:** PostgreSQL 15+ — 7 tabel: `users, absensi, audit_log, kelas, shift, jadwal, jadwal_source, password_resets`

## Design
`DESIGN.md` — ledger hangat: `bg #f5f5f3` kertas, `sidebar #0e2e1d` tinta, aksen sage `#3a7a55` satu saja. Zero gradient/glass/glow. Dial **E1/R2/M1** (calm/balanced/hover only).

## Prasyarat
Node 18+, PostgreSQL 15+, npm. DB harus running.

## 1. Setup Cepat
```bash
cp .env.example .env   # isi DB_PASSWORD, JWT_SECRET (32+ random), ADMIN_PASSWORD
npm install
cd client && npm install && cd ..
npm run setup-db       # buat DB absensi_mtsn1 + migrasi + seed 56 guru_map + jadwal (237)
npm run build          # build client ke dist
npm start              # → http://localhost:5001 (single origin)
# login: admin / TempPass123!  atau sekar / (ADMIN_PASSWORD di .env)
```

`bash start.sh` — cek Node/Postgres, buat .env default, install, setup-db otomatis.

## 2. Mode Dev (edit)
```bash
# Terminal 1 — backend auto-restart
npm run dev            # → http://localhost:5001
# Terminal 2 — frontend hot-reload + proxy /api & /uploads ke 5001
cd client && npm run dev  # → http://localhost:3001
```

## 3. Env (.env)
| Var | Isi |
|---|---|
| `PORT=5001`, `NODE_ENV`, `CLIENT_URL` | `http://localhost:3001` (dev) / `https://domain.or.id` (prod, CORS whitelist) |
| `DB_HOST/PORT/NAME/USER/PASSWORD` atau `DATABASE_URL` | Neon/Render |
| `JWT_SECRET` (≥32), `JWT_EXPIRE=2h` | `openssl rand -base64 32` |
| `ADMIN_USERNAME/ADMIN_PASSWORD` | dibuat `setup-db` hanya jika `ADMIN_PASSWORD` diisi |
| `GURU_DEFAULT_PASSWORD` | password awal 56 guru map |
| `UPLOAD_DIR`, `MAX_FILE_SIZE` | default `uploads`, `5242880` |
| `EMAIL_HOST/PORT/SECURE/USER/PASS/FROM`, `MAIL_LOGGING` | OTP; `MAIL_LOGGING=true` = tampil di console (dev) |

## 4. Script
`npm start` — prod single origin | `npm run dev` — nodemon | `npm run build` — vite build | `npm run setup-db` — migrasi | `npm run sync-jadwal -- --apply` — sync jadwal dari patokan

## 5. Struktur
```
absensi-lt-mtsn1/
├── server/  index.js(:5001) db.js setup-db.js seed-jadwal.js
│   ├── middleware/auth.js upload.js
│   └── routes/auth.js absensi.js admin.js jadwal.js kelas.js shift.js
├── client/  vite.config.js(:3001 proxy) src/App.jsx api.js
│   └── src/pages/ Login, Dashboard, Absensi, Histori, Profil + admin/*
├── uploads/  foto profil/kegiatan (gitignored) — nama file: budi-santoso_profil_<stamp>.jpg
├── DESIGN.md  .env.example  render.yaml  start.sh  auto-setup.sh
```

## 6. Alur Konfirmasi (anti double-submit)
- Semua mutasi pakai `ConfirmModal` + `loading` lock + `isDirty`/`hasUnsavedChanges` guard. Contoh: `Profil Simpan` cek `isDirty` → confirm → `PUT /auth/me`; `Jadwal Simpan` → confirm `N jadwal akan diganti` → `PUT /by-guru`; `AdminUsers` create/edit/reset/link → confirm + `saving`.
- Upload foto profil: crop modal 1:1 → `PUT /auth/me/photo` → nama file `slug(full_name)_profil_<ts>.jpg`

## 7. Export
`AdminAbsensi` & `Histori` → `exportXlsx` (exceljs) warna ledger `3A7A55`, `E9F1EB` etc selaras web — header hijau sage, status muted, border `E2E2DE`, owner hanya nama.

## 8. Keamanan
`.env` & `uploads/` tidak di-commit. Audit `audit_log`, bcrypt 10, parameterized queries, rate-limit, security headers, CORS whitelist, file whitelist JPG/PNG/WebP/GIF/PDF 8MB, OTP 6-digit hash + 10m exp + 30s cooldown.
