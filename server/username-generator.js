/**
 * Generator username guru — SATU SUMBER ATURAN untuk seed, migrasi, dan web admin.
 * Aturan: buang gelar, kata pertama + kata terakhir, inisial (<=2 huruf) digabung
 * kata tetangga, maks 18 char, lowercase huruf+titik.
 * Harus sinkron dgn genUsername() di client/src/pages/admin/AdminUsers.jsx.
 */
const TITLES = /,?\s*(M\.Pd\.?|M\.Pd\.I\.?|M\.Si\.?|S\.Pd\.?|S\.Pd\.I\.?|S\.Kom\.?|S\.Ag\.?|M\.M\.?|M\.Hum\.?|M\.Ed\.?|Dr\.?|Dra\.?|Drs\.?|Hj\.?|Lc\.?)\b/gi;

function genUsername(name) {
  if (!name) return '';
  const clean = String(name)
    .replace(TITLES, ' ')
    .replace(/\./g, ' ')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) return '';
  const words = clean.split(' ').filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 18);
  // maks 2 bagian: kata pertama + kata terakhir; inisial (<=2 huruf) digabung kata tetangga
  let first = words[0];
  if (first.length <= 2 && words.length >= 3) first = words[0] + words[1];
  let last = words[words.length - 1];
  if (last.length <= 2 && words.length >= 3) last = words[words.length - 2];
  return (first + '.' + last).slice(0, 18).replace(/\.$/, '');
}

module.exports = { genUsername };
