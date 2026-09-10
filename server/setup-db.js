const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: 'postgres',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function setupDatabase() {
  try {
    console.log('Creating database...');
    await pool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
    console.log('Database created');
  } catch (err) {
    if (err.code === '42P04') {
      console.log('Database already exists');
    } else {
      console.error('Error creating database:', err);
      process.exit(1);
    }
  }

  const poolWithDB = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('Creating tables...');

    // Users table
    await poolWithDB.query(`
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

    // Absensi table
    await poolWithDB.query(`
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

    // Audit log table
    await poolWithDB.query(`
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

    // Create indexes for performance
    await poolWithDB.query(`
      CREATE INDEX IF NOT EXISTS idx_absensi_user_id ON absensi(user_id);
      CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
    `);

    console.log('Tables created successfully');

    // Insert admin user — hanya kalau ADMIN_PASSWORD di set (anti default-cred lemah)
    const bcrypt = require('bcryptjs');
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';

    if (adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await poolWithDB.query(
        `INSERT INTO users (username, email, password, full_name, role, status)
         VALUES ($1, $2, $3, $4, 'admin', 'active')
         ON CONFLICT (username) DO NOTHING`,
        [adminUsername, `${adminUsername}@mtsn1kebumen.id`, hashedPassword, 'Administrator']
      );
      console.log(`✓ Admin user siap (username: ${adminUsername})`);
    } else {
      console.log('⚠️  ADMIN_PASSWORD belum diset di .env — akun admin default TIDAK dibuat.');
      console.log('    Buat manual: UPDATE users SET role = \'admin\' WHERE username = \'...\'');
    }

    await poolWithDB.end();
    await pool.end();
    console.log('Database setup completed successfully');
  } catch (err) {
    console.error('Error setting up database:', err);
    await poolWithDB.end();
    await pool.end();
    process.exit(1);
  }
}

setupDatabase();
