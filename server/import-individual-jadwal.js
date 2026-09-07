const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function run() {
  const jsonPath = '/Users/anm/Downloads/jadwal_absensi_individual 2.json';
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File ${jsonPath} tidak ditemukan`);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const items = JSON.parse(rawData);
  console.log(`Loaded ${items.length} items from ${jsonPath}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Alter kolom kelas jika perlu
    await client.query('ALTER TABLE kelas ALTER COLUMN nama TYPE VARCHAR(50);');
    await client.query('ALTER TABLE jadwal ALTER COLUMN kelas TYPE VARCHAR(50);');
    await client.query('ALTER TABLE jadwal_source ALTER COLUMN kelas TYPE VARCHAR(50);');

    // 2. Kosongkan absensi, jadwal, jadwal_source
    const delAbsensi = await client.query('DELETE FROM absensi;');
    console.log(`Deleted absensi: ${delAbsensi.rowCount} baris`);

    const delJadwal = await client.query('DELETE FROM jadwal;');
    console.log(`Deleted jadwal: ${delJadwal.rowCount} baris`);

    const delJadwalSrc = await client.query('DELETE FROM jadwal_source;');
    console.log(`Deleted jadwal_source: ${delJadwalSrc.rowCount} baris`);

    // 3. Perbarui tabel kelas dengan kelas unik / satuan
    await client.query('DELETE FROM kelas;');
    const uniqueClasses = [...new Set(items.map(x => x.kelas.trim()))].sort();
    for (const c of uniqueClasses) {
      await client.query('INSERT INTO kelas (nama) VALUES ($1) ON CONFLICT (nama) DO NOTHING;', [c]);
    }
    console.log(`Inserted ${uniqueClasses.length} unique classes into table kelas`);

    // 4. Upsert guru_map
    const validTeachers = new Map();
    for (const x of items) {
      const code = (x.kode_guru || '').trim();
      if (code && code !== '-') {
        if (!validTeachers.has(code)) {
          validTeachers.set(code, {
            nama: (x.nama_guru || '').trim(),
            mapel: (x.mata_pelajaran || '').trim()
          });
        }
      }
    }

    for (const [code, info] of validTeachers.entries()) {
      await client.query(`
        INSERT INTO guru_map (kode, nama_guru, jenis_layanan)
        VALUES ($1, $2, $3)
        ON CONFLICT (kode) DO UPDATE
        SET nama_guru = EXCLUDED.nama_guru,
            jenis_layanan = EXCLUDED.jenis_layanan;
      `, [code, info.nama, info.mapel]);
    }
    console.log(`Upserted ${validTeachers.size} teachers into guru_map`);

    // 5. Masukkan 237 baris jadwal individual
    let insertCount = 0;
    for (const x of items) {
      const hari = x.hari.trim();
      const jamMulai = (x.jam_mulai || '').trim().replace(':', '.');
      const jamSelesai = (x.jam_selesai || '').trim().replace(':', '.');
      const jam = `${jamMulai} - ${jamSelesai}`;
      const kelas = x.kelas.trim();
      const mapel = (x.mata_pelajaran || '').trim();
      let kodeGuru = (x.kode_guru || '').trim();
      if (!kodeGuru || kodeGuru === '-') {
        kodeGuru = null;
      }

      let genderTarget = 'Campur';
      if (mapel.includes('(Putra)')) {
        genderTarget = 'Putra';
      } else if (mapel.includes('(Putri)')) {
        genderTarget = 'Putri';
      }

      let program = null;
      if (kelas.includes('IBS') || ['9H', '9I', '9J'].includes(kelas)) {
        program = 'IBS';
      } else if (['BIL', 'INF', 'OR', 'RST', 'TH', 'THF'].some(k => kelas.includes(k)) || ['7D', '7E', '8A', '8B'].includes(kelas)) {
        program = 'FDS';
      } else if (['9A', '9B', '9C', '9D', '9E', '9F', '9G'].includes(kelas)) {
        program = 'Cendekia';
      }

      const keterangan = mapel;

      await client.query(`
        INSERT INTO jadwal (hari, jam, kelas, gender_target, program, kode_guru, keterangan)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [hari, jam, kelas, genderTarget, program, kodeGuru, keterangan]);

      await client.query(`
        INSERT INTO jadwal_source (hari, jam, kelas, gender_target, program, kode_guru, keterangan)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (hari, jam, kelas, gender_target) DO UPDATE
        SET kode_guru = EXCLUDED.kode_guru,
            keterangan = EXCLUDED.keterangan,
            program = EXCLUDED.program;
      `, [hari, jam, kelas, genderTarget, program, kodeGuru, keterangan]);

      insertCount++;
    }

    await client.query('COMMIT');
    console.log(`Successfully imported ${insertCount} individual schedule records into jadwal & jadwal_source!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
