const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const XLSX = require('xlsx');
const { verifyToken, isAdmin, auditLog } = require('../middleware/auth');

// Semua route jadwal butuh login
router.use(verifyToken);

const HARI_OK = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// GET /api/jadwal/guru-map — daftar guru sesuai jadwal (kode -> guru -> jenis layanan)
router.get('/guru-map', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const { rows } = await pool.query(
      'SELECT kode, nama_guru, jenis_layanan FROM guru_map ORDER BY kode'
    );
    res.json(rows);
  } catch (err) {
    console.error('guru-map error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// GET /api/jadwal/saya — jadwal milik user yang login (berdasarkan link guru_map_kode)
router.get('/saya', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const me = await pool.query('SELECT guru_map_kode FROM users WHERE id = $1', [req.user.id]);
    const kode = me.rows[0]?.guru_map_kode;
    if (!kode) return res.json([]);
    const { rows } = await pool.query(
      `SELECT j.id, j.hari, j.jam, j.kelas, j.gender_target, j.program, j.kode_guru, j.keterangan,
              g.nama_guru, g.jenis_layanan
       FROM jadwal j
       LEFT JOIN guru_map g ON g.kode = j.kode_guru
       WHERE j.kode_guru = $1
       ORDER BY j.hari, j.jam, j.kelas`,
      [kode]
    );
    res.json(rows);
  } catch (err) {
    console.error('jadwal saya error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// GET /api/jadwal — grid jadwal (opsional filter ?hari=&kelas=), join guru_map
router.get('/', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const { hari, kelas } = req.query;
    let sql = `
      SELECT j.id, j.hari, j.jam, j.kelas, j.gender_target, j.program, j.kode_guru, j.keterangan,
             g.nama_guru, g.jenis_layanan
      FROM jadwal j
      LEFT JOIN guru_map g ON g.kode = j.kode_guru
      WHERE 1=1
    `;
    const params = [];
    if (hari) { params.push(hari); sql += ` AND j.hari = $${params.length}`; }
    if (kelas) { params.push(kelas); sql += ` AND j.kelas = $${params.length}`; }
    sql += ' ORDER BY j.hari, j.jam, j.kelas';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('jadwal error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Cari baris yang menempati slot (hari,jam,kelas,gender_target) yang sama
// gender_target ikut diperhatikan: baris Putra & Putri pada slot sama memang berdampingan.
async function findOccupant(hari, jam, kelas, excludeId, genderTarget) {
  const { rows } = await pool.query(
    `SELECT j.id, j.kode_guru, j.keterangan, g.nama_guru FROM jadwal j
     LEFT JOIN guru_map g ON g.kode = j.kode_guru
     WHERE j.hari=$1 AND j.jam=$2 AND j.kelas=$3 AND j.gender_target=$4 AND j.id <> $5`,
    [hari, jam, kelas, genderTarget || 'Campur', excludeId || -1]
  );
  return rows[0] || null;
}

// Helper: Ambil baris jadwal lengkap dengan data guru
async function fetchFullJadwal(clientOrPool, id) {
  const { rows } = await clientOrPool.query(
    `SELECT j.id, j.hari, j.jam, j.kelas, j.gender_target, j.program, j.kode_guru, j.keterangan,
            g.nama_guru, g.jenis_layanan
     FROM jadwal j
     LEFT JOIN guru_map g ON g.kode = j.kode_guru
     WHERE j.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Tambah Jadwal (Admin only)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { hari, jam, kelas, kode_guru, keterangan, gender_target, program } = req.body;
    if (!hari || !jam || !kelas) {
      return res.status(400).json({ message: 'Hari, jam, dan kelas wajib diisi' });
    }
    if (!HARI_OK.includes(hari)) {
      return res.status(400).json({ message: 'Hari tidak valid (Ahad - Sabtu)' });
    }

    let computedGender = gender_target || 'Campur';
    if (!gender_target && keterangan) {
      if (keterangan.includes('(Putra)')) computedGender = 'Putra';
      else if (keterangan.includes('(Putri)')) computedGender = 'Putri';
    }

    let computedProgram = program || null;
    if (!program && kelas) {
      if (kelas.includes('IBS') || ['9H', '9I', '9J'].includes(kelas)) {
        computedProgram = 'IBS';
      } else if (['BIL', 'INF', 'OR', 'RST', 'TH', 'THF'].some(k => kelas.includes(k)) || ['7D', '7E', '8A', '8B'].includes(kelas)) {
        computedProgram = 'FDS';
      } else if (['9A', '9B', '9C', '9D', '9E', '9F', '9G'].includes(kelas)) {
        computedProgram = 'Cendekia';
      }
    }

    const occ = await findOccupant(hari, jam, kelas, null, computedGender);
    if (occ) {
      if ((req.body.replace || req.body.overwrite) && occ.id) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('DELETE FROM jadwal WHERE id = $1', [occ.id]);
          const { rows } = await client.query(
            `INSERT INTO jadwal (hari, jam, kelas, gender_target, program, kode_guru, keterangan)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null]
          );
          await client.query(
            `INSERT INTO jadwal_source (hari, jam, kelas, gender_target, program, kode_guru, keterangan)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (hari, jam, kelas, gender_target) DO UPDATE SET kode_guru=EXCLUDED.kode_guru, keterangan=EXCLUDED.keterangan, program=EXCLUDED.program`,
            [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null]
          );
          const fullRow = await fetchFullJadwal(client, rows[0].id);
          await client.query('COMMIT');
          await auditLog('OVERWRITE', 'jadwal', rows[0].id, { replaced_id: occ.id, occupant: occ }, fullRow, req);
          return res.status(201).json(fullRow);
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
      return res.status(409).json({
        message: `Slot ${hari} ${jam} kelas ${kelas} sudah dipakai oleh ${occ.nama_guru || occ.kode_guru || 'guru lain'}.`,
        occupant_id: occ.id,
        occupant: occ.nama_guru || occ.kode_guru || 'guru lain'
      });
    }

    // Insert into both jadwal and jadwal_source in single transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO jadwal (hari, jam, kelas, gender_target, program, kode_guru, keterangan)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null]
      );
      // Also insert into jadwal_source
      await client.query(
        `INSERT INTO jadwal_source (hari, jam, kelas, gender_target, program, kode_guru, keterangan)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (hari, jam, kelas, gender_target) DO UPDATE SET kode_guru=EXCLUDED.kode_guru, keterangan=EXCLUDED.keterangan, program=EXCLUDED.program`,
        [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null]
      );
      const fullRow = await fetchFullJadwal(client, rows[0].id);
      await client.query('COMMIT');
      await auditLog('CREATE', 'jadwal', rows[0].id, {}, fullRow, req);
      res.status(201).json(fullRow);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('tambah jadwal error:', err);
    if (err.code === '23505') return res.status(409).json({ message: 'Jadwal untuk hari+jam+kelas itu sudah ada (mungkin pakai guru lain).' });
    if (err.code === '23503') return res.status(400).json({ message: 'Kode guru tidak ditemukan di daftar guru.' });
    res.status(500).json({ message: 'Kesalahan server: ' + err.message });
  }
});

// ===== CRUD Guru Map (admin) =====
router.post('/guru-map', isAdmin, async (req, res) => {
  const { kode, nama_guru, jenis_layanan } = req.body;
  if (!kode || !nama_guru) return res.status(400).json({ message: 'Kode dan nama guru wajib diisi' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO guru_map (kode, nama_guru, jenis_layanan) VALUES ($1,$2,$3)
       ON CONFLICT (kode) DO UPDATE SET nama_guru=EXCLUDED.nama_guru, jenis_layanan=EXCLUDED.jenis_layanan
       RETURNING *`,
      [kode, nama_guru, jenis_layanan || null]
    );
    await auditLog('UPSERT', 'guru_map', kode, {}, rows[0], req);
    res.status(201).json(rows[0]);
  } catch (err) { console.error('create guru-map:', err); res.status(500).json({ message: 'Kesalahan server' }); }
});

router.put('/guru-map/:kode', isAdmin, async (req, res) => {
  const { nama_guru, jenis_layanan } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE guru_map SET nama_guru=$1, jenis_layanan=$2 WHERE kode=$3 RETURNING *`,
      [nama_guru, jenis_layanan || null, req.params.kode]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Kode tidak ditemukan' });
    await auditLog('UPDATE', 'guru_map', req.params.kode, {}, rows[0], req);
    res.json(rows[0]);
  } catch (err) { console.error('update guru-map:', err); res.status(500).json({ message: 'Kesalahan server' }); }
});

router.delete('/guru-map/:kode', isAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM guru_map WHERE kode=$1', [req.params.kode]);
    if (rowCount === 0) return res.status(404).json({ message: 'Kode tidak ditemukan' });
    await auditLog('DELETE', 'guru_map', req.params.kode, {}, { kode: req.params.kode }, req);
    res.json({ message: 'Guru map dihapus' });
  } catch (err) { console.error('delete guru-map:', err); res.status(500).json({ message: 'Kesalahan server' }); }
});

// Simpan semua perubahan jadwal untuk satu guru (Batch Sync)
router.put('/by-guru/:kode', isAdmin, async (req, res) => {
  const { kode } = req.params;
  const { schedules = [], replace_conflicts = false } = req.body;

  try {
    const guruCheck = await pool.query('SELECT kode, nama_guru, jenis_layanan FROM guru_map WHERE kode = $1', [kode]);
    if (guruCheck.rows.length === 0) {
      return res.status(404).json({ message: `Guru dengan kode ${kode} tidak ditemukan` });
    }
    const guruInfo = guruCheck.rows[0];

    const normalized = [];
    for (let i = 0; i < schedules.length; i++) {
      const s = schedules[i];
      if (!s.hari || !s.jam || !s.kelas) {
        return res.status(400).json({ message: `Baris jadwal ke-${i + 1} tidak lengkap (hari, jam, kelas wajib)` });
      }
      if (!HARI_OK.includes(s.hari)) {
        return res.status(400).json({ message: `Hari "${s.hari}" tidak valid` });
      }

      let gender_target = s.gender_target || 'Campur';
      if (!s.gender_target && s.keterangan) {
        if (s.keterangan.includes('(Putra)')) gender_target = 'Putra';
        else if (s.keterangan.includes('(Putri)')) gender_target = 'Putri';
      }

      let program = s.program || null;
      if (!program && s.kelas) {
        if (s.kelas.includes('IBS') || ['9H', '9I', '9J'].includes(s.kelas)) {
          program = 'IBS';
        } else if (['BIL', 'INF', 'OR', 'RST', 'TH', 'THF'].some(k => s.kelas.includes(k)) || ['7D', '7E', '8A', '8B'].includes(s.kelas)) {
          program = 'FDS';
        } else if (['9A', '9B', '9C', '9D', '9E', '9F', '9G'].includes(s.kelas)) {
          program = 'Cendekia';
        }
      }

      normalized.push({
        hari: s.hari,
        jam: s.jam,
        kelas: s.kelas,
        gender_target,
        program,
        keterangan: s.keterangan || guruInfo.jenis_layanan || null,
        kode_guru: kode
      });
    }

    const conflicts = [];
    for (const item of normalized) {
      const { rows } = await pool.query(
        `SELECT j.id, j.hari, j.jam, j.kelas, j.gender_target, j.kode_guru, g.nama_guru
         FROM jadwal j
         LEFT JOIN guru_map g ON g.kode = j.kode_guru
         WHERE j.hari = $1 AND j.jam = $2 AND j.kelas = $3 AND j.gender_target = $4
           AND (j.kode_guru IS NULL OR j.kode_guru <> $5)`,
        [item.hari, item.jam, item.kelas, item.gender_target, kode]
      );
      if (rows.length > 0) {
        conflicts.push({ ...rows[0], targetItem: item });
      }
    }

    if (conflicts.length > 0 && !replace_conflicts) {
      const c = conflicts[0];
      return res.status(409).json({
        message: `Slot ${c.hari} ${c.jam} kelas ${c.kelas} sudah dipakai oleh ${c.nama_guru || c.kode_guru || 'guru lain'}.`,
        occupant: c.nama_guru || c.kode_guru || 'guru lain',
        occupant_id: c.id
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const oldSlots = (await client.query(
        'SELECT hari, jam, kelas, gender_target FROM jadwal WHERE kode_guru = $1',
        [kode]
      )).rows;

      if (conflicts.length > 0 && replace_conflicts) {
        for (const c of conflicts) {
          await client.query('DELETE FROM jadwal WHERE id = $1', [c.id]);
        }
      }

      await client.query('DELETE FROM jadwal WHERE kode_guru = $1', [kode]);

      for (const item of normalized) {
        await client.query(
          `INSERT INTO jadwal (hari, jam, kelas, gender_target, program, kode_guru, keterangan)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [item.hari, item.jam, item.kelas, item.gender_target, item.program, item.kode_guru, item.keterangan]
        );

        await client.query(
          `INSERT INTO jadwal_source (hari, jam, kelas, gender_target, program, kode_guru, keterangan)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (hari, jam, kelas, gender_target) DO UPDATE
           SET kode_guru = EXCLUDED.kode_guru, keterangan = EXCLUDED.keterangan, program = EXCLUDED.program`,
          [item.hari, item.jam, item.kelas, item.gender_target, item.program, item.kode_guru, item.keterangan]
        );
      }

      for (const old of oldSlots) {
        const stillPresent = normalized.some(
          n => n.hari === old.hari && n.jam === old.jam && n.kelas === old.kelas && n.gender_target === old.gender_target
        );
        if (!stillPresent) {
          const checkCur = await client.query(
            'SELECT id FROM jadwal WHERE hari = $1 AND jam = $2 AND kelas = $3 AND gender_target = $4',
            [old.hari, old.jam, old.kelas, old.gender_target]
          );
          if (checkCur.rows.length === 0) {
            await client.query(
              'DELETE FROM jadwal_source WHERE hari = $1 AND jam = $2 AND kelas = $3 AND gender_target = $4',
              [old.hari, old.jam, old.kelas, old.gender_target]
            );
          }
        }
      }

      await client.query('COMMIT');
      await auditLog('SYNC_GURU_JADWAL', 'jadwal', kode, { old_count: oldSlots.length }, { new_count: normalized.length }, req);

      const { rows } = await pool.query(
        `SELECT j.id, j.hari, j.jam, j.kelas, j.gender_target, j.program, j.kode_guru, j.keterangan,
                g.nama_guru, g.jenis_layanan
         FROM jadwal j
         LEFT JOIN guru_map g ON g.kode = j.kode_guru
         WHERE j.kode_guru = $1
         ORDER BY j.hari, j.jam, j.kelas`,
        [kode]
      );
      res.json({ message: 'Jadwal guru berhasil disimpan dan disinkronkan', schedules: rows });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('sync guru schedules error:', err);
    res.status(500).json({ message: 'Kesalahan server: ' + err.message });
  }
});

// Update Jadwal (Admin only)
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { hari, jam, kelas, kode_guru, keterangan, gender_target, program } = req.body;
    if (!hari || !jam || !kelas) {
      return res.status(400).json({ message: 'Hari, jam, dan kelas wajib diisi' });
    }
    if (!HARI_OK.includes(hari)) {
      return res.status(400).json({ message: 'Hari tidak valid' });
    }

    let computedGender = gender_target || 'Campur';
    if (!gender_target && keterangan) {
      if (keterangan.includes('(Putra)')) computedGender = 'Putra';
      else if (keterangan.includes('(Putri)')) computedGender = 'Putri';
    }

    let computedProgram = program || null;
    if (!program && kelas) {
      if (kelas.includes('IBS') || ['9H', '9I', '9J'].includes(kelas)) {
        computedProgram = 'IBS';
      } else if (['BIL', 'INF', 'OR', 'RST', 'TH', 'THF'].some(k => kelas.includes(k)) || ['7D', '7E', '8A', '8B'].includes(kelas)) {
        computedProgram = 'FDS';
      } else if (['9A', '9B', '9C', '9D', '9E', '9F', '9G'].includes(kelas)) {
        computedProgram = 'Cendekia';
      }
    }

    const occ = await findOccupant(hari, jam, kelas, id, computedGender);
    console.log('[PUT jadwal] id:', id, 'payload:', { hari, jam, kelas, kode_guru, keterangan }, 'occ:', occ);
    if (occ) {
      if ((req.body.replace || req.body.overwrite) && occ.id) {
        // Langsung ganti / timpa jadwal lama di slot itu
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const cur = (await client.query('SELECT hari, jam, kelas, gender_target FROM jadwal WHERE id=$1 FOR UPDATE', [id])).rows[0];
          if (!cur) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Jadwal tidak ditemukan' }); }
          
          await client.query('DELETE FROM jadwal WHERE id=$1', [occ.id]);
          await client.query(
            `UPDATE jadwal SET hari=$1, jam=$2, kelas=$3, gender_target=$4, program=$5, kode_guru=$6, keterangan=$7
             WHERE id=$8`,
            [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null, id]
          );
          await client.query(
            `INSERT INTO jadwal_source (hari, jam, kelas, gender_target, program, kode_guru, keterangan) VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (hari, jam, kelas, gender_target) DO UPDATE SET kode_guru=EXCLUDED.kode_guru, keterangan=EXCLUDED.keterangan, program=EXCLUDED.program`,
            [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null]
          );
          if (cur.hari !== hari || cur.jam !== jam || cur.kelas !== kelas || cur.gender_target !== computedGender) {
            await client.query(
              'DELETE FROM jadwal_source WHERE hari=$1 AND jam=$2 AND kelas=$3 AND gender_target=$4',
              [cur.hari, cur.jam, cur.kelas, cur.gender_target]
            );
          }
          const fullRow = await fetchFullJadwal(client, id);
          await client.query('COMMIT');
          await auditLog('OVERWRITE', 'jadwal', id, { replaced_id: occ.id, occupant: occ }, fullRow, req);
          return res.json(fullRow);
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
      if (req.body.swap && occ.id) {
        // tukar posisi: baris lama penghuni pindah ke posisi jadwal yang diedit
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const cur = (await client.query('SELECT hari, jam, kelas, kode_guru, keterangan FROM jadwal WHERE id=$1 FOR UPDATE', [id])).rows[0];
          if (!cur) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Jadwal tidak ditemukan' }); }
          // swap = hapus penghuni dulu, pindahkan baris ini ke slot baru, lalu tempatkan penghuni ke slot lama
          await client.query('DELETE FROM jadwal WHERE id=$1', [occ.id]);
          await client.query(
            `UPDATE jadwal SET hari=$1, jam=$2, kelas=$3, gender_target=$4, program=$5, kode_guru=$6, keterangan=$7
             WHERE id=$8`,
            [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null, id]
          );
          // Sinkronkan jadwal_source: slot baru diisi data yang diedit, slot lama diisi data penghuni
          await client.query(
            `INSERT INTO jadwal_source (hari, jam, kelas, gender_target, program, kode_guru, keterangan) VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (hari, jam, kelas, gender_target) DO UPDATE SET kode_guru=EXCLUDED.kode_guru, keterangan=EXCLUDED.keterangan, program=EXCLUDED.program`,
            [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null]
          );
          await client.query(
            `INSERT INTO jadwal_source (hari, jam, kelas, gender_target, kode_guru, keterangan) VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (hari, jam, kelas, gender_target) DO UPDATE SET kode_guru=EXCLUDED.kode_guru, keterangan=EXCLUDED.keterangan`,
            [cur.hari, cur.jam, cur.kelas, cur.gender_target, occ.kode_guru, occ.keterangan]
          );
          const fullRow = await fetchFullJadwal(client, id);
          await client.query('COMMIT');
          await auditLog('UPDATE', 'jadwal', id, { swapped_with: occ.id, occupant: occ }, fullRow, req);
          return res.json({ ...fullRow, swapped_with: occ.id });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
      return res.status(409).json({
        message: `Slot ${hari} ${jam} kelas ${kelas} sudah dipakai oleh ${occ.nama_guru || occ.kode_guru || 'guru lain'}.`,
        occupant_id: occ.id,
        occupant: occ.nama_guru || occ.kode_guru || null
      });
    }
    // Update both jadwal and jadwal_source in single transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Ambil posisi lama dulu biar baris jadwal_source di slot lama bisa dibersihkan
      const old = (await client.query('SELECT hari, jam, kelas, gender_target FROM jadwal WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!old) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Jadwal tidak ditemukan' });
      }
      await client.query(
        `UPDATE jadwal SET hari = $1, jam = $2, kelas = $3, gender_target = $4, program = $5, kode_guru = $6, keterangan = $7
         WHERE id = $8`,
        [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null, id]
      );
      // Sinkronkan jadwal_source ke posisi baru (upsert, jangan hanya UPDATE) ...
      await client.query(
        `INSERT INTO jadwal_source (hari, jam, kelas, gender_target, program, kode_guru, keterangan) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (hari, jam, kelas, gender_target) DO UPDATE SET kode_guru=EXCLUDED.kode_guru, keterangan=EXCLUDED.keterangan, program=EXCLUDED.program`,
        [hari, jam, kelas, computedGender, computedProgram, kode_guru || null, keterangan || null]
      );
      // ... lalu buang baris lama kalau hari/jam/kelas/gender berubah (biar tidak ada data basi)
      if (old.hari !== hari || old.jam !== jam || old.kelas !== kelas || old.gender_target !== computedGender) {
        await client.query(
          `DELETE FROM jadwal_source WHERE hari=$1 AND jam=$2 AND kelas=$3 AND gender_target=$4`,
          [old.hari, old.jam, old.kelas, old.gender_target]
        );
      }
      const fullRow = await fetchFullJadwal(client, id);
      await client.query('COMMIT');
      await auditLog('UPDATE', 'jadwal', id, { old: old }, fullRow, req);
      res.json(fullRow);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('update jadwal error:', err);
    if (err.code === '23505') return res.status(409).json({ message: `Konflik unik: hari=${hari}, jam=${jam}, kelas=${kelas} sudah ada.` });
    if (err.code === '23503') return res.status(400).json({ message: 'Kode guru tidak ditemukan di daftar guru.' });
    res.status(500).json({ message: 'Kesalahan server: ' + err.message });
  }
});

// Hapus Jadwal (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // First get the record details to delete from jadwal_source too
    const { rows } = await pool.query('SELECT hari, jam, kelas, gender_target FROM jadwal WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Jadwal tidak ditemukan' });
    const { hari, jam, kelas, gender_target } = rows[0];
    
    // Delete from both tables in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM jadwal WHERE id = $1', [id]);
      await client.query('DELETE FROM jadwal_source WHERE hari = $1 AND jam = $2 AND kelas = $3 AND gender_target = $4', [hari, jam, kelas, gender_target]);
      await client.query('COMMIT');
      await auditLog('DELETE', 'jadwal', id, { hari, jam, kelas, gender_target }, {}, req);
      res.json({ message: 'Jadwal berhasil dihapus' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('hapus jadwal error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Import Jadwal dari Excel (Admin only)
const uploadExcel = multer({ storage: multer.memoryStorage() });
router.post('/import-excel', isAdmin, uploadExcel.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File Excel tidak ditemukan' });
    }
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ message: 'File Excel kosong atau format tidak sesuai' });
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      // Format kolom fleksibel: hari / Hari, jam / Jam, kelas / Kelas, kode_guru / KodeGuru / kode
      const hari = row.hari || row.Hari || row.HARI;
      const jam = row.jam || row.Jam || row.JAM;
      const kelas = row.kelas || row.Kelas || row.KELAS;
      let kode_guru = row.kode_guru || row.KodeGuru || row.kode || row.Kode || null;
      const keterangan = row.keterangan || row.Keterangan || null;

      if (!hari || !jam || !kelas) {
        skippedCount++;
        continue;
      }
      if (!HARI_OK.includes(String(hari).trim())) {
        skippedCount++;
        continue;
      }

      // Bersihkan string
      const cleanHari = String(hari).trim();
      const cleanJam = String(jam).trim();
      const cleanKelas = String(kelas).trim();
      const cleanKode = kode_guru ? String(kode_guru).trim() : null;
      const cleanKet = keterangan ? String(keterangan).trim() : null;

      await pool.query(
        `INSERT INTO jadwal_source (hari, jam, kelas, gender_target, kode_guru, keterangan)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (hari, jam, kelas, gender_target) DO UPDATE SET kode_guru=EXCLUDED.kode_guru, keterangan=EXCLUDED.keterangan`,
        [cleanHari, cleanJam, cleanKelas, 'Campur', cleanKode, cleanKet]
      );
      importedCount++;
    }

    await auditLog('IMPORT_EXCEL', 'jadwal_source', null, {}, { importedCount, skippedCount, filename: req.file?.originalname }, req);
    res.json({
      message: `Berhasil mengimpor ${importedCount} jadwal (${skippedCount} dilewati karena format invalid).`,
      importedCount,
      skippedCount
    });
  } catch (err) {
    console.error('import excel error:', err);
    res.status(500).json({ message: 'Gagal memproses file Excel: ' + err.message });
  }
});

module.exports = router;
