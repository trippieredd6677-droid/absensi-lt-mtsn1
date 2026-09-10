# Struktur — Absensi LT (ledger)

## Pohon
```
absensi-lt-mtsn1/
├── server/index.js :5001 (CORS whitelist CLIENT_URL, security headers, trust proxy 1)
│   ├── db.js          pool pg, DATABASE_URL atau DB_*
│   ├── setup-db.js + seed-jadwal.js + migrations.js (7 tabel, 56 guru_map)
│   ├── middleware/auth.js (verifyToken, isAdmin, isGuruOrAdmin, auditLog, refresh)
│   ├── middleware/upload.js (Multer, filename slug(full_name)_profil_<ts>.jpg untuk foto, tanggal-shift_nama_kelas_<ts>.jpg untuk absensi)
│   └── routes/auth.js (/me, /me/photo, /password, /forgot+OTP) absensi.js (/ , /admin-create, /:id) admin.js jadwal.js kelas.js shift.js
├── client/vite.config.js :3001 proxy /api & /uploads → 5001
│   └── src/App.jsx (role guard) App.css (ledger tokens) api.js (axios + refresh)
│       └── pages/ Login Dashboard Absensi Histori Profil(admin/guru) + admin/AdminDashboard AdminUsers AdminAbsensi AdminKelas Jadwal
│           └── components/Layout.jsx ConfirmModal.jsx
├── uploads/  foto (gitignored)
├── DESIGN.md  .env.example  render.yaml  start.sh
```

## Security
Browser → Nginx(HTTPS) → Express(CORS+headers) → routes(validator+param query+audit) → Postgres(bcrypt10, pool) → uploads(random name+MIME check). JWT 2h + refresh rotation, revoke on password change, OTP 10m/5 attempts/30s cooldown.

## Schema (7 tabel)
users(id,username,email,password,full_name,nip,role,kelas,jabatan,no_hp,foto_profil,status,guru_map_kode) — 58 rows
absensi(id,user_id,tanggal,hari,shift,kelas,status,foto_kegiatan,catatan,ip_address,created_at) — 0 rows (dikosongkan)
audit_log, kelas, shift/jam_lt, jadwal, jadwal_source, password_resets
UNIQUE(user_id,tanggal,shift) — anti double absen

## Perintah
npm run dev (5001) | cd client && npm run dev (3001) | npm run build (dist) | npm start (prod single origin) | npm run setup-db | npm run sync-jadwal -- --apply
