import psycopg2, re
STRIP = r",?\s*(M\.Pd\.?|M\.Pd\.I\.?|M\.Si\.?|S\.Pd\.?|S\.Pd\.I\.?|S\.Kom\.?|S\.Ag\.?|M\.M\.?|M\.Hum\.?|M\.Ed\.?|Dr\.?|Dra\.?|Drs\.?|Hj\.?|Lc\.?)\b"
def gen(name):
    clean = re.sub(STRIP, ' ', name, flags=re.I)
    clean = re.sub(r'\.', ' ', clean)
    clean = re.sub(r'[^a-zA-Z\s]', ' ', clean).lower().strip()
    clean = re.sub(r'\s+', ' ', clean)
    words = clean.split()
    if not words: return None
    if len(words) == 1: return words[0][:18]
    first = words[0]
    if len(first) <= 2 and len(words) >= 3: first = words[0] + words[1]
    last = words[-1]
    if len(last) <= 2 and len(words) >= 3: last = words[-2]
    return (first + '.' + last)[:18].rstrip('.')
conn = psycopg2.connect("postgres://postgres:postgres123@localhost:5432/absensi_mtsn1")
cur = conn.cursor()
cur.execute("SELECT username, full_name FROM users WHERE role='guru' AND status='active' ORDER BY id")
sisa = []
for uname, fname in cur.fetchall():
    g = gen(fname or '')
    if g and g != uname and not uname.startswith('guru.'):
        if not (len(uname) <= len(g) and re.fullmatch(r'[a-z]+(\.[a-z]+)*', uname)):
            sisa.append((uname, fname, g))
print('sisa belum sinkron:', sisa if sisa else '0 - semua guru aturan 2 kata / manual valid')
