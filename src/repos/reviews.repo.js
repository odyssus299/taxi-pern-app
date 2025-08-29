const { pool } = require('../db/pool');
const HttpError = require('../utils/HttpError');

// Λίστα drivers για τη σελίδα "Κριτικές οδηγών" (χωρίς search)
async function listDriversForReviews() {
  try {
    const sql = `
      SELECT id, first_name, last_name, average_rating, rating_count
      FROM public.drivers
      WHERE role = 'driver'
      ORDER BY last_name ASC, first_name ASC, id ASC
    `;
    const { rows } = await pool.query(sql);
    return rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      average_rating: Number(r.average_rating),
      ratingCount: Number(r.rating_count)
    }));
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση οδηγών για κριτικές.', 500);
  }
}

/**
 * Reviews οδηγού με pagination (σταθερό 5/σελίδα στον caller).
 * Επιστρέφει { items, total }.
 */
async function listByDriverPaginated(driverId, page, pageSize) {
  const p = Number.isInteger(page) && page > 0 ? page : 1;
  const ps = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 5;
  const offset = (p - 1) * ps;

  try {
    const sql = `
      SELECT
        id,
        driver_id,
        rating,
        comment,
        created_at,
        COUNT(*) OVER() AS total
      FROM public.reviews
      WHERE driver_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3
    `;
    const { rows } = await pool.query(sql, [driverId, ps, offset]);

    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    const items = rows.map(r => ({
      id: r.id,
      driverId: r.driver_id,
      rating: Number(r.rating),
      comment: r.comment,
      createdAt: r.created_at
    }));

    return { items, total };
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση κριτικών οδηγού.', 500);
  }
}

async function insert({ rideId, driverId, rating, comment }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) εισαγωγή κριτικής
    const insSql = `
      INSERT INTO public.reviews (ride_id, driver_id, rating, comment, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `;
    const { rows } = await client.query(insSql, [rideId, driverId, rating, comment || null]);

    // 2) μαρκάρισμα ride ως review_submitted = true
    await client.query(
      `UPDATE public.rides SET review_submitted = TRUE WHERE id = $1`,
      [rideId]
    );

    // 3) ανανέωση metrics οδηγού
    const updDriverSql = `
      UPDATE public.drivers dr
      SET average_rating = COALESCE(sub.avg_rating, 0),
          rating_count   = COALESCE(sub.cnt, 0)
      FROM (
        SELECT driver_id, AVG(rating)::numeric(3,2) AS avg_rating, COUNT(*) AS cnt
        FROM public.reviews
        WHERE driver_id = $1
        GROUP BY driver_id
      ) sub
      WHERE dr.id = $1
    `;
    await client.query(updDriverSql, [driverId]);

    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw new HttpError('Προέκυψε σφάλμα κατά την υποβολή κριτικής.', 500);
  } finally {
    client.release();
  }
}

module.exports = { listDriversForReviews, listByDriverPaginated, insert };