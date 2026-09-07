// Sinkronisasi JADWAL dari SATU sumber data: server/data/jadwal-patokan.json
// ("Jadwal Layanan Tambahan (LT)" — MTsN 1 Kebumen, Gasal 2026/2027, efektif 2026-07-27).
//
// Aturan (murni dari JSON — tanpa pergeseran kolom, tanpa menebak data):
//   - master_teachers -> upsert guru_map (kode, nama_guru, jenis_layanan = default_subject)
//   - schedules       -> REPLACE isi tabel jadwal + jadwal_source
//       day + start_time/end_time -> hari + jam (format "HH.MM - HH.MM", konsisten dgn grid client)
//       teacher_code              -> kode_guru (FK ke guru_map.kode)
//       teacher_code = null       -> activity disimpan ke kolom keterangan (Olim, Ekstra, Pramuka, ...)
//       activity                  -> keterangan (juga utk baris berkode guru, mis. "English Area (EA 7 FDS)")
//       program                   -> kolom program ('IBS' / 'FDS' / 'Cendekia')
//       gender_target             -> kolom gender_target ('Putra' / 'Putri' / 'Campur');
//                                    bagian dari kunci unik slot sehingga baris "Pembinaan Putra"
//                                    dan "Pembinaan Putri" pada slot sama TIDAK saling menimpa,
//                                    dan dipakai untuk pembagian presensi santri.
//
// Pemakaian:
//   node server/sync-jadwal.js           -> dry-run (validasi saja, tidak menulis DB)
//   node server/sync-jadwal.js --apply   -> tulis ke database (guru_map upsert + jadwal REPLACE)
//   npm run sync-jadwal                  -> sama dengan --apply
//   Dari kode: syncJadwal(pool, { apply, guruMapOnly })
//     apply: true  -> tulis ke DB
//     guruMapOnly  -> hanya upsert guru_map (tanpa REPLACE jadwal; dipakai saat server start
//                     supaya editan manual admin di grid tidak tertimpa tiap restart)

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'jadwal-patokan.json');
const HARI_OK = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const GENDER_OK = ['Putra', 'Putri', 'Campur'];

// "14:10" -> "14.10" (format jam yang dipakai grid & filter di client)
function toJam(start, end) {
  return `${String(start).replace(':', '.')} - ${String(end).replace(':', '.')}`;
}

function loadSource() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(data.master_teachers) || !Array.isArray(data.schedules)) {
    throw new Error('Struktur jadwal-patokan.json tidak sesuai (butuh master_teachers & schedules)');
  }
  return data;
}

// Validasi ketat SEBELUM menulis apa pun: gagal cepat, tanpa tebakan.
function buildPlan(data) {
  const masterCodes = new Set();
  for (const t of data.master_teachers) {
    if (!t.code || !t.name) throw new Error(`master_teachers tidak lengkap: ${JSON.stringify(t)}`);
    masterCodes.add(t.code);
  }

  const seen = new Set();
  const rows = data.schedules.map((s, i) => {
    const where = `schedules[${i}] (${s.day} ${s.start_time})`;
    if (!HARI_OK.includes(s.day)) throw new Error(`${where}: hari tidak valid: ${s.day}`);
    if (!s.start_time || !s.end_time) throw new Error(`${where}: jam tidak lengkap`);
    if (!s.target_class) throw new Error(`${where}: target_class kosong`);
    if (!GENDER_OK.includes(s.gender_target)) throw new Error(`${where}: gender_target tidak valid: ${s.gender_target}`);
    if (s.teacher_code !== null && !masterCodes.has(s.teacher_code)) {
      throw new Error(`${where}: teacher_code "${s.teacher_code}" tidak ada di master_teachers`);
    }
    if (s.teacher_code === null && !s.activity) {
      throw new Error(`${where}: teacher_code null tapi activity kosong — tidak ada nama kegiatan untuk disimpan`);
    }
    const jam = toJam(s.start_time, s.end_time);
    const key = `${s.day}|${jam}|${s.target_class}|${s.gender_target}`;
    if (seen.has(key)) throw new Error(`${where}: duplikat kunci slot ${key}`);
    seen.add(key);
    return {
      hari: s.day,
      jam,
      kelas: s.target_class,
      gender_target: s.gender_target,
      kode_guru: s.teacher_code,
      keterangan: s.activity || null,
      program: s.program || null,
    };
  });

  return {
    guru_map: data.master_teachers.map((t) => [t.code, t.name, t.default_subject || null]),
    jadwal: rows,
  };
}

async function syncJadwal(pool, { apply = false, guruMapOnly = false } = {}) {
  const plan = buildPlan(loadSource());

  if (!apply) {
    return { ...plan, dryRun: true };
  }

  // 1) guru_map: upsert dari master_teachers (idempotent)
  for (const [kode, nama, jenis] of plan.guru_map) {
    await pool.query(
      `INSERT INTO guru_map (kode, nama_guru, jenis_layanan)
       VALUES ($1, $2, $3)
       ON CONFLICT (kode) DO UPDATE SET nama_guru = EXCLUDED.nama_guru, jenis_layanan = EXCLUDED.jenis_layanan`,
      [kode, nama, jenis]
    );
  }

  if (guruMapOnly) {
    return { ...plan, dryRun: false, guruMapOnly: true };
  }

  // 2) jadwal + jadwal_source: REPLACE — hapus isi lama, tulis ulang persis dari JSON,
  //    dalam satu transaksi (gagal di tengah = tidak ada perubahan parsial).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM jadwal');
    await client.query('DELETE FROM jadwal_source');
    for (const r of plan.jadwal) {
      await client.query(
        `INSERT INTO jadwal (hari, jam, kelas, gender_target, kode_guru, keterangan, program)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [r.hari, r.jam, r.kelas, r.gender_target, r.kode_guru, r.keterangan, r.program]
      );
      await client.query(
        `INSERT INTO jadwal_source (hari, jam, kelas, gender_target, kode_guru, keterangan, program)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [r.hari, r.jam, r.kelas, r.gender_target, r.kode_guru, r.keterangan, r.program]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return { ...plan, dryRun: false };
}

module.exports = { syncJadwal, buildPlan, loadSource, toJam, DATA_FILE };

if (require.main === module) {
  require('dotenv').config();
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  const apply = process.argv.includes('--apply');
  syncJadwal(pool, { apply })
    .then((r) => {
      console.log(`Sumber data : ${DATA_FILE}`);
      console.log(`guru_map    : ${r.guru_map.length} entri (upsert)`);
      console.log(`jadwal      : ${r.jadwal.length} baris (replace)`);
      if (!apply) {
        console.log('DRY RUN — tidak ada yang ditulis. Tambahkan --apply untuk menerapkan.');
        return pool.end();
      }
      console.log('✓ Sinkronisasi diterapkan ke database.');
      return pool.end();
    })
    .catch((e) => {
      console.error('Sync gagal:', e.message);
      process.exit(1);
    });
}
