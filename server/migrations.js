const pool = require('./db');

// Migrasi idempotent — jalan tiap server start, aman dipanggil berulang.
async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      email VARCHAR(100) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      attempts INTEGER DEFAULT 0,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
  `);

  // Tabel kelas (dinamis, dikelola admin) — idempotent
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kelas (
      id SERIAL PRIMARY KEY,
      nama VARCHAR(10) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed 30 kelas default (7A..9J) hanya kalau tabel kosong
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM kelas');
  if (rows[0].c === 0) {
    const names = [7, 8, 9].flatMap((g) =>
      'ABCDEFGHIJ'.split('').map((l) => `${g}${l}`)
    );
    for (const n of names) {
      await pool.query('INSERT INTO kelas (nama) VALUES ($1) ON CONFLICT (nama) DO NOTHING', [n]);
    }
    console.log('✓ Seed kelas default: ' + names.length);
  }

  console.log('✓ Migrations ready (password_resets, kelas)');

  // Tabel shift (dinamis, dikelola admin)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shift (
      id SERIAL PRIMARY KEY,
      nama VARCHAR(20) NOT NULL UNIQUE,
      urutan INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const { rows: shr } = await pool.query('SELECT COUNT(*)::int AS c FROM shift');
  if (shr[0].c === 0) {
    await pool.query(`INSERT INTO shift (nama, urutan) VALUES ('siang', 1), ('malam', 2) ON CONFLICT (nama) DO NOTHING`);
    console.log('✓ Seed shift default: siang, malam');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS jam_lt (
      id SERIAL PRIMARY KEY,
      nama VARCHAR(20) NOT NULL UNIQUE,
      urutan INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ===== Tabel inti (users, absensi, audit_log) =====
  // Dibuat di sini juga (idempotent) supaya bisa jalan ke DATABASE_URL/hosted
  // tanpa harus pakai setup-db.js yang butuh DB_* + CREATE DATABASE.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      nip VARCHAR(20),
      role VARCHAR(20) NOT NULL DEFAULT 'guru',
      kelas VARCHAR(10),
      jenis_layanan VARCHAR(50),
      no_hp VARCHAR(15),
      foto_profil VARCHAR(255),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS absensi (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tanggal DATE NOT NULL,
      hari VARCHAR(10) NOT NULL,
      shift VARCHAR(20) NOT NULL,
      kelas VARCHAR(10),
      status VARCHAR(20) NOT NULL,
      foto_kegiatan VARCHAR(255),
      catatan TEXT,
      lokasi_gps VARCHAR(100),
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, tanggal, shift)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      table_name VARCHAR(50),
      record_id INTEGER,
      old_data JSONB,
      new_data JSONB,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_absensi_user_id ON absensi(user_id);
    CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
  `);

  // Tabel refresh token (rotasi + revoke; hash disimpan, bukan token mentah) — idempotent
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      revoked BOOLEAN DEFAULT false,
      replaced_by INTEGER NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP NULL,
      ip_address VARCHAR(64) NULL,
      user_agent TEXT NULL
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);`);

  // Tabel settings (key/value) untuk konfigurasi app (jam telat dsb)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('✓ Migrations ready (password_resets, kelas, shift, users, absensi, audit_log, settings)');

  // ===== Fitur JADWAL (layanan tambahan / FDS) =====
  // guru_map: pemetaan kode (dari PDF jadwal) -> guru + jenis layanan
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guru_map (
      id SERIAL PRIMARY KEY,
      kode VARCHAR(10) UNIQUE NOT NULL,
      nama_guru VARCHAR(160) NOT NULL,
      jenis_layanan VARCHAR(120),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // jadwal: slot (hari, jam, kelas, gender_target) -> kode guru / keterangan aktivitas
  // gender_target ('Putra'/'Putri'/'Campur') bagian dari kunci unik supaya baris
  // "Pembinaan Putra" & "Pembinaan Putri" pada slot yang sama tidak saling menimpa.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jadwal (
      id SERIAL PRIMARY KEY,
      hari VARCHAR(12) NOT NULL,
      jam VARCHAR(20) NOT NULL,
      kelas VARCHAR(40) NOT NULL,
      gender_target VARCHAR(10) NOT NULL DEFAULT 'Campur',
      program VARCHAR(20),
      kode_guru VARCHAR(10) REFERENCES guru_map(kode) ON DELETE CASCADE,
      keterangan VARCHAR(120),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Backward-compat: kalau kolom sudah ada dengan NOT NULL dari versi lama, longgarkan.
  await pool.query(`ALTER TABLE jadwal ALTER COLUMN kode_guru DROP NOT NULL`);

  // Evolusi skema untuk DB lama (idempotent): kelas lebih lebar + kolom baru + kunci unik baru
  await pool.query(`ALTER TABLE jadwal ALTER COLUMN kelas TYPE VARCHAR(40)`);
  await pool.query(`ALTER TABLE jadwal ADD COLUMN IF NOT EXISTS gender_target VARCHAR(10) NOT NULL DEFAULT 'Campur'`);
  await pool.query(`ALTER TABLE jadwal ADD COLUMN IF NOT EXISTS program VARCHAR(20)`);

  // jadwal_source: salinan jadwal tanpa FK (sinkron dengan jadwal saat tambah/edit/hapus,
  // dipakai juga oleh import Excel). Tanpa tabel ini setiap simpan jadwal akan gagal.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jadwal_source (
      id SERIAL PRIMARY KEY,
      hari VARCHAR(12) NOT NULL,
      jam VARCHAR(20) NOT NULL,
      kelas VARCHAR(40) NOT NULL,
      gender_target VARCHAR(10) NOT NULL DEFAULT 'Campur',
      program VARCHAR(20),
      kode_guru VARCHAR(10),
      keterangan VARCHAR(120),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`ALTER TABLE jadwal_source ALTER COLUMN kelas TYPE VARCHAR(40)`);
  await pool.query(`ALTER TABLE jadwal_source ADD COLUMN IF NOT EXISTS gender_target VARCHAR(10) NOT NULL DEFAULT 'Campur'`);
  await pool.query(`ALTER TABLE jadwal_source ADD COLUMN IF NOT EXISTS program VARCHAR(20)`);

  // Ganti kunci unik lama (hari,jam,kelas) -> (hari,jam,kelas,gender_target).
  // Nama constraint lama dihasilkan otomatis oleh CREATE TABLE: <tabel>_<kolom>_key.
  const constraintExists = async (table, constraint) => {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = to_regclass($2)',
      [constraint, table]
    );
    return rowCount > 0;
  };
  const dropConstraintIfExists = async (table, constraint) => {
    if (await constraintExists(table, constraint)) {
      await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT ${constraint}`);
    }
  };
  const addConstraintIfNotExists = async (table, constraint, definition) => {
    if (!(await constraintExists(table, constraint))) {
      await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} ${definition}`);
    }
  };
  await dropConstraintIfExists('jadwal', 'jadwal_hari_jam_kelas_key');
  await addConstraintIfNotExists('jadwal', 'jadwal_slot_unique', 'UNIQUE (hari, jam, kelas, gender_target)');
  await dropConstraintIfExists('jadwal_source', 'jadwal_source_hari_jam_kelas_key');
  await addConstraintIfNotExists('jadwal_source', 'jadwal_source_slot_unique', 'UNIQUE (hari, jam, kelas, gender_target)');

  // Trigger propagasi jadwal_source -> jadwal (dipakai import Excel yang hanya menulis
  // jadwal_source). Dibuat ulang di sini supaya selalu mengikuti kunci slot terbaru
  // (hari, jam, kelas, gender_target) — versi lama memakai kunci 3 kolom dan error saat insert.
  await pool.query(`
    CREATE OR REPLACE FUNCTION sync_jadwal_from_source() RETURNS trigger AS $fn$
    BEGIN
      UPDATE jadwal SET
        kode_guru = NEW.kode_guru,
        keterangan = NEW.keterangan,
        program = NEW.program
      WHERE hari = NEW.hari AND jam = NEW.jam AND kelas = NEW.kelas AND gender_target = NEW.gender_target;

      INSERT INTO jadwal (hari, jam, kelas, gender_target, kode_guru, keterangan, program)
      SELECT hari, jam, kelas, gender_target, kode_guru, keterangan, program
      FROM jadwal_source
      WHERE hari = NEW.hari AND jam = NEW.jam AND kelas = NEW.kelas AND gender_target = NEW.gender_target
      ON CONFLICT (hari, jam, kelas, gender_target) DO NOTHING;

      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  `);
  await pool.query(`DROP TRIGGER IF EXISTS trg_sync_jadwal ON jadwal_source`);
  await pool.query(`
    CREATE TRIGGER trg_sync_jadwal AFTER INSERT OR UPDATE ON jadwal_source
    FOR EACH ROW EXECUTE FUNCTION sync_jadwal_from_source()
  `);

  // Link akun user -> guru_map (biar jadwal sesuai nama guru PDF)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS guru_map_kode VARCHAR(10)`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_users_guru_map ON users(guru_map_kode)`
  );

  // Tabel jenis_layanan (master, dikelola di Kelola Kelas > Jenis Layanan)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jenis_layanan (
      id SERIAL PRIMARY KEY,
      nama VARCHAR(120) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const { rows: jlCount } = await pool.query('SELECT COUNT(*)::int AS c FROM jenis_layanan');
  if (jlCount[0].c === 0) {
    const { rows: distinct } = await pool.query('SELECT DISTINCT jenis_layanan FROM guru_map WHERE jenis_layanan IS NOT NULL AND jenis_layanan <> \'\'');
    for (const r of distinct) {
      await pool.query('INSERT INTO jenis_layanan (nama) VALUES ($1) ON CONFLICT (nama) DO NOTHING', [r.jenis_layanan]);
    }
    if (distinct.length) console.log('✓ Seed jenis_layanan dari guru_map: ' + distinct.length);
  }

  // Bootstrap admin pertama — hanya jika ADMIN_PASSWORD di-set (anti default-cred lemah)
  const bcrypt = require('bcryptjs');
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  if (adminPassword) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO users (username, email, password, full_name, role, status)
       VALUES ($1, $2, $3, $4, 'admin', 'active')
       ON CONFLICT (username) DO NOTHING`,
      [adminUsername, `${adminUsername}@mtsn1kebumen.id`, hashed, 'Administrator']
    );
    console.log(`✓ Admin siap (username: ${adminUsername})`);
  } else {
    console.log('⚠️  ADMIN_PASSWORD belum diset — akun admin TIDAK dibuat otomatis.');
  }

  // Auto-sync jadwal dari SUMBER DATA TUNGGAL (server/data/jadwal-patokan.json) kalau tabel
  // masih kosong — biar app langsung kebuka dengan jadwal patokan pas deploy. Idempotent.
  // Untuk REPLACE paksa dari JSON kapan saja: `npm run sync-jadwal`.
  const { syncJadwal } = require('./sync-jadwal');
  const { rows: [{ c: gmCount }] } = await pool.query('SELECT COUNT(*)::int AS c FROM guru_map');
  const { rows: [{ c: jdCount }] } = await pool.query('SELECT COUNT(*)::int AS c FROM jadwal');
  if (gmCount === 0 || jdCount === 0) {
    const plan = await syncJadwal(pool, { apply: true });
    console.log(`✓ Auto-sync jadwal dari jadwal-patokan.json: ${plan.guru_map.length} guru_map + ${plan.jadwal.length} baris jadwal`);
  }
  // Auto-buat akun guru dari guru_map kalau GURU_DEFAULT_PASSWORD di-set (biar guru PDF bisa login utk tes)
  const guruPw = process.env.GURU_DEFAULT_PASSWORD;
  if (guruPw && guruPw.length >= 8) {
    const { loadSource } = require('./sync-jadwal');
    const { genUsername } = require('./username-generator');
    const GURU_MAP = loadSource().master_teachers.map((t) => [t.code, t.name]);
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    let created = 0;
    for (const [kode, nama] of GURU_MAP) {
      const namaBersih = nama.split(',')[0].trim();
      const uname = genUsername(namaBersih) || slug(namaBersih) || ('guru.' + kode.toLowerCase());
      const exists = await pool.query('SELECT id FROM users WHERE guru_map_kode = $1', [kode]);
      if (exists.rowCount > 0) continue;
      const hashed = await bcrypt.hash(guruPw, 10);
      const r = await pool.query(
        `INSERT INTO users (username, email, password, full_name, role, status, guru_map_kode)
         VALUES ($1,$2,$3,$4,'guru','active',$5) ON CONFLICT (username) DO NOTHING`,
        [uname, `${uname}@mtsn1kebumen.id`, hashed, namaBersih, kode]
      );
      if (r.rowCount > 0) created++;
    }
    if (created) console.log(`✓ Auto-buat akun guru (password dari GURU_DEFAULT_PASSWORD): ${created}`);
  }
}

module.exports = { runMigrations };
