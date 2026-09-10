const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { verifyToken, isGuruOrAdmin, isAdmin, auditLog } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, isGuruOrAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nama FROM jenis_layanan ORDER BY nama');
    res.json({ jenis_layanan: result.rows });
  } catch (err) {
    console.error('Get jenis_layanan error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

router.post('/', verifyToken, isAdmin, [
  body('nama').notEmpty().withMessage('Nama jenis layanan wajib diisi').isLength({ max: 120 }).withMessage('Maks 120 karakter'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const clean = req.body.nama.trim();
    const result = await pool.query('INSERT INTO jenis_layanan (nama) VALUES ($1) RETURNING id, nama', [clean]);
    await auditLog('CREATE', 'jenis_layanan', result.rows[0].id, {}, result.rows[0], req);
    res.status(201).json({ message: 'Jenis layanan ditambahkan', jenis_layanan: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Jenis layanan sudah ada' });
    console.error('Create jenis_layanan error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

router.put('/:id', verifyToken, isAdmin, [
  body('nama').notEmpty().withMessage('Nama jenis layanan wajib diisi').isLength({ max: 120 }).withMessage('Maks 120 karakter'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const { id } = req.params;
    const clean = req.body.nama.trim();
    const existing = await pool.query('SELECT * FROM jenis_layanan WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Jenis layanan tidak ditemukan' });
    try {
      const result = await pool.query('UPDATE jenis_layanan SET nama = $1 WHERE id = $2 RETURNING id, nama', [clean, id]);
      await auditLog('UPDATE', 'jenis_layanan', id, existing.rows[0], result.rows[0], req);
      res.json({ message: 'Jenis layanan diperbarui', jenis_layanan: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ message: 'Nama sudah ada' });
      throw err;
    }
  } catch (err) {
    console.error('Update jenis_layanan error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM jenis_layanan WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Jenis layanan tidak ditemukan' });
    const usedGuru = await pool.query('SELECT COUNT(*)::int AS c FROM guru_map WHERE jenis_layanan = $1', [existing.rows[0].nama]);
    const usedUser = await pool.query("SELECT COUNT(*)::int AS c FROM users WHERE jenis_layanan ILIKE '%' || $1 || '%'", [existing.rows[0].nama]);
    if (usedGuru.rows[0].c > 0 || usedUser.rows[0].c > 0) {
      return res.status(400).json({ message: `Jenis layanan masih dipakai ${usedGuru.rows[0].c + usedUser.rows[0].c} data. Ganti dulu.` });
    }
    await pool.query('DELETE FROM jenis_layanan WHERE id = $1', [id]);
    await auditLog('DELETE', 'jenis_layanan', id, existing.rows[0], {}, req);
    res.json({ message: 'Jenis layanan dihapus' });
  } catch (err) {
    console.error('Delete jenis_layanan error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

module.exports = router;
