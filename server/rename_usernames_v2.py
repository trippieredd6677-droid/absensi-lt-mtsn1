#!/usr/bin/env python3
"""
Rename ulang username guru ke aturan final 2 kata (sinkron dgn server/username-generator.js).
- Aturan sama persis dgn generator JS: buang gelar, kata pertama+terakhir, inisial (<=2 huruf)
  digabung tetangga, maks 18.
- Bukan guru / guru.% / admin: tidak disentuh.
- Email ikut disinkronkan ke <username>@mtsn1kebumen.id utk akun guru_map.
- Duplikat dihindari dgn suffix angka.
"""
import re, subprocess, sys

STRIP = r",?\s*(M\.Pd\.?|M\.Pd\.I\.?|M\.Si\.?|S\.Pd\.?|S\.Pd\.I\.?|S\.Kom\.?|S\.Ag\.?|M\.M\.?|M\.Hum\.?|M\.Ed\.?|Dr\.?|Dra\.?|Drs\.?|Hj\.?|Lc\.?)\b"
DB = "postgres://postgres:postgres123@localhost:5432/absensi_mtsn1"

def gen(name):
    clean = re.sub(STRIP, ' ', name, flags=re.I)
    clean = re.sub(r'\.', ' ', clean)
    clean = re.sub(r'[^a-zA-Z\s]', ' ', clean).lower().strip()
    clean = re.sub(r'\s+', ' ', clean)
    words = clean.split()
    if not words:
        return None
    if len(words) == 1:
        return words[0][:18]
    first = words[0]
    if len(first) <= 2 and len(words) >= 3:
        first = words[0] + words[1]
    last = words[-1]
    if len(last) <= 2 and len(words) >= 3:
        last = words[-2]
    return (first + '.' + last)[:18].rstrip('.')

def psql(q):
    r = subprocess.run(['psql', DB, '-t', '-A', '-F', '|', '-c', q],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()

rows = [l.split('|') for l in psql("SELECT id, username, full_name, COALESCE(guru_map_kode,'') FROM users WHERE role='guru' AND status='active' ORDER BY id").splitlines() if l]
taken = {r[1] for r in rows}
renames = []
for id_, uname, fname, kode in rows:
    if not fname:
        continue
    # guru.% = akun seed tes lama, biarkan; admin dikerucutkan di role
    if uname.startswith('guru.'):
        continue
    g = gen(fname)
    if not g or g == uname:
        continue
    # username lama sudah valid & tak lebih panjang dari aturan baru (sudah diedit manual) -> hormati
    if len(uname) <= len(g) and re.fullmatch(r'[a-z]+(\.[a-z]+)*', uname):
        continue
    final, i = g, 2
    while final in taken and final != uname:
        final = f"{g[:16]}{i}"
        i += 1
    if final == uname:
        continue
    renames.append((id_, uname, final, fname, bool(kode)))
    taken.discard(uname)
    taken.add(final)

print('=== Rencana rename ===')
for id_, old, new, fname, has_kode in renames:
    print(f'{old:26s} -> {new:22s} ({fname})')

if '--apply' in sys.argv:
    for id_, old, new, fname, has_kode in renames:
        psql(f"UPDATE users SET username='{new}', email='{new}@mtsn1kebumen.id' WHERE id={id_} AND guru_map_kode IS NOT NULL"
             if has_kode else f"UPDATE users SET username='{new}' WHERE id={id_}")
    print(f'\n{len(renames)} username diupdate (email guru_map ikut disinkron)')
else:
    print(f'\nDRY RUN — {len(renames)} perubahan. Jalankan lagi dgn --apply utk eksekusi.')
