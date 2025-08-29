const { pool } = require('../db/pool');
const HttpError = require('../utils/HttpError');

async function findByEmail(email) {
  try {
    const sql = `
      SELECT id, first_name, last_name, email, phone, password, role, created_at
      FROM public.users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [email]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση χρήστη από email.', 500);
  }
}

async function findById(id) {
  try {
    const sql = `
      SELECT id, first_name, last_name, email, phone, password, role, created_at
      FROM public.users
      WHERE id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση χρήστη.', 500);
  }
}

async function create(user) {
  const { firstName, lastName, email, phone, password, role = 'user' } = user;
  try {
    const sql = `
      INSERT INTO public.users (first_name, last_name, email, phone, password, role)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, first_name, last_name, email, phone, password, role, created_at
    `;
    const params = [firstName, lastName, email, phone, password, role];
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
  } catch (e) {
    if (e && e.code === '23505') {
      throw new HttpError('Αυτό το email χρήστη χρησιμοποιείται ήδη.', 409); // UNIQUE violation
    }
    if (String(e?.message || '').includes('users_email_ck')) {
      throw new HttpError('Το email δεν είναι έγκυρο.', 422);
    }
    if (String(e?.message || '').includes('users_phone_ck')) {
      throw new HttpError('Το τηλέφωνο δεν είναι έγκυρο.', 422);
    }
    throw new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία χρήστη.', 500);
  }
}

async function updateById(id, fields) {
    // only set provided keys
    const set = [];
    const params = [];
    let i = 1;
  
    if (fields.firstName !== undefined) { set.push(`first_name = $${i++}`); params.push(fields.firstName); }
    if (fields.lastName  !== undefined) { set.push(`last_name  = $${i++}`); params.push(fields.lastName);  }
    if (fields.email     !== undefined) { set.push(`email      = $${i++}`); params.push(fields.email);     }
    if (fields.phone     !== undefined) { set.push(`phone      = $${i++}`); params.push(fields.phone);     }
    if (fields.password  !== undefined) { set.push(`password   = $${i++}`); params.push(fields.password);  }
  
    if (set.length === 0) {
      // τίποτα να αλλάξει — επιστρέφουμε την τρέχουσα κατάσταση
      return await findById(id);
    }
  
    const sql = `
      UPDATE public.users
         SET ${set.join(', ')}
       WHERE id = $${i}
       RETURNING id, first_name, last_name, email, phone, password, role, created_at
    `;
    params.push(id);
  
    try {
      const { rows } = await pool.query(sql, params);
      return rows[0] || null;
    } catch (e) {
      if (e && e.code === '23505') {
        // UNIQUE (lower(email))
        throw new HttpError('Αυτό το email χρήστη χρησιμοποιείται ήδη.', 409);
      }
      const msg = String(e?.message || '');
      if (msg.includes('users_email_ck'))  throw new HttpError('Το email δεν είναι έγκυρο.', 422);
      if (msg.includes('users_phone_ck'))  throw new HttpError('Το τηλέφωνο δεν είναι έγκυρο.', 422);
      throw new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση χρήστη.', 500);
    }
  }

module.exports = { findByEmail, findById, create, updateById };