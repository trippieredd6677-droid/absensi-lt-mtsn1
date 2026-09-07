// Refresh-token lifecycle untuk sesi jangka pendek.
// - Access token: JWT pendek (JWT_EXPIRE, default 2h)
// - Refresh token: random 48 byte, DI-HASH (sha256) sebelum disimpan — kebocoran DB tidak langsung bisa dipakai
// - Rotasi: tiap refresh mengeluarkan refresh baru & menandai yang lama replaced_by
// - Reuse detection: refresh yang sudah revoked dipakai lagi -> SEMUA refresh token user dicabut (kemungkinan token dicuri)
const crypto = require('crypto');
const pool = require('./db');

const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 hari

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Buat refresh token baru untuk user. Mengembalikan token MENTAH (dikirim ke client sekali).
 */
async function issueRefreshToken(userId, req) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const { rows } = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [userId, sha256(raw), expiresAt, req?.ip || null, (req?.headers?.['user-agent'] || '').slice(0, 500)]
  );
  // Housekeeping: buang token kedaluwarsa lama (murah, index pada user_id)
  await pool.query(
    `DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW() - INTERVAL '30 days'`,
    [userId]
  );
  return { token: raw, id: rows[0].id, expiresAt };
}

/**
 * Validasi refresh token mentah. Mengembalikan row DB jika valid & belum kedaluwarsa, else null.
 * Reuse (token revoked dipakai lagi) -> revoke semua token user & return null.
 */
async function consumeRefreshToken(raw, req) {
  if (!raw || typeof raw !== 'string') return null;
  const { rows } = await pool.query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`,
    [sha256(raw)]
  );
  const row = rows[0];
  if (!row) return null;

  if (row.revoked) {
    // Reuse detection: anggap kompromi, cabut semua sesi user ini
    await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`, [row.user_id]);
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_data, new_data, ip_address)
       VALUES ($1, 'REFRESH_REUSE_DETECTED', 'refresh_tokens', $2, '{}', $3, $4)`,
      [row.user_id, row.id, JSON.stringify({ at: new Date().toISOString() }), req?.ip || null]
    );
    return null;
  }
  if (new Date(row.expires_at) < new Date()) return null;

  await pool.query(`UPDATE refresh_tokens SET last_used_at = NOW() WHERE id = $1`, [row.id]);
  return row;
}

/**
 * Tandai token sebagai revoked dan catat penggantinya (rotasi).
 */
async function revokeRefreshToken(id, replacedBy) {
  await pool.query(`UPDATE refresh_tokens SET revoked = true, replaced_by = $2 WHERE id = $1`, [id, replacedBy || null]);
}

/**
 * Cabut semua refresh token milik user (logout-all / password berubah / reuse terdeteksi).
 */
async function revokeAllForUser(userId) {
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`, [userId]);
}

module.exports = {
  issueRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  REFRESH_TTL_MS,
};
