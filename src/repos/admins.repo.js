const { pool } = require('../db/pool');
const HttpError = require('../utils/HttpError');

async function findByEmail(email) {
  try {
    const sql = `
      SELECT id, first_name, last_name, email, phone, password, created_at
      FROM admins
      WHERE lower(email) = lower($1)
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [email]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση διαχειριστή από email.', 500);
  }
}

async function getById(id) {
  try {
    const sql = `
      SELECT id, first_name, last_name, email, phone, password, created_at
      FROM admins
      WHERE id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση διαχειριστή από id.', 500);
  }
}

// why: Δυναμικό UPDATE μόνο για όσα fields ήρθαν στο body
async function updateById(id, patch) {
  const sets = [];
  const vals = [];
  const map = {
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    phone: 'phone',
    password: 'password'
  };

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (!map[k]) continue;
    sets.push(`${map[k]} = $${sets.length + 1}`);
    vals.push(v);
  }

  if (sets.length === 0) {
    throw new HttpError('Δεν δόθηκαν στοιχεία προς ενημέρωση.', 422);
  }

  try {
    const sql = `
      UPDATE admins
      SET ${sets.join(', ')}
      WHERE id = $${sets.length + 1}
      RETURNING id, first_name, last_name, email, phone, password, created_at
    `;
    const { rows } = await pool.query(sql, [...vals, id]);
    if (!rows[0]) return null;
    return rows[0];
  } catch (e) {
    // unique violation (email)
    if (e && e.code === '23505') {
      throw new HttpError('Αυτό το email χρησιμοποιείται ήδη.', 409);
    }
    throw new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση στοιχείων διαχειριστή.', 500);
  }
}

module.exports = { findByEmail, getById, updateById };