const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { verifyToken, isGuruOrAdmin, isAdmin, auditLog } = require('../middleware/auth');

const router = express.Router();

// List semua kelas — guru & admin
router.get('/', verifyToken, isGuruOrAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nama FROM kelas ORDER BY nama');
    res.json({ kelas: result.rows });
  } catch (err) {
    console.error('Get kelas error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Tambah kelas — admin
router.post('/', verifyToken, isAdmin, [
  body('nama').notEmpty().withMessage('Nama kelas wajib diisi').isLength({ max: 30 }).withMessage('Maks 30 karakter'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const { nama } = req.body;
    const clean = nama.trim().toUpperCase();
    try {
      const result = await pool.query('INSERT INTO kelas (nama) VALUES ($1) RETURNING id, nama', [clean]);
      await auditLog('CREATE', 'kelas', result.rows[0].id, {}, result.rows[0], req);
      res.status(201).json({ message: 'Kelas ditambahkan', kelas: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ message: 'Kelas sudah ada' });
      throw err;
    }
  } catch (err) {
    console.error('Create kelas error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Ubah kelas — admin
router.put('/:id', verifyToken, isAdmin, [
  body('nama').notEmpty().withMessage('Nama kelas wajib diisi').isLength({ max: 30 }).withMessage('Maks 30 karakter'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const { id } = req.params;
    const { nama } = req.body;
    const clean = nama.trim().toUpperCase();
    const existing = await pool.query('SELECT * FROM kelas WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    try {
      const result = await pool.query('UPDATE kelas SET nama = $1 WHERE id = $2 RETURNING id, nama', [clean, id]);
      await auditLog('UPDATE', 'kelas', id, existing.rows[0], result.rows[0], req);
      res.json({ message: 'Kelas diperbarui', kelas: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ message: 'Nama kelas sudah ada' });
      throw err;
    }
  } catch (err) {
    console.error('Update kelas error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Hapus kelas — admin
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM kelas WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

    // Cek apakah kelas masih dipakai di absensi (tampilkan peringatan tapi tetap bisa dipaksa hapus)
    const used = await pool.query('SELECT COUNT(*)::int AS c FROM absensi WHERE kelas = $1', [existing.rows[0].nama]);
    if (used.rows[0].c > 0) {
      return res.status(400).json({ message: `Kelas masih dipakai ${used.rows[0].c} data absensi. Ganti kelas tersebut dulu.` });
    }

    await pool.query('DELETE FROM kelas WHERE id = $1', [id]);
    await auditLog('DELETE', 'kelas', id, existing.rows[0], {}, req);
    res.json({ message: 'Kelas dihapus' });
  } catch (err) {
    console.error('Delete kelas error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

module.exports = router;
