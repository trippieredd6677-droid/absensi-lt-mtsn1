# DESIGN.md — Absensi LT MTsN1 Kebumen

Reading as: operational ledger for guru & admin, in a warm paper + ink-green style, dial ENERGY 1 / RHYTHM 2 / MOTION 1.

## Identity
Buku besar sekolah — bukan SaaS generik. Satu motif ledger yang diulang: garis kertas hangat, cap titik pada status, kartu flat border-only.

## Personality
Tenang, rapih, tepercaya. Seperti catatan wali kelas: tidak berteriak, tidak gelap-tech, tidak pastel AI.

## Palette
- Paper: `--bg #f5f5f3` (kertas hangat), `--surface #ffffff`, `--surface-2 #efefec`
- Ink: `--sidebar-bg #0e2e1d` (catatan hijau sekolah), `--text #1f2421`
- Aksen satu: `--accent #3a7a55` sage desaturated (dark `#6fae86`)
- Status muted: hadir/izin/sakit/alpa dengan bg pucat 12% (dark) — tidak neon
- Cap: max 2-3 core + 1 accent (R-29)

## Typography
Satu keluarga `Plus Jakarta Sans` Variable untuk teks & angka, `tabular-nums` pada jam/stat. Alasan: ledger butuh satu suara, tidak ada split mono. Uppercase hanya label `10-11px / 0.05-0.1em` untuk hierarki, bukan dekorasi.

## Motif & Levers
- Satu focal per layar: metrik aksi `Belum Input` yang paling butuh tindakan
- Whitespace sebagai struktur: `space 4/8/12/16/24/32/48/64`, beda level Antar seksi
- Aksen sengaja: hanya di focal & hover emerald, tidak di semua elemen
- Kartu flat border `1px #e2e2de`, shadow hanya hover elevation `0 1px 2px`

## Dials
- ENERGY 1 (calm, GOV.UK/Stripe quiet)
- RHYTHM 2 (balanced, satu break focal)
- MOTION 1 (hover & fade 0.22s only, respect `prefers-reduced-motion`)

## Rules
- Zero gradient, zero glass, zero glow
- Semua angka dari DB real, no fake stats
- Light & dark toggle wajib dua-duanya lulus kontras AA

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1
