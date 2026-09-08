const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { verifyToken, isGuruOrAdmin, isAdmin, auditLog } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Create absensi (guru)
router.post('/', verifyToken, isGuruOrAdmin, upload.single('foto_kegiatan'), [
  body('tanggal').isISO8601().withMessage('Format tanggal tidak valid'),
  body('shift').notEmpty().withMessage('Shift wajib diisi'),
  body('kelas').notEmpty().withMessage('Kelas wajib diisi'),
  body('status').isIn(['hadir', 'sakit', 'izin', 'alpa']).withMessage('Status tidak valid'),
  body('catatan').trim().notEmpty().withMessage('Catatan wajib diisi'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { tanggal, shift, kelas, status, catatan } = req.body;
    const userId = req.user.id;
    const fotoKegiatan = req.file ? req.file.filename : null;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Get day name
    const date = new Date(tanggal);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hari = days[date.getDay()];

    // Anti-manipulasi: absensi hanya boleh diisi untuk hari ini
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (tanggal !== todayStr) {
      return res.status(400).json({ message: 'Absensi hanya dapat diisi untuk hari ini.' });
    }

    // Check if already submitted for this date/shift
    const existing = await pool.query(
      'SELECT id FROM absensi WHERE user_id = $1 AND tanggal = $2 AND shift = $3',
      [userId, tanggal, shift]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Absensi untuk tanggal dan shift ini sudah pernah dikirim' });
    }

    // Insert absensi
    const result = await pool.query(
      `INSERT INTO absensi (user_id, tanggal, hari, shift, kelas, status, foto_kegiatan, catatan, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, tanggal, hari, shift, kelas, status, fotoKegiatan, catatan || null, ipAddress]
    );

    await auditLog('CREATE', 'absensi', result.rows[0].id, {}, result.rows[0], req);

    res.status(201).json({
      message: 'Absensi submitted successfully',
      absensi: result.rows[0],
    });
  } catch (err) {
    console.error('Create absensi error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Admin: input absensi manual atas nama guru (backfill tanggal apa saja)
router.post('/admin-create', verifyToken, isAdmin, upload.single('foto_kegiatan'), [
  body('user_id').isInt().withMessage('user_id wajib'),
  body('tanggal').isISO8601().withMessage('Format tanggal tidak valid'),
  body('shift').notEmpty().withMessage('Shift wajib diisi'),
  body('kelas').notEmpty().withMessage('Kelas wajib diisi'),
  body('catatan').trim().notEmpty().withMessage('Catatan wajib diisi'),
  body('status').isIn(['hadir', 'sakit', 'izin', 'alpa']).withMessage('Status tidak valid'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { user_id, tanggal, shift, kelas, status, catatan } = req.body;
    const fotoKegiatan = req.file ? req.file.filename : null;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const date = new Date(tanggal);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hari = days[date.getDay()];

    const own = await pool.query('SELECT id, role, status FROM users WHERE id = $1', [user_id]);
    if (own.rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan' });

    const existing = await pool.query(
      'SELECT id FROM absensi WHERE user_id = $1 AND tanggal = $2 AND shift = $3',
      [user_id, tanggal, shift]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Absensi untuk guru, tanggal & shift ini sudah ada' });
    }

    const result = await pool.query(
      `INSERT INTO absensi (user_id, tanggal, hari, shift, kelas, status, foto_kegiatan, catatan, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [user_id, tanggal, hari, shift, kelas, status, fotoKegiatan, catatan || null, ipAddress]
    );
    await auditLog('CREATE', 'absensi', result.rows[0].id, {}, result.rows[0], req);
    res.status(201).json({ message: 'Absensi manual berhasil dibuat', absensi: result.rows[0] });
  } catch (err) {
    console.error('Admin create absensi error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Get absensi statistics (per user if guru, all if admin) for a given month/year
router.get('/stats', verifyToken, isGuruOrAdmin, async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    const now = new Date();
    const m = parseInt(bulan) || now.getMonth() + 1;
    const y = parseInt(tahun) || now.getFullYear();

    const params = [];
    let userClause = '';
    if (req.user.role === 'guru') {
      params.push(req.user.id);
      userClause = 'AND user_id = $' + params.length;
    }

    const monthClause = `AND EXTRACT(MONTH FROM tanggal) = $${params.length + 1} AND EXTRACT(YEAR FROM tanggal) = $${params.length + 2}`;
    params.push(m, y);

    // Total hari kerja (hadir+sakit+izin+alpa) dan breakdown
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'hadir') AS hadir,
         COUNT(*) FILTER (WHERE status = 'sakit') AS sakit,
         COUNT(*) FILTER (WHERE status = 'izin') AS izin,
         COUNT(*) FILTER (WHERE status = 'alpa') AS alpa,
         COUNT(*) AS total
       FROM absensi
       WHERE 1=1 ${userClause} ${monthClause}`,
      params
    );

    const row = result.rows[0];
    const total = parseInt(row.total) || 0;
    const hadir = parseInt(row.hadir) || 0;
    const sakit = parseInt(row.sakit) || 0;
    const izin = parseInt(row.izin) || 0;
    const alpa = parseInt(row.alpa) || 0;

    // Persentase kehadiran = hadir / (total hari kerja)
    const persenHadir = total > 0 ? Math.round((hadir / total) * 100) : 0;

    res.json({
      bulan: m,
      tahun: y,
      hadir,
      sakit,
      izin,
      alpa,
      total,
      persenHadir,
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Get absensi (current user or all if admin)
router.get('/', verifyToken, isGuruOrAdmin, async (req, res) => {
  try {
    const { bulan, tahun, user_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT a.*, u.full_name AS guru_nama FROM absensi a LEFT JOIN users u ON u.id = a.user_id WHERE 1=1';
    const params = [];

    if (req.user.role === 'guru') {
      query += ' AND a.user_id = $' + (params.length + 1);
      params.push(req.user.id);
    } else if (user_id) {
      // Admin: filter per guru (rekap per guru)
      query += ' AND a.user_id = $' + (params.length + 1);
      params.push(user_id);
    }

    if (bulan && tahun) {
      query += ` AND EXTRACT(MONTH FROM a.tanggal) = $${params.length + 1}
                 AND EXTRACT(YEAR FROM a.tanggal) = $${params.length + 2}`;
      params.push(parseInt(bulan), parseInt(tahun));
    }

    // Urutkan berdasarkan waktu absen (created_at) terbaru dulu
    query += ' ORDER BY a.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM absensi WHERE 1=1';
    const countParams = [];

    if (req.user.role === 'guru') {
      countQuery += ' AND user_id = $1';
      countParams.push(req.user.id);
    } else if (user_id) {
      countQuery += ' AND user_id = $1';
      countParams.push(user_id);
    }

    if (bulan && tahun) {
      const idx = countParams.length + 1;
      countQuery += ` AND EXTRACT(MONTH FROM tanggal) = $${idx}
                     AND EXTRACT(YEAR FROM tanggal) = $${idx + 1}`;
      countParams.push(parseInt(bulan), parseInt(tahun));
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      absensi: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get absensi error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Get absensi by ID
router.get('/:id', verifyToken, isGuruOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT a.*, u.full_name, u.nip FROM absensi a JOIN users u ON a.user_id = u.id WHERE a.id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Data absensi tidak ditemukan' });
    }

    const absensi = result.rows[0];

    // Check access
    if (req.user.role === 'guru' && absensi.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    res.json({ absensi });
  } catch (err) {
    console.error('Get absensi error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Update absensi (ADMIN ONLY — guru read-only, tidak bisa ubah/hapus)
router.put('/:id', verifyToken, isAdmin, upload.single('foto_kegiatan'), [
  body('status').isIn(['hadir', 'sakit', 'izin', 'alpa']).withMessage('Invalid status'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { status, catatan } = req.body;

    // Get existing absensi
    const existing = await pool.query('SELECT * FROM absensi WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Data absensi tidak ditemukan' });
    }

    const absensi = existing.rows[0];

    // Check access
    if (req.user.role === 'guru' && absensi.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    // Update only if submitted within 24 hours for guru
    if (req.user.role === 'guru') {
      const submittedTime = new Date(absensi.created_at);
      const now = new Date();
      const hoursDiff = (now - submittedTime) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        return res.status(400).json({ message: 'Hanya bisa mengubah dalam 24 jam' });
      }
    }

    let fotoKegiatan = absensi.foto_kegiatan;
    if (req.file) {
      fotoKegiatan = req.file.filename;
    }

    const result = await pool.query(
      `UPDATE absensi SET status = $1, catatan = $2, foto_kegiatan = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, catatan || null, fotoKegiatan, id]
    );

    await auditLog('UPDATE', 'absensi', id, absensi, result.rows[0], req);

    res.json({
      message: 'Absensi updated successfully',
      absensi: result.rows[0],
    });
  } catch (err) {
    console.error('Update absensi error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Delete absensi (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT * FROM absensi WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Data absensi tidak ditemukan' });
    }

    await pool.query('DELETE FROM absensi WHERE id = $1', [id]);

    await auditLog('DELETE', 'absensi', id, existing.rows[0], {}, req);

    res.json({ message: 'Absensi deleted successfully' });
  } catch (err) {
    console.error('Delete absensi error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

module.exports = router;
