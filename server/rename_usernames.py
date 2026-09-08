# Rename username lama di DB sesuai aturan opsi 1: kata pertama + terakhir, maks 18, buang gelar,
# fallback 3 kata kalau terlalu pendek. Username guru.* (seed jadwal) & admin tidak disentuh.
import re, subprocess

STRIP = r",?\s*(M\.Pd\.?|M\.Pd\.I\.?|M\.Si\.?|S\.Pd\.?|S\.Pd\.I\.?|S\.Kom\.?|S\.Ag\.?|M\.M\.?|M\.Hum\.?|M\.Ed\.?|Dr\.?|Dra\.?|Drs\.?|Hj\.?|Lc\.?)\b"

def gen(name):
    if not name:
        return None
    clean = re.sub(STRIP, ' ', name, flags=re.I)
    clean = re.sub(r'\.', ' ', clean)
    clean = re.sub(r'[^a-zA-Z\s]', ' ', clean).lower().strip()
    clean = re.sub(r'\s+', ' ', clean)
    if not clean:
        return None
    words = clean.split()
    if len(words) == 1:
        result = words[0]
    else:
        result = words[0] + '.' + words[-1]
        if len(result.replace('.', '')) < 6 and len(words) >= 3:
            result = '.'.join(words[:3])
    return result[:18].rstrip('.')

def psql(q):
    r = subprocess.run(['psql', 'postgres://postgres:postgres123@localhost:5432/absensi_mtsn1',
                        '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    return [l.split('|') for l in r.stdout.strip().split('\n') if l]

rows = psql("SELECT id, username, full_name FROM users ORDER BY id")
taken = {r[1] for r in rows}
renames = []
for id_, uname, fname in rows:
    if not fname:
        continue
    g = gen(fname)
    if not g or g == uname:
        continue
    if uname.startswith('guru.') or uname in ('tmpadmin', 'admin'):
        continue
    # username lama valid (<=18, cuma huruf+titik, bukan potongan janggal) -> biarkan
    if len(uname) <= 18 and re.fullmatch(r'[a-z]+(\.[a-z]+)*', uname):
        continue
    final, i = g, 2
    while final in taken and final != uname:
        final = f"{g[:16]}{i}"
        i += 1
    if final == uname:
        continue
    renames.append((id_, uname, final, fname))
    taken.discard(uname)
    taken.add(final)

print('=== Rencana rename ===')
for id_, old, new, fname in renames:
    print(f'{old:26s} -> {new:20s} ({fname})')

if renames:
    for id_, old, new, fname in renames:
        psql(f"UPDATE users SET username='{new}' WHERE id={id_}")
    print(f'\n{len(renames)} username diupdate')
else:
    print('tidak ada yang perlu diubah')
