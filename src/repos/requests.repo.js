const { pool } = require('../db/pool');
const HttpError = require('../utils/HttpError');

async function listOpen() {
  try {
    const sql = `
      SELECT
        r.id,
        r.driver_id,
        r.requested_first_name,
        r.requested_last_name,
        r.requested_email,
        r.requested_phone,
        r.requested_car_number,
        r.created_at,

        d.first_name AS current_first_name,
        d.last_name  AS current_last_name,
        d.email      AS current_email,
        d.phone      AS current_phone,
        d.car_number AS current_car_number
      FROM public.requests r
      JOIN public.drivers d ON d.id = r.driver_id
      ORDER BY r.created_at DESC, r.id DESC
    `;
    const { rows } = await pool.query(sql);
    return rows;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση αιτημάτων οδηγών.', 500);
  }
}

async function getById(id) {
  try {
    const sql = `
      SELECT
        r.id,
        r.driver_id,
        r.requested_first_name,
        r.requested_last_name,
        r.requested_email,
        r.requested_phone,
        r.requested_car_number,
        r.created_at,

        d.first_name AS current_first_name,
        d.last_name  AS current_last_name,
        d.email      AS current_email,
        d.phone      AS current_phone,
        d.car_number AS current_car_number
      FROM public.requests r
      JOIN public.drivers d ON d.id = r.driver_id
      WHERE r.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση του αιτήματος οδηγού.', 500);
  }
}

async function deleteById(id, client = null) {
  try {
    const runner = client || pool;
    const { rowCount } = await runner.query(`DELETE FROM public.requests WHERE id=$1`, [id]);
    return rowCount > 0;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά τη διαγραφή αιτήματος οδηγού.', 500);
  }
}

module.exports = { listOpen, getById, deleteById };