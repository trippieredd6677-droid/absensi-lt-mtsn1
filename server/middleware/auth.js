const jwt = require('jsonwebtoken');
const pool = require('../db');

// Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Sesi berakhir, silakan login kembali' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Sesi tidak valid atau sudah berakhir' });
  }
};

// Check if user is admin (re-verify role & status dari DB biar demote/disable langsung berlaku)
const isAdmin = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT role, status FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0 || rows[0].status !== 'active' || rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Akses ditolak. Khusus admin.' });
    }
    req.user.role = rows[0].role;
    next();
  } catch (err) {
    console.error('isAdmin check error:', err);
    return res.status(500).json({ message: 'Kesalahan server' });
  }
};

// Check if user is guru or admin (re-verify status aktif)
const isGuruOrAdmin = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT role, status FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0 || rows[0].status !== 'active' || !['guru', 'admin'].includes(rows[0].role)) {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }
    req.user.role = rows[0].role;
    next();
  } catch (err) {
    console.error('isGuruOrAdmin check error:', err);
    return res.status(500).json({ message: 'Kesalahan server' });
  }
};

// Audit log middleware
const auditLog = async (action, tableName, recordId, oldData, newData, req) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_data, new_data, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user?.id || null, action, tableName, recordId, JSON.stringify(oldData), JSON.stringify(newData), ipAddress]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

module.exports = {
  verifyToken,
  isAdmin,
  isGuruOrAdmin,
  auditLog,
};
