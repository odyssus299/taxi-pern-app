const HttpError = require('../../utils/HttpError');
const { pool } = require('../../db/pool');
// const RidesRepo = require('../../repos/rides.repo');
// const ReviewsRepo = require('../../repos/reviews.repo');

// GET /api/public/reviews/validate/:token
exports.validateToken = async (req, res, next) => {
  const token = String(req.params.token || '').trim();

  const sql = `
    SELECT
      r.id AS ride_id,
      r.driver_id,
      r.review_submitted,
      r.review_token_expires_at,
      d.first_name, d.last_name, d.car_number
    FROM public.rides r
    JOIN public.drivers d ON d.id = r.driver_id
    WHERE r.review_token = $1
    LIMIT 1
  `;

  let row;
  try {
    const { rows } = await pool.query(sql, [token]);
    row = rows[0];
  } catch (_e) {
    return next(new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση αξιολόγησης.', 500));
  }

  if (!row) {
    return res.status(404).json({ success: false, message: 'Μη έγκυρο link αξιολόγησης.' });
  }

  // Έχει ήδη υποβληθεί;
  if (row.review_submitted) {
    return res.status(410).json({ success: false, message: 'Η αξιολόγηση έχει ήδη υποβληθεί.' });
  }

  // Έχει λήξει;
  if (row.review_token_expires_at && new Date(row.review_token_expires_at) < new Date()) {
    return res.status(410).json({ success: false, message: 'Το link αξιολόγησης έχει λήξει.' });
  }

  return res.json({
    success: true,
    data: {
      rideId: String(row.ride_id),
      driverId: String(row.driver_id),
      driverFirstName: row.first_name,
      driverLastName: row.last_name,
      carNumber: row.car_number
    }
  });
};

// POST /api/public/reviews
// body: { driverId, reviewToken, rating (1-5), comment?, termsAccepted:true }
exports.submit = async (req, res, next) => {
  const driverId = parseInt(String(req.body?.driverId), 10);
  const reviewToken = String(req.body?.reviewToken || '').trim();
  const rating = parseInt(String(req.body?.rating), 10);
  const comment = (req.body?.comment || '').toString().trim();
  const termsAccepted = req.body?.termsAccepted === true;

  if (!Number.isInteger(driverId) || driverId <= 0)
    return next(new HttpError('Μη έγκυρο driverId.', 400));
  if (!reviewToken)
    return next(new HttpError('Λείπει reviewToken.', 400));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return res.status(422).json({ success: false, errors: { rating: 'Η βαθμολογία πρέπει να είναι 1-5.' } });
  if (!termsAccepted)
    return res.status(422).json({ success: false, errors: { termsAccepted: 'Πρέπει να αποδεχθείτε τους όρους.' } });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Φέρνουμε τη διαδρομή από το token (κλειδώνουμε το row για αποφυγή race)
    const findSql = `
      SELECT id, driver_id, status, review_submitted, review_token_expires_at
      FROM public.rides
      WHERE review_token = $1
      LIMIT 1
      FOR UPDATE
    `;
    const { rows } = await client.query(findSql, [reviewToken]);
    const ride = rows[0];

    if (!ride) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Μη έγκυρο token.' });
    }

    if (ride.review_submitted) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Το token έχει ήδη χρησιμοποιηθεί.' });
    }

    if (ride.review_token_expires_at && new Date(ride.review_token_expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ success: false, message: 'Το link αξιολόγησης έχει λήξει.' });
    }

    if (ride.status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Η διαδρομή δεν έχει ολοκληρωθεί ακόμα.' });
    }

    if (parseInt(ride.driver_id, 10) !== driverId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Ο οδηγός δεν ταιριάζει με τη διαδρομή.' });
    }

    // 2) Καταχώριση review
    const insertReviewSql = `
      INSERT INTO public.reviews (ride_id, driver_id, rating, comment, created_at)
      VALUES ($1, $2, $3, NULLIF($4, ''), NOW())
      RETURNING id
    `;
    await client.query(insertReviewSql, [ride.id, driverId, rating, comment]);

    // 3) Μαρκάρουμε το token ως χρησιμοποιημένο
    await client.query(
      `UPDATE public.rides SET review_submitted = TRUE WHERE id = $1`,
      [ride.id]
    );

    // 4) Incremental update στα aggregates του οδηγού (χωρίς recalc από reviews)
    await client.query(
      `
      UPDATE public.drivers
      SET
        average_rating = ((average_rating * rating_count)::float + $2) / (rating_count + 1),
        rating_count   = rating_count + 1
      WHERE id = $1
      `,
      [driverId, rating]
    );

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Η αξιολόγηση καταχωρήθηκε.' });
  } catch (e) {
    await client.query('ROLLBACK');
    return next(new HttpError('Προέκυψε σφάλμα κατά την υποβολή αξιολόγησης.', 500));
  } finally {
    client.release();
  }
};
