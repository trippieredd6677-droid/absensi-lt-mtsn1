const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { auditLog } = require('../middleware/auth');
const { issueRefreshToken, consumeRefreshToken, revokeRefreshToken, revokeAllForUser } = require('../auth-tokens');
const { sendOtpEmail } = require('../mailer');
const upload = require('../middleware/upload');

const router = express.Router();

// In-memory rate limit untuk cooldown forgot-password (30 detik per email)
const forgotCooldowns = new Map();

// Register new guru
router.post('/register', [
  body('username').isLength({ min: 4 }).withMessage('Username min 4 char'),
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 char'),
  body('full_name').notEmpty().withMessage('Full name required'),
  body('nip').notEmpty().withMessage('NIP required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, email, password, full_name, nip, kelas, jabatan, no_hp } = req.body;

    // Check if user exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user — status 'pending': butuh persetujuan admin sebelum bisa login
    const result = await pool.query(
      `INSERT INTO users (username, email, password, full_name, nip, kelas, jabatan, no_hp, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING id, username, email, full_name, role, status`,
      [username, email, hashedPassword, full_name, nip, kelas, jabatan, no_hp, 'guru']
    );

    await auditLog('REGISTER_PENDING', 'users', result.rows[0].id, {}, result.rows[0], req);

    res.status(201).json({
      // Jangan bocorkan data akun sebelum disetujui
      message: 'Pendaftaran berhasil. Akun menunggu persetujuan admin sebelum dapat digunakan.',
      status: 'pending',
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Login
router.post('/login', [
  body('username').notEmpty().withMessage('Username required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, password } = req.body;

    // Find user (status apapun dulu, biar bisa kasih pesan spesifik utk pending/nonaktif)
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 LIMIT 1',
      [username]
    );

    // Pesan sama utk user tak ada & password salah (anti user-enumeration).
    // Pengecualian: kalau password BENAR tapi akun belum disetujui -> beri tahu statusnya.
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      await auditLog('LOGIN_FAILED', 'users', user.id, {}, { username }, req);
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    if (user.status === 'pending') {
      await auditLog('LOGIN_PENDING', 'users', user.id, {}, { username }, req);
      return res.status(403).json({ message: 'Akun masih menunggu persetujuan admin. Hubungi admin sekolah.' });
    }
    if (user.status !== 'active') {
      await auditLog('LOGIN_INACTIVE', 'users', user.id, {}, { username }, req);
      return res.status(403).json({ message: 'Akun dinonaktifkan. Hubungi admin sekolah.' });
    }

    // Generate JWT (access, short-lived) + refresh token (rotatable)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '2h', algorithm: 'HS256' }
    );
    const refresh = await issueRefreshToken(user.id, req);

    await auditLog('LOGIN', 'users', user.id, {}, { username, role: user.role }, req);

    res.json({
      message: 'Login successful',
      token,
      refresh_token: refresh.token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        kelas: user.kelas,
        foto_profil: user.foto_profil,
        guru_map_kode: user.guru_map_kode,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Refresh sesi: tukar refresh token -> access JWT baru + refresh baru (rotasi).
// Reuse refresh lama yang sudah revoked = indikasi token dicuri -> semua sesi user dicabut.
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ message: 'refresh_token wajib diisi' });
    }
    const row = await consumeRefreshToken(refresh_token, req);
    if (!row) {
      return res.status(401).json({ message: 'Sesi tidak valid. Silakan login kembali.' });
    }
    // User harus masih aktif (kalau di-deactivate, refresh pun ditolak)
    const u = await pool.query('SELECT id, username, role, status FROM users WHERE id = $1', [row.user_id]);
    if (u.rows.length === 0 || u.rows[0].status !== 'active') {
      await revokeAllForUser(row.user_id);
      return res.status(401).json({ message: 'Akun tidak aktif. Silakan login kembali.' });
    }
    const user = u.rows[0];

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '2h', algorithm: 'HS256' }
    );
    const next = await issueRefreshToken(user.id, req);
    await revokeRefreshToken(row.id, next.id);

    res.json({
      message: 'Token diperbarui',
      token,
      refresh_token: next.token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Logout: cabut refresh token yang dikirim (best-effort; access JWT memang dibiarkan kedaluwarsa sendiri)
router.post('/logout', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const row = await consumeRefreshToken(refresh_token, req);
      if (row) await revokeRefreshToken(row.id, null);
    }
    res.json({ message: 'Logout berhasil' });
  } catch (err) {
    console.error('Logout error:', err);
    res.json({ message: 'Logout berhasil' });
  }
});

// Get current user
router.get('/me', require('../middleware/auth').verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, nip, role, kelas, jabatan, no_hp, foto_profil, status, created_at FROM users WHERE id = $1',
      [req.user.id]
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

// Update current user profile (guru can edit own basic info + email)
router.put('/me', require('../middleware/auth').verifyToken, [
  body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional().isEmail().withMessage('Email tidak valid'),
  body('jabatan').optional(),
  body('no_hp').optional(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { full_name, email, jabatan, no_hp } = req.body;

    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    // Dupe-check email (kecuali diri sendiri)
    if (email) {
      const dupe = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [String(email).toLowerCase().trim(), req.user.id]
      );
      if (dupe.rows.length > 0) {
        return res.status(400).json({ message: 'Email sudah digunakan oleh pengguna lain' });
      }
    }

    const result = await pool.query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         jabatan = COALESCE($3, jabatan),
         no_hp = COALESCE($4, no_hp),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, username, email, full_name, nip, role, kelas, jabatan, no_hp, foto_profil, status`,
      [full_name || null, (email ? String(email).toLowerCase().trim() : null), jabatan || null, no_hp || null, req.user.id]
    );

    await auditLog('UPDATE', 'users', req.user.id, existing.rows[0], result.rows[0], req);

    res.json({
      message: 'Profil berhasil diperbarui',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Change current user password
router.put('/password', require('../middleware/auth').verifyToken, [
  body('oldPassword').notEmpty().withMessage('Password lama wajib diisi'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password baru minimal 8 karakter'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { oldPassword, newPassword } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    const user = result.rows[0];

    // Verifikasi password lama
    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ message: 'Password lama tidak sesuai' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    await auditLog('CHANGE_PASSWORD', 'users', req.user.id, {}, { id: req.user.id }, req);

    // Password berubah -> cabut semua sesi refresh lama (kecuali sesi ini; sederhananya: semua)
    await revokeAllForUser(req.user.id);

    res.json({ message: 'Password berhasil diganti' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// ====== FORGOT PASSWORD + OTP ======

// 1) Request OTP via email
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Email tidak valid'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.body;
    const lowerEmail = String(email).toLowerCase().trim();

    // Cooldown 30 detik per email (anti-spam)
    const last = forgotCooldowns.get(lowerEmail);
    if (last && Date.now() - last < 30000) {
      return res.status(429).json({ message: 'Terlalu cepat. Coba lagi dalam 30 detik.' });
    }
    forgotCooldowns.set(lowerEmail, Date.now());

    const userResult = await pool.query(
      'SELECT id, email, full_name FROM users WHERE email = $1 AND status = $2',
      [lowerEmail, 'active']
    );

    // Selalu balas sukses (hindari enumerasi email). Kalau user tak ada, tak kirim apa pun.
    if (userResult.rows.length === 0) {
      return res.json({ message: 'Jika email terdaftar, kode OTP telah dikirim.' });
    }

    const user = userResult.rows[0];

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    // Nonaktifkan reset lama yang belum dipakai (single active)
    await pool.query(
      'UPDATE password_resets SET used = true WHERE email = $1 AND used = false',
      [lowerEmail]
    );

    await pool.query(
      'INSERT INTO password_resets (email, otp_hash, expires_at) VALUES ($1, $2, $3)',
      [lowerEmail, otpHash, expiresAt]
    );

    const sendResult = await sendOtpEmail(lowerEmail, otp, user.full_name);
    await auditLog('FORGOT_PASSWORD', 'users', user.id, {}, { email: lowerEmail, delivered: !!sendResult?.delivered }, req);

    // Hanya boleh aktif di non-production — jangan pernah bocorkan OTP di response produksi
    const dev = process.env.MAIL_LOGGING === 'true' && process.env.NODE_ENV !== 'production';
    res.json({
      message: 'Jika email terdaftar, kode OTP telah dikirim.',
      // Hanya dikembalikan saat dev logging — supaya alur teruji tanpa SMTP asli
      ...(dev ? { dev_otp: otp, dev_sent: sendResult.delivered, dev_note: sendResult.reason || 'logged' } : {}),
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// 2) Verify OTP -> balas reset token JWT (berlaku 10 menit)
router.post('/verify-otp', [
  body('email').isEmail().withMessage('Email tidak valid'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP 6 digit'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, otp } = req.body;
    const lowerEmail = String(email).toLowerCase().trim();

    const resetResult = await pool.query(
      `SELECT * FROM password_resets
       WHERE email = $1 AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [lowerEmail]
    );

    if (resetResult.rows.length === 0) {
      return res.status(400).json({ message: 'Kode OTP tidak ditemukan. Minta ulang.' });
    }

    const reset = resetResult.rows[0];

    if (new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ message: 'Kode OTP sudah kedaluwarsa. Minta ulang.' });
    }

    if (reset.attempts >= 5) {
      await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [reset.id]);
      return res.status(400).json({ message: 'Terlalu banyak percobaan. Minta ulang.' });
    }

    const isValid = await bcrypt.compare(otp, reset.otp_hash);
    if (!isValid) {
      await pool.query(
        'UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1',
        [reset.id]
      );
      return res.status(400).json({ message: 'Kode OTP salah.' });
    }

    // OTP benar -> tandai terpakai + terbitkan reset token (short-lived JWT)
    await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [reset.id]);
    await auditLog('OTP_VERIFIED', 'password_resets', reset.id, {}, { email: lowerEmail }, req);

    const resetToken = jwt.sign(
      { email: lowerEmail, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({ message: 'OTP valid', reset_token: resetToken, email: lowerEmail });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// 3) Reset password pakai reset token
router.post('/reset-password', [
  body('email').isEmail().withMessage('Email tidak valid'),
  body('reset_token').notEmpty().withMessage('Token wajib diisi'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password baru minimal 8 karakter'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, reset_token, newPassword } = req.body;
    const lowerEmail = String(email).toLowerCase().trim();

    let decoded;
    try {
      decoded = jwt.verify(reset_token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
      return res.status(400).json({ message: 'Tautan reset tidak valid atau berakhir.' });
    }

    if (decoded.purpose !== 'password_reset' || decoded.email !== lowerEmail) {
      return res.status(400).json({ message: 'Tautan reset tidak valid.' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND status = $2',
      [lowerEmail, 'active']
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Pengguna tidak ditemukan.' });
    }

    const user = userResult.rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, user.id]
    );

    // Bersihkan semua kode reset untuk email ini
    await pool.query('DELETE FROM password_resets WHERE email = $1', [lowerEmail]);

    // Password berubah -> cabut semua sesi refresh lama
    await revokeAllForUser(user.id);

    await auditLog('RESET_PASSWORD', 'users', user.id, {}, { id: user.id, email: lowerEmail }, req);

    res.json({ message: 'Password berhasil diubah. Silakan masuk.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

// Upload / ganti foto profil sendiri (guru & admin)
router.put('/me/photo', require('../middleware/auth').verifyToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File tidak ditemukan. Pilih foto untuk diunggah.' });
    }
    const fotoProfil = req.file.filename;

    const result = await pool.query(
      'UPDATE users SET foto_profil = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, full_name, nip, role, kelas, jabatan, no_hp, foto_profil',
      [fotoProfil, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    await auditLog('UPDATE', 'users', req.user.id, {}, { foto_profil: fotoProfil }, req);

    res.json({ message: 'Foto profil berhasil diperbarui', user: result.rows[0] });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ message: 'Kesalahan server' });
  }
});

module.exports = router;
