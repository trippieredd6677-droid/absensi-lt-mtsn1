# Index — Absensi LT

Lokasi: /Users/anm/Desktop/absensi-lt-mtsn1 | Status: jalan (58 users, 0 histori, 237 jadwal)

MULAI:
1 DESIGN.md        — arah ledger E1/R2/M1, palette sage, motif border
2 README.md        — setup 3 langkah, env, struktur, confirm flow, export
3 QUICK_START.txt  — 5 menit jalan (brew, setup-db, dev)
4 PROJECT_STRUCTURE.md — pohon, security, schema 7 tabel
5 DEPLOYMENT.md    — VPS/Nginx/PM2/SSL/backup

JALAN:
  npm run dev  (5001)  +  cd client && npm run dev  (3001) → http://localhost:3001  sekar/TempPass123!

DATA:
  Admin: sekar, admin (2) | Guru: 56 real (mansyur.nurudin dst) | absensi 0 (sudah dikosongkan 207) | uploads: foto profil _profil_<ts>.jpg sesuai nama, border hijau dihapus jadi netral E2E2DE

FITUR KUNCI:
  ConfirmModal loading+isDirty (Profil, Jadwal by-guru, AdminUsers bulk, AdminAbsensi bulk Promise.allSettled) | Export XLSX warna ledger 3A7A55 (owner hanya nama)

UPDATE 2026-09-09: histori dikosongkan, dummy 13 dihapus, foto profil rapih, export selaras web, kontras faint PASS 4.66
