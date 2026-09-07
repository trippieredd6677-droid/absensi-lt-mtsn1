# Sistem Absensi LT — MTsN 1 Kebumen

> Penjelasan singkat & jelas cara kerja website, dari halaman Login → halaman Admin → halaman Guru. Disertai screenshot.

---

## 1. Gambaran Sistem



**Absensi LT** adalah aplikasi absensi berbasis web untuk sekolah (MTsN 1 Kebumen). Tujuannya: mencatat kehadiran guru setiap hari secara digital, dengan foto sebagai bukti kegiatan, dan memberi admin kendali penuh untuk mengelola data.

- **Teknologi:** React (Vite) + Express (Node.js) + PostgreSQL
- **Satu aplikasi, dua peran (role):**
  - **Admin** — mengelola seluruh sistem (user, absensi, kelas/shift, pantau, audit).
  - **Guru** — mengisi absensi harian + melihat histori miliknya.

---

## 2. Halaman Login

![Login](screenshots/00-login.png)

Setiap orang (Admin & Guru) masuk lewat **satu halaman login** dengan **username + password**.

- Login membedakan peran otomatis → diarahkan ke **Dashboard Admin** (jika Admin) atau **Dashboard Guru** (jika Guru).
- Ada tombol **lihat/sembunyikan password** & tautan **Lupa Password** (reset via kode OTP email).
- Persyaratan alur keamanan: password disimpan ter-hash (bcrypt), percobaan login salah dibatasi (anti brute-force).

**Alur login:**

```
Buka website → Login (username+password) → Cek peran:
   ├─ Admin  → Dashboard Admin (kelola semuanya)
   └─ Guru   → Dashboard Guru (isi absensi harian)
```

---

## 3. Sisi Admin

### 3.1 Dashboard Admin (Monitoring)

![Admin Dashboard](screenshots/10-admin-dashboard.png)

Ringkasan aktivitas & kehadiran hari ini:

- **4 kartu statistik:** Total Pengguna, Total Guru, Absensi Hari Ini, Hadir Hari Ini.
- **Status Hari Ini:** rincian Hadir / Sakit / Izin / Alpa.
- **Tren 7 Hari Terakhir:** grafik batang jumlah absensi per hari.
- **Guru Belum Input:** daftar guru yang belum mengisi absensi hari ini (untuk ditindaklanjui).

### 3.2 Manajemen Guru

![Admin Guru](screenshots/11-admin-guru.png)

Mengelola akun guru:

- **Tambah / Edit** guru (nama, username, email, NIP, dll).
- **Atur peran:** Admin / Guru.
- **Aktif / Nonaktifkan** akun (ikon Prohibit = nonaktif, Trash = hapus permanen).
- **Atur Ulang Password** (reset ke password baru).
- **Hapus Permanen** akun.
- **Filter** peran & status, pencarian, dan pagination.

### 3.3 Data Absensi

![Admin Absensi](screenshots/12-admin-absensi.png)

Melihat seluruh data absensi guru:

- **Filter** per bulan, tahun, dan **per guru** (rekap per guru).
- **Ekspor** rekap ke Excel (XLSX).
- Edit / hapus data absensi bila perlu.

### 3.4 Kelola Kelas & Shift

![Admin Kelas & Shift](screenshots/13-admin-kelas-shift.png)

**Kelas dan Shift bersifat dinamis** — dikelola admin (bukan hardcode):

- **Tab Kelas:** tambah/edit/hapus kelas (contoh: 7A–9J).
- **Tab Shift:** tambah/edit/hapus shift (contoh: siang, malam).
- Daftar ini otomatis dipakai di form absensi guru.

### 3.5 Audit Log

![Admin Audit](screenshots/14-admin-audit.png)

Jejak aktivitas sistem (siapa & apa yang dilakukan):

- Waktu, pengguna, aksi (Login/Tambah/Ubah/Hapus/Reset Password), objek yang berubah, dan IP.
- Berguna untuk **akuntabilitas & keamanan**.

### 3.6 Profil Admin

![Admin Profil](screenshots/15-admin-profil.png)

Admin juga punya halaman profil: **ganti password sendiri**, ubah data diri, dan **upload foto profil** (dengan fitur crop).

---

## 4. Sisi Guru

### 4.1 Dashboard Guru

![Guru Dashboard](screenshots/20-guru-dashboard.png)

Ringkasan kehadiran **milik guru tersebut**: kartu statistik pribadi (total hadir/sakit/izin/alpa, absensi hari ini, dll) serta rekap singkat. Menu Guru lebih ringkas: **Dashboard, Absensi, Histori, Profil**.

### 4.2 Absensi (input harian)

![Guru Absensi](screenshots/21-guru-absensi.png)

Form untuk mencatat kehadiran hari ini:

- **Tanggal** — otomatis & **terkunci hari ini** (mencegah manipulasi tanggal).
- **Shift** & **Kelas** — diambil dari data dinamis yang dikelola admin.
- **Status** — Hadir / Sakit / Izin / Alpa.
- **Unggah Foto Kegiatan** — bukti kegiatan (JPG/PNG/GIF, maks 5MB).
- **Catatan** — keterangan tambahan.

### 4.3 Histori

![Guru Histori](screenshots/22-guru-histori.png)

Riwayat absensi **milik guru tsb** per bulan: tanggal, shift, kelas, status, foto kegiatan. Bisa difilter & dilihat detailnya.

### 4.4 Profil Guru

![Guru Profil](screenshots/23-guru-profil.png)

Guru bisa mengubah data diri & foto profil, serta **ganti password** sendiri.

---

## 5. Perbandingan Peran

| Fitur | Admin | Guru |
|---|---|---|
| Dashboard monitoring (seluruh guru) | ✅ | — |
| Dashboard pribadi | ✅ | ✅ |
| Input absensi harian | — | ✅ |
| Histori pribadi | ✅ | ✅ |
| Kelola semua guru (CRUD, role, reset) | ✅ | — |
| Kelola kelas & shift | ✅ | — |
| Lihat & kelola data absensi semua guru | ✅ | — |
| Audit log | ✅ | — |
| Profil & ganti password sendiri | ✅ | ✅ |

---

## 6. Perilaku Penting Sistem

- **Anti-manipulasi tanggal:** tanggal absensi terkunci ke *hari ini* berdasarkan **waktu server**, bukan perangkat pengguna.
- **Kelas & shift dinamis:** diambil dari basis data (dikelola admin), bukan nilai hardcoded.
- **Keamanan:** password ter-hash (bcrypt), login dibatasi (rate-limit di produksi), peran diverifikasi ulang dari database, query terparameterisasi (anti SQL injection), upload dibatasi tipe/ukuran, `.env` (rahasia) tidak pernah di-commit.
- **Audit log** merekam aktivitas penting untuk transparansi.

---

## 7. Data & Cara Menambahkannya (pakai apa?)

Semua data disimpan di **PostgreSQL** (6 tabel: `users`, `absensi`, `kelas`, `shift`, `audit_log`, `password_resets`).

**Cara menambah data:**

| Data | Siapa | Lewat apa |
|---|---|---|
| **Guru** (akun) | Admin | **Manajemen Guru → Tambah Guru** (form UI) |
| **Absensi** (kehadiran harian) | Guru | Halaman **Absensi** (form UI, tiap hari) |
| **Kelas** | Admin | **Kelola Kelas & Shift → tab Kelas** |
| **Shift** | Admin | **Kelola Kelas & Shift → tab Shift** |
| **Akun admin awal** | Script | `node server/setup-db.js` (bikin tabel + admin dari env `ADMIN_PASSWORD`) |
| **Data demo** (guru + ±30 hari absen) | Script | `node server/seed-demo.js` (aman dijalankan ulang) |

- **Expor** data → lewat UI (Excel XLSX).
- ⚠️ **Belum ada import massal (bulk upload)** — data masuk per-akun lewat form, atau via seed script.

---

## 8. Keamanan (bagaimana sistem mengamankan data?)

| Lapis | Mekanisme |
|---|---|
| **Password** | Di-hash (bcrypt) — tidak pernah disimpan polos. |
| **Login / OTP** | Login username+password; lupa password via kode OTP email. |
| **Autorisasi** | JWT + middleware peran (`isAdmin`/`isGuruOrAdmin`) yang **re-verifikasi role & status dari DB** tiap request → admin di-demote / akun dinonaktifkan langsung berhenti bisa akses. |
| **Rate-limit** | Login/forgot-password/OTP dibatasi percobaan gagal (anti brute-force) — aktif di produksi. |
| **SQL Injection** | Semua query **terparameterisasi** (placeholder `$1, $2`) — tidak ada string SQL yang disusun dari input pengguna. |
| **Validasi input** | `express-validator` di setiap endpoint; tanggal absensi divalidasi = hari ini (berdasar **waktu server**). |
| **Upload** | Whitelist tipe (JPG/PNG/GIF/WebP/PDF) + batas ukuran 5MB; server kirim `nosniff` + cache privat. |
| **CORS** | Di produksi hanya origin frontend (`CLIENT_URL`), tidak terbuka ke semua. |
| **Security headers** | CSP, X-Frame-Options (anti clickjacking), nosniff, HSTS. |
| **Rahasia** | `.env` di-gitignore; `JWT_SECRET`, `DB_PASSWORD`, `ADMIN_PASSWORD`, SMTP hanya di server. Default admin `admin123` **dihapus** (sekarang env-driven). |
| **Audit** | **Audit Log** merekam siapa melakukan apa (login, CRUD, reset password, dll.) + IP. |
| **Anti-manipulasi** | Tanggal absensi dikunci ke hari ini (server clock, bukan perangkat); kelas & shift bukan hardcode. |

---

## 9. Cara Menggunakan Web

### A. Masuk
1. Buka URL aplikasi → halaman **Login**.
2. Isi **username + password** → **Masuk**. Aplikasi otomatis mengarahkan ke Dashboard sesuai peran (Admin/Guru).
3. *Lupa password?* klik **Lupa Password** → masukkan email → isi **kode OTP** dari email → buat password baru.

### B. Sebagai Admin
1. **Dashboard** → pantau statistik, status hari ini, dan **guru yang belum input**.
2. **Manajemen Guru** → Tambah / Edit guru, atur peran (Admin/Guru), Aktif/Nonaktifkan, **Atur Ulang Password**, Hapus.
3. **Data Absensi** → filter per bulan/tahun/guru, lihat rekap, **ekspor Excel**, edit/hapus bila perlu.
4. **Kelola Kelas & Shift** → tambah/edit/hapus kelas & shift (tab Kelas / tab Shift).
5. **Audit Log** → lihat riwayat aktivitas.
6. **Profil** → ganti password sendiri, edit data, upload foto (ada fitur crop).

### C. Sebagai Guru
1. **Dashboard** → lihat ringkasan kehadiran pribadi.
2. **Absensi** → isi kehadiran hari ini: *Tanggal (otomatis & terkunci)* → pilih **Shift** & **Kelas** → pilih **Status** (Hadir/Sakit/Izin/Alpa) → upload **foto kegiatan** (opsional) → isi **Catatan** → **Simpan**.
3. **Histori** → lihat riwayat absensi per bulan, filter, lihat detail + foto.
4. **Profil** → ubah data diri, upload foto profil, ganti password.

> **Tips penting:** Tanggal absensi hanya berlaku **hari itu** (tidak bisa mundur/maju). Foto kegiatan maks **5MB** dengan format JPG/PNG/GIF/WebP.

---

*Dokumen dibuat dari aplikasi versi lokal (dev). Screenshot: `docs/screenshots/`.*
