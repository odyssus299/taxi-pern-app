const { pool } = require('../db/pool');
const HttpError = require('../utils/HttpError');

async function listLatest(limit = 2) {
  try {
    const { rows } = await pool.query(
      `SELECT id, content, created_at
       FROM public.admin_messages
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση μηνυμάτων διαχειριστή.', 500);
  }
}

module.exports = { listLatest };