const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { verifyToken, isGuruOrAdmin, isAdmin, auditLog } = require('../middleware/auth');

const router = express.Router();

// Legacy: List semua shift (siang/malam) — untuk backward compatibility
router.get('/', verifyToken, isGuruOrAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nama FROM shift ORDER BY urutan, nama');
    res.json({ shift: result.rows });
  } catch (err) {
    console.error('Get shift error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Jam LT CRUD — admin only
const createJam = async (req, res) => {
  const { nama, urutan } = req.body;
  const cleanNama = nama ? nama.trim() : null;
  if (!cleanNama) {
    return res.status(400).json({ message: 'Nama jam wajib diisi' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO jam_lt (nama, urutan) VALUES ($1, $2) RETURNING id, nama, urutan',
      [cleanNama, urutan ?? null]
    );
    await auditLog('CREATE', 'jam_lt', result.rows[0].id, {}, result.rows[0], req);
    res.status(201).json({ message: 'Jam LT ditambahkan', jam_lt: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Jam LT sudah ada' });
    }
    console.error('Create jam-lt error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
};

const listJam = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nama, urutan FROM jam_lt ORDER BY urutan NULLS FIRST, nama');
    res.json({ jam_lt: result.rows });
  } catch (err) {
    console.error('List jam-lt error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
};

const updateJam = async (req, res) => {
  const { id } = req.params;
  const { nama, urutan } = req.body;
  const cleanNama = nama ? nama.trim() : null;
  if (!cleanNama) {
    return res.status(400).json({ message: 'Nama jam wajib diisi' });
  }
  try {
    const existing = await pool.query('SELECT * FROM jam_lt WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Jam LT tidak ditemukan' });
    }
    const result = await pool.query(
      'UPDATE jam_lt SET nama = $1, urutan = $2 WHERE id = $3 RETURNING id, nama, urutan',
      [cleanNama, urutan ?? null, id]
    );
    await auditLog('UPDATE', 'jam_lt', id, existing.rows[0], result.rows[0], req);
    res.json({ message: 'Jam LT diperbarui', jam_lt: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Jam LT sudah ada' });
    }
    console.error('Update jam-lt error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
};

const deleteJam = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query('SELECT * FROM jam_lt WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Jam LT tidak ditemukan' });
    }
    await pool.query('DELETE FROM jam_lt WHERE id = $1', [id]);
    await auditLog('DELETE', 'jam_lt', id, existing.rows[0], {}, req);
    res.json({ message: 'Jam LT dihapus' });
  } catch (err) {
    console.error('Delete jam-lt error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
};

// Endpoint admin: Jam LT — list & create (POST)
router.get('/jam-lt', verifyToken, isAdmin, listJam);
router.post('/jam-lt', verifyToken, isAdmin, createJam);
router.put('/jam-lt/:id', verifyToken, isAdmin, updateJam);
router.delete('/jam-lt/:id', verifyToken, isAdmin, deleteJam);

module.exports = router;
