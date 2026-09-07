// Seed JADWAL — delegasi ke server/sync-jadwal.js yang memakai SATU sumber data:
// server/data/jadwal-patokan.json ("Jadwal Layanan Tambahan (LT)" Gasal TA 2026/2027).
//
// Isi:
//   1. guru_map  : upsert dari master_teachers (kode -> nama guru + jenis layanan)
//   2. jadwal    : REPLACE dari schedules (teacher_code -> kode_guru;
//                  teacher_code null -> activity disimpan sebagai keterangan;
//                  gender_target 'Putra'/'Putri'/'Campur' utk pembagian presensi santri)
//   3. jadwal_source : salinan identik jadwal (tanpa FK)
//   4. Akun guru   : link/buat dari guru_map (butuh GURU_DEFAULT_PASSWORD, min 8 karakter)
//
// Jalankan manual : node server/seed-jadwal.js --apply
//                   (tanpa --apply = dry-run, validasi JSON saja tanpa menulis DB)

const { Pool } = require('pg');
require('dotenv').config();
const { syncJadwal } = require('./sync-jadwal');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function seed() {
  // Mode pemanggilan:
  //   1. Dari server start (require di server/index.js):
  //      hanya guru_map di-upsert — jadwal TIDAK diubah, supaya editan manual admin
  //      di grid tidak tertimpa setiap kali server restart/deploy.
  //   2. CLI `node server/seed-jadwal.js --apply` / `npm run sync-jadwal`:
  //      full sync — guru_map upsert + REPLACE jadwal dari JSON.
  //   3. CLI tanpa --apply: dry-run (validasi JSON, tidak menulis DB).
  const fromServerStart = process.argv[1] && process.argv[1].endsWith('index.js');
  const apply = process.argv.includes('--apply') || fromServerStart;
  const guruMapOnly = fromServerStart && !process.argv.includes('--apply');
  const plan = await syncJadwal(pool, { apply, guruMapOnly });

  if (!apply) {
    console.log(`DRY RUN — JSON valid: ${plan.guru_map.length} guru_map, ${plan.jadwal.length} baris jadwal. Tidak ada yang ditulis.`);
    await pool.end();
    return;
  }
  console.log(`✓ Guru map: ${plan.guru_map.length} entri (upsert dari jadwal-patokan.json)`);
  if (guruMapOnly) {
    console.log('✓ Jadwal tidak diubah (mode server start — pakai `npm run sync-jadwal` untuk REPLACE).');
  } else {
    console.log(`✓ Jadwal: ${plan.jadwal.length} baris (replace dari jadwal-patokan.json)`);
  }

  // ==== Link akun guru existing yang belum punya guru_map_kode (berdasarkan nama) ====
  const masterByName = new Map(plan.guru_map.map(([kode, nama]) => [nama.split(',')[0].trim().toLowerCase(), kode]));
  const usersWithoutMap = await pool.query('SELECT id, full_name FROM users WHERE role = $1 AND guru_map_kode IS NULL', ['guru']);
  for (const user of usersWithoutMap.rows) {
    const kode = masterByName.get(user.full_name.split(',')[0].trim().toLowerCase());
    if (kode) {
      await pool.query('UPDATE users SET guru_map_kode = $1 WHERE id = $2', [kode, user.id]);
    } else {
      console.log(`⚠️ Tidak ada guru_map yang cocok untuk user: ${user.full_name} (id ${user.id})`);
    }
  }

  // ==== Buat akun guru dari guru_map ====
  // GURU_DEFAULT_PASSWORD WAJIB di-set — TANPA itu, akun guru TIDAK dibuat (hindari
  // password default yang mudah ditebak). Data guru_map + jadwal tetap tersinkron.
  const bcrypt = require('bcryptjs');
  const DEFAULT_PW = process.env.GURU_DEFAULT_PASSWORD;
  if (!DEFAULT_PW || DEFAULT_PW.length < 8) {
    console.log('⚠️ GURU_DEFAULT_PASSWORD belum di-set (min 8 karakter) — akun guru SKIP. Data jadwal tetap masuk.');
  } else {
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    for (const [kode, nama] of plan.guru_map) {
      const namaBersih = nama.split(',')[0].trim();
      const uname = slug(namaBersih) || ('guru.' + kode.toLowerCase());
      const email = `${uname}@mtsn1kebumen.id`;
      const sudah = await pool.query('SELECT id, username, email, full_name FROM users WHERE guru_map_kode = $1', [kode]);
      if (sudah.rowCount > 0) {
        const user = sudah.rows[0];
        if (user.username !== uname || user.email !== email || user.full_name !== namaBersih) {
          await pool.query('UPDATE users SET username = $1, email = $2, full_name = $3 WHERE guru_map_kode = $4', [uname, email, namaBersih, kode]);
        }
        continue;
      }
      const hashed = await bcrypt.hash(DEFAULT_PW, 10);
      await pool.query(
        `INSERT INTO users (username, email, password, full_name, role, status, guru_map_kode)
         VALUES ($1, $2, $3, $4, 'guru', 'active', $5)
         ON CONFLICT (username) DO NOTHING`,
        [uname, email, hashed, namaBersih, kode]
      );
    }
    const { rows: [{ c: cLink }] } = await pool.query('SELECT COUNT(*)::int AS c FROM users WHERE guru_map_kode IS NOT NULL');
    console.log(`✓ Akun guru ter-link: ${cLink}`);
  }

  await pool.end();
  console.log('Seed jadwal selesai.');
}

module.exports = { seed };

if (require.main === module) {
  seed().catch((e) => { console.error('Error seeding:', e); process.exit(1); });
}
