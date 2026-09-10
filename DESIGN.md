# DESIGN.md — Absensi LT MTsN1 Kebumen

Reading as: operational ledger for guru & admin, in a warm paper + ink-green style, dial ENERGY 1 / RHYTHM 2 / MOTION 1.

## Identity
Buku besar sekolah — bukan SaaS generik. Satu motif ledger yang diulang: garis kertas hangat, cap titik pada status, kartu flat border-only.

## Personality
Tenang, rapih, tepercaya. Seperti catatan wali kelas: tidak berteriak, tidak gelap-tech, tidak pastel AI.

## Palette — Forest Linen light + natural gray dark
- Light: `--bg #f7f7f4` (linen hangat), `--surface #ffffff`, `--surface-2 #f1f1ec`
- Ink: `--sidebar-bg #1e4d2d` (forest medium), `--text #1f2421`
- Aksen satu: `--accent #2f5d34` forest green
- Destructive brick: `#b03a2c` (badge alpa/error)
- Dark: background ramp abu netral kalem (`#0b0b0b → #3d3d3d`, teks `#f0f0f0`), aksen `#5da867` (hover `#4c8f56`, `--on-accent #ffffff`), status hadir/sakit/izin/alpa versi gelap selaras
- Status muted: hadir/izin/sakit/alpa dengan bg pucat — tidak neon
- Radius: `0.5rem` — `--radius 8px`, `sm 6px`, `lg 12px`
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
