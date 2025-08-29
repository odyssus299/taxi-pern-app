const { pool } = require('../db/pool');
const HttpError = require('../utils/HttpError');

async function listAll() {
  try {
    const sql = `
      SELECT
        p.id,
        p.driver_id,
        d.first_name,
        d.last_name,
        p.created_at
      FROM public.problems p
      JOIN public.drivers d ON d.id = p.driver_id
      ORDER BY p.created_at DESC, p.id DESC
    `;
    const { rows } = await pool.query(sql);
    return rows;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση λίστας προβλημάτων.', 500);
  }
}

async function getById(id) {
  try {
    const sql = `
      SELECT
        p.id,
        p.driver_id,
        d.first_name,
        d.last_name,
        p.description,
        p.created_at
      FROM public.problems p
      JOIN public.drivers d ON d.id = p.driver_id
      WHERE p.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση προβλήματος.', 500);
  }
}

async function create({ rideId, driverId, description }) {
  const sql = `
    INSERT INTO public.problems (ride_id, driver_id, description)
    VALUES ($1, $2, $3)
    RETURNING id, ride_id, driver_id, description, created_at
  `;
  try {
    const { rows } = await pool.query(sql, [rideId, driverId, description]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την καταγραφή προβλήματος.', 500);
  }
}

module.exports = { listAll, getById, create };