const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { verifyToken, isAdmin, auditLog } = require('../middleware/auth');

const router = express.Router();

// Create new user (guru) — admin only
router.post('/users', verifyToken, isAdmin, [
  body('username').isLength({ min: 3 }).withMessage('Username minimal 3 karakter'),
  body('email').isEmail().withMessage('Email tidak valid'),
  body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter'),
  body('full_name').notEmpty().withMessage('Nama lengkap wajib diisi'),
  body('role').optional().isIn(['guru', 'admin']).withMessage('Role tidak valid'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  }

  try {
    const { username, email, password, full_name, nip, kelas, jabatan, no_hp, role } = req.body;

    const dupe = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (dupe.rows.length > 0) {
      return res.status(400).json({ message: 'Username atau email sudah digunakan' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const targetRole = role === 'admin' ? 'admin' : 'guru';
    const result = await pool.query(
      `INSERT INTO users (username, email, password, full_name, nip, kelas, jabatan, no_hp, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING id, username, email, full_name, nip, role, status`,
      [username, email, hashedPassword, full_name, nip || null, kelas || null, jabatan || null, no_hp || null, targetRole]
    );

    await auditLog('CREATE', 'users', result.rows[0].id, {}, result.rows[0], req);

    res.status(201).json({
      message: targetRole === 'admin' ? 'Admin berhasil ditambahkan' : 'Guru berhasil ditambahkan',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Activate user back (admin only)
router.post('/users/:id/activate', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    await pool.query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['active', id]
    );
    await auditLog('ACTIVATE', 'users', id, existing.rows[0], { status: 'active' }, req);
    res.json({ message: 'Pengguna berhasil diaktifkan' });
  } catch (err) {
    console.error('Activate user error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Get all users (admin only) — search server-side via q
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const { role, status, q, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, username, email, full_name, nip, role, kelas, jabatan, no_hp, status, created_at, guru_map_kode FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = $' + (params.length + 1);
      params.push(role);
    }
    if (status) {
      query += ' AND status = $' + (params.length + 1);
      params.push(status);
    }
    if (q) {
      query += ` AND (username ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1} OR full_name ILIKE $${params.length + 1})`;
      params.push('%' + q + '%');
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams = [];
    if (role) { countQuery += ' AND role = $' + (countParams.length + 1); countParams.push(role); }
    if (status) { countQuery += ' AND status = $' + (countParams.length + 1); countParams.push(status); }
    if (q) {
      countQuery += ` AND (username ILIKE $${countParams.length + 1} OR email ILIKE $${countParams.length + 1} OR full_name ILIKE $${countParams.length + 1})`;
      countParams.push('%' + q + '%');
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Get user by ID (admin only)
router.get('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, username, email, full_name, nip, role, kelas, jabatan, no_hp, status, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Update user (admin only)
router.put('/users/:id', verifyToken, isAdmin, [
  body('full_name').notEmpty().withMessage('Full name required'),
  body('username').isLength({ min: 3 }).withMessage('Username minimal 3 karakter'),
  body('email').isEmail().withMessage('Email tidak valid'),
  body('kelas').optional(),
  body('jabatan').optional(),
  body('no_hp').optional(),
  body('role').optional().isIn(['guru', 'admin']).withMessage('Role tidak valid'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { username, email, full_name, kelas, jabatan, no_hp, role, status } = req.body;

    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    // Jangan izinkan admin mengubah role sendiri (hindari kehilangan akses)
    if (role && role !== existing.rows[0].role && id == req.user.id) {
      return res.status(400).json({ message: 'Tidak bisa mengubah role Anda sendiri' });
    }

    // Cek duplikat username/email (kecuali user yang sedang diedit)
    const dupe = await pool.query(
      'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id <> $3',
      [username, email, id]
    );
    if (dupe.rows.length > 0) {
      return res.status(400).json({ message: 'Username atau email sudah digunakan oleh pengguna lain' });
    }

    const targetRole = role || existing.rows[0].role;
    const result = await pool.query(
      `UPDATE users SET username = $1, email = $2, full_name = $3, kelas = $4, jabatan = $5, no_hp = $6, status = $7, role = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id, username, email, full_name, nip, role, kelas, jabatan, no_hp, status, foto_profil`,
      [username, email, full_name, kelas || null, jabatan || null, no_hp || null, status || 'active', targetRole, id]
    );

    await auditLog('UPDATE', 'users', id, existing.rows[0], result.rows[0], req);

    res.json({
      message: 'User updated successfully',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Reset user password (admin only)
router.post('/users/:id/reset-password', verifyToken, isAdmin, [
  body('newPassword').isLength({ min: 8 }).withMessage('Password min 8 char'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, id]
    );

    await auditLog('RESET_PASSWORD', 'users', id, {}, { id }, req);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Deactivate user (admin only)
router.post('/users/:id/deactivate', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deactivation
    if (id == req.user.id) {
      return res.status(400).json({ message: 'Cannot deactivate yourself' });
    }

    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    await pool.query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['inactive', id]
    );

    await auditLog('DEACTIVATE', 'users', id, existing.rows[0], { status: 'inactive' }, req);

    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    console.error('Deactivate user error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Get statistics (admin only)
router.get('/stats/summary', verifyToken, isAdmin, async (req, res) => {
  try {
    const [usersCount, guruCount, absensiCount, hadir] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['guru']),
      pool.query('SELECT COUNT(*) FROM absensi'),
      pool.query('SELECT COUNT(*) FROM absensi WHERE status = $1', ['hadir']),
    ]);

    res.json({
      totalUsers: parseInt(usersCount.rows[0].count),
      totalGuru: parseInt(guruCount.rows[0].count),
      totalAbsensi: parseInt(absensiCount.rows[0].count),
      totalHadir: parseInt(hadir.rows[0].count),
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Get audit logs (admin only)
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT a.*, u.username FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM audit_log');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      logs: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Link / unlink user to guru_map by code (admin only) — perbaiki orphan account
router.post('/users/:id/link-guru-map', verifyToken, isAdmin, [
  body('guru_map_kode').optional({ nullable: true }).isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { id } = req.params;
    const { guru_map_kode } = req.body; // null/'' = unlink

    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });

    let code = guru_map_kode || null;
    if (code) {
      const gm = await pool.query('SELECT kode FROM guru_map WHERE kode = $1', [code]);
      if (gm.rows.length === 0) return res.status(400).json({ message: 'Kode guru_map tidak ditemukan' });
    }

    const result = await pool.query(
      'UPDATE users SET guru_map_kode = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, guru_map_kode',
      [code, id]
    );
    await auditLog('LINK_GURU_MAP', 'users', id, existing.rows[0], result.rows[0], req);
    res.json({ message: code ? 'User ter-link ke guru_map' : 'Link guru_map dilepas', user: result.rows[0] });
  } catch (err) {
    console.error('Link guru_map error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// List orphan guru users (belum ter-link guru_map) — admin only
router.get('/users-orphan', verifyToken, isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, full_name, email, role, status FROM users WHERE role = 'guru' AND guru_map_kode IS NULL ORDER BY id"
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('Get orphans error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Jangan hapus diri sendiri
    if (id == req.user.id) {
      return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri' });
    }

    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Hapus data absensi milik user lalu user-nya
      await client.query('DELETE FROM absensi WHERE user_id = $1', [id]);
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await auditLog('DELETE', 'users', id, existing.rows[0], { id, username: existing.rows[0].username }, req);
    res.json({ message: 'User berhasil dihapus' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// === Bulk actions (admin only) ===
// Bulk activate/deactivate
router.post('/users/bulk/status', verifyToken, isAdmin, [
  body('ids').isArray().withMessage('ids harus array'),
  body('status').isIn(['active', 'inactive']).withMessage('status aktif/inaktif'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { ids, status } = req.body;
    const safeIds = ids.filter((x) => Number.isInteger(x) && x !== req.user.id);
    if (safeIds.length === 0) return res.status(400).json({ message: 'Tidak ada ID valid (atau semua adalah akun Anda)' });
    const result = await pool.query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2) RETURNING id',
      [status, safeIds]
    );
    await auditLog(status === 'active' ? 'ACTIVATE' : 'DEACTIVATE', 'users', null, {}, { ids: safeIds, status }, req);
    res.json({ message: `${result.rowCount} user di${status === 'active' ? 'aktifkan' : 'nonaktifkan'}`, affected: result.rowCount });
  } catch (err) {
    console.error('Bulk status error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Bulk reset password (random untuk tiap user)
router.post('/users/bulk/reset-password', verifyToken, isAdmin, [
  body('ids').isArray().withMessage('ids harus array'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { ids } = req.body;
    const safeIds = ids.filter((x) => Number.isInteger(x) && x !== req.user.id);
    if (safeIds.length === 0) return res.status(400).json({ message: 'Tidak ada ID valid' });
    const rand = () => require('crypto').randomBytes(6).toString('base64').replace(/[=+/]/g, '');
    const out = [];
    for (const id of safeIds) {
      const pw = rand();
      const h = await bcrypt.hash(pw, 10);
      const r = await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING username', [h, id]);
      if (r.rowCount > 0) out.push({ id, username: r.rows[0].username, newPassword: pw });
    }
    await auditLog('RESET_PASSWORD', 'users', null, {}, { ids: safeIds, count: out.length }, req);
    res.json({ message: `${out.length} password direset`, credentials: out });
  } catch (err) {
    console.error('Bulk reset error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Bulk delete users
router.post('/users/bulk/delete', verifyToken, isAdmin, [
  body('ids').isArray().withMessage('ids harus array'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { ids } = req.body;
    const safeIds = ids.filter((x) => Number.isInteger(x) && x !== req.user.id);
    if (safeIds.length === 0) return res.status(400).json({ message: 'Tidak ada ID valid' });
    const client = await pool.connect();
    let deleted = 0;
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM absensi WHERE user_id = ANY($1)', [safeIds]);
      const r = await client.query('DELETE FROM users WHERE id = ANY($1)', [safeIds]);
      deleted = r.rowCount;
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    await auditLog('DELETE', 'users', null, {}, { ids: safeIds }, req);
    res.json({ message: `${deleted} user dihapus`, deleted });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Impersonate (login-as) — kembalikan token atas nama user target (admin only)
router.post('/impersonate/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT id, username, email, full_name, role, status FROM users WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (rows[0].status !== 'active') return res.status(400).json({ message: 'User nonaktif' });
    const token = require('jsonwebtoken').sign(
      { id: rows[0].id, username: rows[0].username, role: rows[0].role },
      process.env.JWT_SECRET,
      // Impersonasi: sesi singkat, maksimal 1 jam (jangan ikuti JWT_EXPIRE panjang)
      { expiresIn: '1h', algorithm: 'HS256' }
    );
    await auditLog('IMPERSONATE', 'users', id, {}, { by: req.user.id }, req);
    res.json({ token, user: rows[0] });
  } catch (err) {
    console.error('Impersonate error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// App settings (single-row key/value), backed by settings tabel (dibuat di migrations).
router.get('/settings', verifyToken, isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const map = {};
    rows.forEach((r) => { map[r.key] = r.value; });
    res.json({ settings: map });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

router.put('/settings', verifyToken, isAdmin, async (req, res) => {
  try {
    const data = req.body && req.body.settings ? req.body.settings : req.body;
    if (typeof data !== 'object' || data === null) return res.status(400).json({ message: 'Format settings salah' });
    for (const [k, v] of Object.entries(data)) {
      await pool.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [k, String(v)]
      );
    }
    await auditLog('UPDATE', 'settings', null, {}, data, req);
    res.json({ message: 'Settings disimpan' });
  } catch (err) {
    console.error('Put settings error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Get audit logs (admin only) — filter by action / user_id / date range
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, user_id, from, to } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (action) { params.push(action); where += ` AND a.action = $${params.length}`; }
    if (user_id) { params.push(user_id); where += ` AND a.user_id = $${params.length}`; }
    if (from) { params.push(from); where += ` AND a.created_at >= $${params.length}`; }
    if (to) { params.push(to); where += ` AND a.created_at <= $${params.length}`; }

    const result = await pool.query(
      `SELECT a.*, u.username FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_log a ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      logs: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Export full absensi (all filtered, no pagination) — admin only
router.get('/export', verifyToken, isAdmin, async (req, res) => {
  try {
    const { bulan, tahun, user_id } = req.query;
    let query = 'SELECT a.*, u.full_name AS guru_nama, u.username FROM absensi a LEFT JOIN users u ON u.id = a.user_id WHERE 1=1';
    const params = [];
    if (user_id) { params.push(user_id); query += ` AND a.user_id = $${params.length}`; }
    if (bulan && tahun) {
      params.push(parseInt(bulan), parseInt(tahun));
      query += ` AND EXTRACT(MONTH FROM a.tanggal) = $${params.length - 1} AND EXTRACT(YEAR FROM a.tanggal) = $${params.length}`;
    }
    query += ' ORDER BY a.tanggal DESC, a.created_at DESC';
    const result = await pool.query(query, params);
    res.json({ absensi: result.rows, count: result.rowCount });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Per-guru breakdown + late detection for a given date — admin only
router.get('/guru-breakdown', verifyToken, isAdmin, async (req, res) => {
  try {
    const t = req.query.tanggal || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    // shift "siang"/"malam" jam mulai: siang<=14:00, malam<=20:00 (configurable via settings)
    const { rows: [lateCfg] } = await pool.query("SELECT value FROM settings WHERE key='late_siang'");
    const siangDeadline = (lateCfg && lateCfg.value) || '14:00';
    const { rows: [malamCfg] } = await pool.query("SELECT value FROM settings WHERE key='late_malam'");
    const malamDeadline = (malamCfg && malamCfg.value) || '20:00';

    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.guru_map_kode,
              a.id AS absensi_id, a.shift, a.status, a.kelas, a.created_at,
              a.tanggal
       FROM users u
       LEFT JOIN absensi a ON a.user_id = u.id AND a.tanggal = $1
       WHERE u.role = 'guru' AND u.status = 'active'
       ORDER BY u.full_name`,
      [t]
    );
    const breakdown = rows.map((r) => {
      let late = false;
      if (r.absensi_id && r.status === 'hadir') {
        const [hh, mm] = (r.shift === 'malam' ? malamDeadline : siangDeadline).split(':').map(Number);
        const submitted = new Date(r.created_at);
        const deadline = new Date(r.created_at);
        deadline.setHours(hh, mm, 0, 0);
        late = submitted > deadline;
      }
      return {
        id: r.id, full_name: r.full_name, username: r.username, guru_map_kode: r.guru_map_kode,
        submitted: !!r.absensi_id, status: r.status || null, shift: r.shift || null,
        kelas: r.kelas || null, late,
      };
    });
    const summary = {
      total: breakdown.length,
      submitted: breakdown.filter((b) => b.submitted).length,
      hadir: breakdown.filter((b) => b.status === 'hadir').length,
      sakit: breakdown.filter((b) => b.status === 'sakit').length,
      izin: breakdown.filter((b) => b.status === 'izin').length,
      alpa: breakdown.filter((b) => b.submitted && b.status === 'alpa').length,
      belum: breakdown.filter((b) => !b.submitted).length,
      terlambat: breakdown.filter((b) => b.late).length,
    };
    res.json({ tanggal: t, summary, breakdown });
  } catch (err) {
    console.error('Guru breakdown error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Get admin dashboard (monitoring) — admin only
router.get('/dashboard', verifyToken, isAdmin, async (req, res) => {
  try {
    const now = new Date();
    const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [users, gurus, tToday, hadir, sakit, izin, alpa] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS c FROM users'),
      pool.query("SELECT COUNT(*)::int AS c FROM users WHERE role = 'guru'"),
      pool.query('SELECT COUNT(*)::int AS c FROM absensi WHERE tanggal = $1', [t]),
      pool.query("SELECT COUNT(*)::int AS c FROM absensi WHERE tanggal = $1 AND status = 'hadir'", [t]),
      pool.query("SELECT COUNT(*)::int AS c FROM absensi WHERE tanggal = $1 AND status = 'sakit'", [t]),
      pool.query("SELECT COUNT(*)::int AS c FROM absensi WHERE tanggal = $1 AND status = 'izin'", [t]),
      pool.query("SELECT COUNT(*)::int AS c FROM absensi WHERE tanggal = $1 AND status = 'alpa'", [t]),
    ]);

    // Guru aktif yang belum input absensi hari ini
    const notSubmitted = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.no_hp FROM users u
       WHERE u.role = 'guru' AND u.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM absensi a WHERE a.user_id = u.id AND a.tanggal = $1)
       ORDER BY u.full_name`, [t]
    );

    // Tren 7 hari terakhir
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const c = await pool.query('SELECT COUNT(*)::int AS c FROM absensi WHERE tanggal = $1', [ds]);
      trend.push({ tanggal: ds, count: c.rows[0].c });
    }

    res.json({
      totalUsers: users.rows[0].c,
      totalGuru: gurus.rows[0].c,
      today: {
        total: tToday.rows[0].c,
        hadir: hadir.rows[0].c,
        sakit: sakit.rows[0].c,
        izin: izin.rows[0].c,
        alpa: alpa.rows[0].c,
      },
      notSubmitted: notSubmitted.rows,
      trend,
    });
  } catch (err) {
    console.error('Get admin dashboard error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

module.exports = router;
