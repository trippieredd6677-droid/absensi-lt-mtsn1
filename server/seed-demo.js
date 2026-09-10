/**
 * Seed data demo untuk testing web absensi.
 * - Membuat 8 guru dummy (password: Guru1234)
 * - Mengisi absensi ~30 hari terakhir dengan variasi hadir/sakit/izin/alpa
 * - Aman dijalankan berulang (hapus data guru demo dulu, lalu insert ulang)
 *
 * Jalankan: node server/seed-demo.js
 */
const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const GURU_DEMO = [
  { username: 'guru.budi', full_name: 'Budi Santoso, S.Pd', nip: '198501012010011001', kelas: '7A', jenis_layanan: 'Guru Mapel Matematika', no_hp: '0812340001' },
  { username: 'guru.siti', full_name: 'Siti Aminah, S.Pd.I', nip: '198702022010012002', kelas: '7B', jenis_layanan: 'Guru Mapel Agama', no_hp: '0812340002' },
  { username: 'guru.agus', full_name: 'Agus Priyanto, S.Pd', nip: '199003032011011003', kelas: '8A', jenis_layanan: 'Guru Mapel IPA', no_hp: '0812340003' },
  { username: 'guru.rina', full_name: 'Rina Marlina, M.Pd', nip: '199204042012012004', kelas: '8B', jenis_layanan: 'Guru Mapel Bahasa', no_hp: '0812340004' },
  { username: 'guru.joko', full_name: 'Joko Widodo, S.Pd', nip: '198806052008011005', kelas: '9A', jenis_layanan: 'Guru Mapel IPS', no_hp: '0812340005' },
  { username: 'guru.dewi', full_name: 'Dewi Anggraini, S.Pd', nip: '199105062009012006', kelas: '9B', jenis_layanan: 'Guru Mapel Seni', no_hp: '0812340006' },
  { username: 'guru.eko', full_name: 'Eko Prasetyo, S.Pd', nip: '198507072007011007', kelas: '7C', jenis_layanan: 'Guru BK', no_hp: '0812340007' },
  { username: 'guru.nur', full_name: 'Nur Hidayah, M.Pd', nip: '199308082013012008', kelas: '8C', jenis_layanan: 'Guru Mapel PJOK', no_hp: '0812340008' },
];

const STATUSES = ['hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'sakit', 'izin', 'alpa'];
const SHIFTS = ['siang', 'malam'];
const KELAS_LIST = ['7A','7B','7C','8A','8B','8C','9A','9B'];
const CATATAN = {
  hadir: ['Kegiatan belajar mengajar lancar', 'Siswa aktif mengikuti pelajaran', 'Absen tepat waktu', 'Materi tersampaikan dengan baik'],
  sakit: ['Beristirahat karena demam', 'Izin sakit dibuktikan surat dokter', 'Tidak bisa hadir, kondisi kurang fit'],
  izin: ['Acara keluarga', 'Mengikuti pelatihan guru', 'Izin keperluan dinas'],
  alpa: ['Tidak ada keterangan', 'Lupa mengisi absensi'],
};

const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Hapus guru demo lama (biar idempoten)
    const demoUsernames = GURU_DEMO.map(g => g.username);
    await client.query('DELETE FROM absensi WHERE user_id IN (SELECT id FROM users WHERE username = ANY($1))', [demoUsernames]);
    await client.query('DELETE FROM users WHERE username = ANY($1)', [demoUsernames]);

    const hashed = await bcrypt.hash('Guru1234', 10);
    const userIds = [];

    for (const g of GURU_DEMO) {
      const r = await client.query(
        `INSERT INTO users (username, email, password, full_name, nip, role, kelas, jenis_layanan, no_hp, status)
         VALUES ($1,$2,$3,$4,$5,'guru',$6,$7,$8,'active') RETURNING id`,
        [g.username, g.username + '@mtsn1kebumen.id', hashed, g.full_name, g.nip, g.kelas, g.jenis_layanan, g.no_hp]
      );
      userIds.push(r.rows[0].id);
    }

    // Insert absensi 30 hari terakhir untuk tiap guru
    const today = new Date();
    let inserted = 0;
    for (const uid of userIds) {
      for (let d = 30; d >= 1; d--) {
        const dt = new Date(today);
        dt.setDate(today.getDate() - d);
        const dow = dt.getDay();
        if (dow === 0 || dow === 6) continue; // weekend libur
        const status = rand(STATUSES);
        const shift = rand(SHIFTS);
        const kelas = rand(KELAS_LIST);
        const hari = days[dow];
        const catatan = rand(CATATAN[status]);
        const tanggal = dt.toISOString().split('T')[0];

        await client.query(
          `INSERT INTO absensi (user_id, tanggal, hari, shift, kelas, status, catatan, ip_address)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (user_id, tanggal, shift, kelas) DO NOTHING`,
          [uid, tanggal, hari, shift, kelas, status, catatan, '127.0.0.1']
        );
        inserted++;
      }
    }

    await client.query('COMMIT');
    console.log(`✓ Seed selesai: ${GURU_DEMO.length} guru demo + ~${inserted} record absensi`);
    console.log('  Login guru: guru.budi / Guru1234  (dan seterusnya: guru.siti, guru.agus, ...)\n  Admin: admin / admin123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed gagal:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
