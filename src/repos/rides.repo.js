const { pool } = require('../db/pool');
const HttpError = require('../utils/HttpError');
const DriversRepo = require('./drivers.repo');
const crypto = require('crypto');

/**
 * Επιστρέφει στατιστικά ανά μήνα (τελευταίοι N μήνες) για έναν οδηγό.
 * success: completed
 * rejected: canceled OR (pending && age>=10s)
 * problematic: ongoing
 */

function makeReviewToken() {
  // περνάει το CHECK σας: [A-Za-z0-9_-]+ και μήκος > 6
  return 'rev_' + crypto.randomBytes(12).toString('hex');
}

function getTtlSec() {
  const n = Number(process.env.RIDE_AWAIT_TTL_SEC || 11);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

async function rejectPendingByDriverId(driverId, client = null) {
  try {
    const runner = client || pool;
    // why: ακυρώνουμε εκκρεμή (pending) αιτήματα προς τον οδηγό κατά το logout
    await runner.query(
      `UPDATE public.rides
       SET status = 'rejected'
       WHERE driver_id = $1 AND status = 'pending'`,
      [driverId]
    );
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την απόρριψη εκκρεμών διαδρομών του οδηγού.', 500);
  }
}

async function monthlyStatsByDriver(driverId) {
    try {
      const sql = `
        WITH params AS (
          SELECT date_trunc('month', now())::date AS start_month,
                 6::int AS months
        ),
        months AS (
          SELECT (p.start_month - (gs * interval '1 month'))::date AS month
          FROM params p, generate_series(0, p.months - 1) AS gs
        ),
        agg AS (
          SELECT
            date_trunc('month', r.created_at)::date AS month,
            SUM((r.status = 'completed')::int)::int   AS success,
            SUM((r.status = 'rejected')::int)::int    AS rejected,
            SUM((r.status = 'problematic')::int)::int AS problematic
          FROM public.rides r
          JOIN params p ON TRUE
          WHERE r.driver_id = $1
            AND r.created_at >= (p.start_month - (p.months - 1) * interval '1 month')
          GROUP BY 1
        )
        SELECT to_char(m.month, 'YYYY-MM') AS month,
               COALESCE(a.success, 0)::int      AS success,
               COALESCE(a.rejected, 0)::int     AS rejected,
               COALESCE(a.problematic, 0)::int  AS problematic
        FROM months m
        LEFT JOIN agg a ON a.month = m.month
        ORDER BY m.month;
      `;
      const { rows } = await pool.query(sql, [driverId]);
      return rows;
    } catch {
      throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση στατιστικών διαδρομών.', 500);
    }
  }

  async function monthlySuccessByDriver(driverId, months = 6) {
    try {
      const { rows } = await pool.query(
        `
        WITH months AS (
          SELECT to_char(date_trunc('month', (date_trunc('month', NOW()) - (i || ' month')::interval)), 'YYYY-MM') AS ym,
                 date_trunc('month', (date_trunc('month', NOW()) - (i || ' month')::interval))::timestamptz AS m_start,
                 (date_trunc('month', (date_trunc('month', NOW()) - (i || ' month')::interval)) + interval '1 month')::timestamptz AS m_end
          FROM generate_series(0, $2 - 1) AS g(i)
        )
        SELECT m.ym AS month,
               COALESCE(cnt.c_success, 0) AS success
        FROM months m
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS c_success
          FROM public.rides r
          WHERE r.driver_id = $1
            AND r.status = 'completed'
            AND r.created_at >= m.m_start
            AND r.created_at <  m.m_end
        ) cnt ON true
        ORDER BY m.m_start
        `,
        [driverId, months]
      );
      return rows.map(r => ({ month: r.month, success: Number(r.success) }));
    } catch (_e) {
      throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση στατιστικών διαδρομών οδηγού.', 500);
    }
  }

  async function insertPendingRide({
    driverId,
    pickupLat,
    pickupLng,
    pickupAddress,
    requesterFirstName,
    requesterLastName,
    requesterPhone
  }) {
    const sql = `
      INSERT INTO public.rides
        (driver_id, status, pickup_lat, pickup_lng, pickup_address,
         requester_first_name, requester_last_name, requester_phone, created_at)
      VALUES ($1,'pending',$2,$3,$4,$5,$6,$7,NOW())
      RETURNING id, driver_id, status,
                pickup_lat, pickup_lng, pickup_address,
                requester_first_name, requester_last_name, requester_phone,
                created_at
    `;
    const params = [
      driverId,
      pickupLat, pickupLng,
      pickupAddress || null,
      requesterFirstName || null,
      requesterLastName || null,
      requesterPhone || null
    ];
    try {
      const { rows } = await pool.query(sql, params);
      return rows[0] || null;
    } catch (_e) {
      throw new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία αιτήματος διαδρομής.', 500);
    }
  }
  
  /**
   * Τραβάει την πιο πρόσφατη εκκρεμή προσφορά για οδηγό. Μπορεί και άχρηστη
   */
  async function findLatestPendingForDriver(driverId) {
    const sql = `
      SELECT id, driver_id, status,
             pickup_lat, pickup_lng, pickup_address,
             requester_first_name, requester_last_name, requester_phone,
             created_at
      FROM public.rides
      WHERE driver_id = $1 AND status = 'pending'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;
    try {
      const { rows } = await pool.query(sql, [driverId]);
      return rows[0] || null;
    } catch (_e) {
      // why: generic μήνυμα για ασφάλεια
      throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση αιτήματος διαδρομής.', 500);
    }
  }

  async function updateStatusById(rideId, nextStatus) {
    // why: δεν επιτρέπουμε άκυρες τιμές (ταιριάζει με CHECK constraint)
    const allowed = new Set(['pending', 'ongoing', 'completed', 'rejected', 'problematic']);
    if (!allowed.has(nextStatus)) {
      throw new HttpError('Μη έγκυρη αλλαγή κατάστασης διαδρομής.', 400);
    }
  
    const sql = `
      UPDATE public.rides
      SET status = $2
      WHERE id = $1
      RETURNING id, driver_id, status
    `;
    try {
      const { rows } = await pool.query(sql, [rideId, nextStatus]);
      return rows[0] || null;
    } catch (_e) {
      throw new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση διαδρομής.', 500);
    }
  }

  async function findByIdOwnedByDriver(rideId, driverId) {
    const sql = `
      SELECT id, driver_id, status,
             pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
             created_at, completed_at
      FROM public.rides
      WHERE id = $1 AND driver_id = $2
      LIMIT 1
    `;
    try {
      const { rows } = await pool.query(sql, [rideId, driverId]);
      return rows[0] || null;
    } catch (_e) {
      throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση διαδρομής.', 500);
    }
  }
  

  async function completeRide(rideId, { dropoffLat = null, dropoffLng = null } = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      const { rows } = await client.query(
        `UPDATE public.rides
         SET status = 'completed',
             completed_at = NOW(),
             dropoff_lat = COALESCE($2, dropoff_lat),
             dropoff_lng = COALESCE($3, dropoff_lng)
         WHERE id = $1
         RETURNING id, driver_id, status, completed_at, dropoff_lat, dropoff_lng`,
        [rideId, dropoffLat, dropoffLng]
      );
      const updated = rows[0] || null;
  
      // Καθαρισμός ουράς για αυτό το ride
      await client.query(
        `DELETE FROM public.ride_candidates WHERE ride_id = $1`,
        [rideId]
      );
  
      await client.query('COMMIT');
      return updated;
    } catch (_e) {
      await client.query('ROLLBACK');
      throw new HttpError('Προέκυψε σφάλμα κατά την ολοκλήρωση διαδρομής.', 500);
    } finally {
      client.release();
    }
  }
  
  async function markProblematic(rideId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      const { rows } = await client.query(
        `UPDATE public.rides
         SET status = 'problematic'
         WHERE id = $1
         RETURNING id, driver_id, status`,
        [rideId]
      );
      const updated = rows[0] || null;
  
      await client.query(
        `DELETE FROM public.ride_candidates WHERE ride_id = $1`,
        [rideId]
      );
  
      await client.query('COMMIT');
      return updated;
    } catch (_e) {
      await client.query('ROLLBACK');
      throw new HttpError('Προέκυψε σφάλμα κατά την επισήμανση προβλήματος.', 500);
    } finally {
      client.release();
    }
  }

  // Δημιουργία pending ride + ουρά υποψηφίων οδηγών
  async function createWithCandidates({
    userId = null,
    requesterFirstName = null,
    requesterLastName  = null,
    requesterPhone     = null,
    requesterEmail     = null,
    pickupAddress,
    pickupLat,
    pickupLng,
    nearestLimit = 10
  }) {
    const lat = Number(pickupLat);
    const lng = Number(pickupLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new HttpError('Μη έγκυρες συντεταγμένες.', 400);
    }
  
    // 10 κοντινότεροι
    const candidates = await DriversRepo.findNearestAvailable(lat, lng, nearestLimit);
    if (!candidates || candidates.length === 0) {
      throw new HttpError('Δεν βρέθηκε διαθέσιμος οδηγός κοντά σας.', 404);
    }
    const first = candidates[0];
    const firstCandidateKm = Number(first.dist_km);
    const candidatesCount = candidates.length;
  
    const client = await pool.connect();
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const reviewToken = makeReviewToken();
  
        try {
          await client.query('BEGIN');
  
          const ttlSec = getTtlSec(); // πόσα δευτερόλεπτα ισχύει η προσφορά για τον 1ο
  
          // Logged-in: ΟΛΑ τα requester_* = NULL, μόνο user_id γεμίζει
          // Guest: γεμίζουν requester_* και user_id = NULL
          const insertRideSql = `
            INSERT INTO public.rides
              (driver_id, status, pickup_lat, pickup_lng, pickup_address,
               requester_first_name, requester_last_name, requester_phone, requester_email,
               user_id, review_token, review_submitted, created_at)
            VALUES (
              $1,'pending',$2,$3,$4,
              $5,$6,$7,$8,
              $9,$10,FALSE,NOW()
            )
            RETURNING id
          `;
          const isLoggedIn = userId != null;
  
          const params = [
            first.id,
            lat, lng, String(pickupAddress || '').trim(),
            isLoggedIn ? null : String(requesterFirstName || '').trim(),
            isLoggedIn ? null : String(requesterLastName  || '').trim(),
            isLoggedIn ? null : String(requesterPhone     || '').trim(),
            isLoggedIn ? null : String(requesterEmail     || '').trim(),
            isLoggedIn ? Number(userId) : null,
            reviewToken
          ];
  
          const { rows: rideRows } = await client.query(insertRideSql, params);
          const rideId = rideRows[0].id;
  
          // --- Υποψήφιοι οδηγοι ---
          // 1) ΠΡΩΤΟΣ: awaiting_response με assigned_at & expires_at
          await client.query(
            `
            INSERT INTO public.ride_candidates
              (ride_id, driver_id, position, status, assigned_at, expires_at, dist_km)
            VALUES ($1, $2, 1, 'awaiting_response', NOW(), NOW() + ($3 || ' seconds')::interval, $4)
            `,
            [rideId, first.id, String(ttlSec), Number(first.dist_km)]
          );
  
          // 2) ΟΙ ΥΠΟΛΟΙΠΟΙ: queued (χωρίς assigned_at / expires_at)
          if (candidates.length > 1) {
            const others = candidates.slice(1);
  
            const values = [];
            const candParams = [rideId];
            // ξεκινάμε params μετά το rideId
            let p = 2;
            others.forEach((c, idx) => {
              // ($rideId, $driverId, $position, 'queued', NULL, NULL, $distKm)
              values.push(`($1, $${p}, $${p + 1}, 'queued', NULL, NULL, $${p + 2})`);
              candParams.push(c.id, idx + 2, Number(c.dist_km));
              p += 3;
            });
  
            await client.query(
              `
              INSERT INTO public.ride_candidates
                (ride_id, driver_id, position, status, assigned_at, expires_at, dist_km)
              VALUES ${values.join(',')}
              `,
              candParams
            );
          }
  
          await client.query('COMMIT');
          return { rideId, firstCandidateKm, candidatesCount };
        } catch (e) {
          await client.query('ROLLBACK');
          if (e && e.code === '23505' && String(e.constraint || '').includes('review_token')) {
            // retry με νέο token
            continue;
          }
          if (e instanceof HttpError) throw e;
          throw new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία αιτήματος διαδρομής.', 500);
        }
      }
  
      throw new HttpError('Αποτυχία δημιουργίας token για αξιολόγηση.', 500);
    } finally {
      client.release();
    }
  }
  

// Βρες pending που είναι ανατεθειμένο σε συγκεκριμένο οδηγό (proposal)
async function pendingForDriver(driverId) {
  const sql = `
    SELECT
      r.id,
      r.status,
      r.pickup_lat,
      r.pickup_lng,
      r.pickup_address,
      r.created_at,
      r.user_id,
      -- aliases που χρησιμοποιούμε στο controller
      COALESCE(r.requester_first_name, u.first_name) AS customer_first_name,
      COALESCE(r.requester_last_name,  u.last_name)  AS customer_last_name,
      COALESCE(r.requester_phone,      u.phone)      AS customer_phone
      -- (αν χρειαστεί ποτέ) COALESCE(r.requester_email, u.email) AS customer_email
    FROM public.rides r
    LEFT JOIN public.users u ON u.id = r.user_id
    WHERE r.driver_id = $1
      AND r.status = 'pending'
    ORDER BY r.created_at DESC, r.id DESC   -- FIX: πιο πρόσφατο πρώτα
    LIMIT 1
  `;
  try {
    const { rows } = await pool.query(sql, [driverId]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση εκκρεμούς διαδρομής.', 500);
  }
}


// Απάντηση οδηγού (accept / reject) με προώθηση στον επόμενο
async function respond(driverId, response) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Βρες το pending ride που είναι “πάνω” στον οδηγό
    const findSql = `
      SELECT r.id AS ride_id, r.driver_id, r.status
      FROM public.rides r
      WHERE r.driver_id = $1 AND r.status = 'pending'
      ORDER BY r.created_at ASC
      LIMIT 1
    `;
    const { rows: rrows } = await client.query(findSql, [driverId]);
    const current = rrows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return { notFound: true };
    }

    // Τρέχων candidate (μόνο αν είναι ακόμη σε awaiting_response ΚΑΙ δεν έχει λήξει)
    const candSql = `
      SELECT id, position
      FROM public.ride_candidates
      WHERE ride_id = $1
        AND driver_id = $2
        AND status = 'awaiting_response'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;
    const { rows: crows } = await client.query(candSql, [current.ride_id, driverId]);
    const cand = crows[0];
    if (!cand) {
      await client.query('ROLLBACK');
      throw new HttpError('Το αίτημα δεν είναι διαθέσιμο για απάντηση.', 409);
    }

    if (response === 'accept') {
      // Μαρκάρουμε accepted, ξεκινάει διαδρομή
      await client.query(
        `UPDATE public.ride_candidates
         SET status='accepted', responded_at=NOW()
         WHERE id=$1`,
        [cand.id]
      );
      await client.query(
        `UPDATE public.rides
         SET status='ongoing'
         WHERE id=$1`,
        [current.ride_id]
      );
      await client.query(
        `UPDATE public.drivers
         SET status='on_ride'
         WHERE id=$1`,
        [driverId]
      );
      await client.query('COMMIT');
      return { accepted: true, rideId: current.ride_id };
    }

    // reject: μαρκάρουμε και προωθούμε στον επόμενο
    await client.query(
      `UPDATE public.ride_candidates
       SET status='rejected', responded_at=NOW()
       WHERE id=$1`,
      [cand.id]
    );

    // Βρες επόμενο queued
    const nextSql = `
      SELECT driver_id, position
      FROM public.ride_candidates
      WHERE ride_id = $1 AND status='queued'
      ORDER BY position ASC
      LIMIT 1
    `;
    const { rows: nrows } = await client.query(nextSql, [current.ride_id]);
    const next = nrows[0];

    if (!next) {
      // Εξαντλήθηκαν όλοι
      await client.query(
        `UPDATE public.rides SET status='rejected' WHERE id=$1`,
        [current.ride_id]
      );
      // Καθαρισμός ουράς αυτού του ride
      await client.query(
        `DELETE FROM public.ride_candidates WHERE ride_id = $1`,
        [current.ride_id]
      );

      await client.query('COMMIT');
      return { exhausted: true, rideId: current.ride_id };
    }

    // Αναθέτουμε στον επόμενο (ΝΕΟ: assigned_at + expires_at)
    const ttlSec = getTtlSec(); // π.χ. 10–15s από .env (RIDE_AWAIT_TTL_SEC)
    await client.query(
      `UPDATE public.ride_candidates
       SET status='awaiting_response',
           assigned_at=NOW(),
           expires_at=NOW() + ($3 || ' seconds')::interval
       WHERE ride_id=$1 AND driver_id=$2`,
      [current.ride_id, next.driver_id, String(ttlSec)]
    );
    await client.query(
      `UPDATE public.rides
       SET driver_id=$2
       WHERE id=$1`,
      [current.ride_id, next.driver_id]
    );

    await client.query('COMMIT');
    return { forwarded: true, rideId: current.ride_id, toDriverId: next.driver_id };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[respond][driverId=%s][response=%s] error:', driverId, response, e);
    if (e instanceof HttpError) throw e;
    throw new HttpError('Προέκυψε σφάλμα κατά την απάντηση σε αίτημα διαδρομής.', 500);
  } finally {
    client.release();
  }
}



async function findLatestAwaitingForDriver(driverId) {
  // alias για συμβατότητα με παλιό controller
  return pendingForDriver(driverId);
}

async function acceptByDriver(rideId, driverId) {
  const res = await respond(driverId, 'accept'); // χρησιμοποιεί το “τρέχον” pending του οδηγού
  if (res?.notFound) throw new HttpError('Δεν υπάρχει ανάθεση διαδρομής.', 404);
  if (!res?.accepted) throw new HttpError('Αποτυχία αποδοχής διαδρομής.', 409);
  // προαιρετικά: έλεγχος rideId ταύτισης
  if (Number(res.rideId) !== Number(rideId)) {
    // Δεν σπας τη ροή – μόνο ενημερωτικό
    // throw new HttpError('Mismatch rideId.', 409);
  }
  return res;
}

async function rejectByDriverAndAdvance(rideId, driverId) {
  const res = await respond(driverId, 'reject');
  if (res?.notFound) throw new HttpError('Δεν υπάρχει ανάθεση διαδρομής.', 404);
  // forwarded: προωθήθηκε σε επόμενο, exhausted: τελείωσαν οι υποψήφιοι
  return Boolean(res?.forwarded);
}

async function getReviewDeliveryDetails(rideId) {
  const sql = `
    SELECT
      r.id,
      r.status,
      r.review_token,
      r.review_submitted,
      r.user_id,
      r.requester_email,
      u.email AS user_email,
      d.id   AS driver_id,
      d.first_name AS driver_first_name,
      d.last_name  AS driver_last_name,
      d.car_number  AS driver_car_number
    FROM public.rides r
    JOIN public.drivers d ON d.id = r.driver_id
    LEFT JOIN public.users u ON u.id = r.user_id
    WHERE r.id = $1
    LIMIT 1
  `;
  try {
    const { rows } = await pool.query(sql, [rideId]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση στοιχείων email αξιολόγησης.', 500);
  }
}

async function markReviewSent(rideId, { ttlDays = 20 } = {}) {
  const days = Number.isFinite(Number(ttlDays)) ? Number(ttlDays) : 20;
  const sql = `
    UPDATE public.rides
    SET review_sent_at = NOW(),
        review_token_expires_at = NOW() + ($2 || ' days')::interval
    WHERE id = $1
    RETURNING id, review_token, review_sent_at, review_token_expires_at
  `;
  try {
    const { rows } = await pool.query(sql, [rideId, String(days)]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση λήξης αξιολόγησης.', 500);
  }
}

async function findByReviewToken(token) {
  const sql = `
    SELECT
      r.id, r.driver_id, r.status, r.review_submitted,
      d.first_name AS driver_first_name,
      d.last_name  AS driver_last_name,
      d.car_number AS driver_car_number
    FROM public.rides r
    JOIN public.drivers d ON d.id = r.driver_id
    WHERE r.review_token = $1
    LIMIT 1
  `;
  try {
    const { rows } = await pool.query(sql, [token]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση token.', 500);
  }
}

async function sweepExpiredAwaiting(limit = 200) {
  // Φέρνουμε λίστα ληγμένων "awaiting_response" με σειρά παλαιότητας.
  const { rows } = await pool.query(
    `
    SELECT rc.id, rc.ride_id, rc.driver_id
    FROM public.ride_candidates rc
    WHERE rc.status = 'awaiting_response'
      AND rc.expires_at <= NOW()
    ORDER BY rc.expires_at ASC
    LIMIT $1
    `,
    [limit]
  );

  let advanced = 0;

  for (const rc of rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ξανα-κλείδωσέ τον συγκεκριμένο candidate (αν στο μεταξύ άλλαξε, το SKIP LOCKED τον αφήνει)
      const { rows: lockRows } = await client.query(
        `
        SELECT id, ride_id, driver_id
        FROM public.ride_candidates
        WHERE id = $1 AND status = 'awaiting_response'
        FOR UPDATE SKIP LOCKED
        `,
        [rc.id]
      );
      if (lockRows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        continue;
      }

      // 1) Μαρκάρουμε τον τρέχοντα ως rejected
      await client.query(
        `UPDATE public.ride_candidates
         SET status='rejected', responded_at=NOW()
         WHERE id=$1`,
        [rc.id]
      );

      // 2) Βρίσκουμε επόμενο queued
      const { rows: nextRows } = await client.query(
        `
        SELECT driver_id
        FROM public.ride_candidates
        WHERE ride_id=$1 AND status='queued'
        ORDER BY position ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        `,
        [rc.ride_id]
      );

      if (nextRows.length === 0) {
        // Δεν υπάρχουν άλλοι -> κλείσε το ride ως rejected και καθάρισε την ουρά
        await client.query(
          `UPDATE public.rides SET status='rejected' WHERE id=$1`,
          [rc.ride_id]
        );
        await client.query(
          `DELETE FROM public.ride_candidates WHERE ride_id=$1`,
          [rc.ride_id]
        );
      } else {
        const nextDriverId = nextRows[0].driver_id;

        await client.query(
          `UPDATE public.ride_candidates
           SET status='awaiting_response',
               assigned_at=NOW(),
               expires_at=NOW() + ($2 || ' seconds')::interval
           WHERE ride_id=$1 AND driver_id=$3`,
          [rc.ride_id, String(getTtlSec()), nextDriverId]
        );
        await client.query(
          `UPDATE public.rides
           SET driver_id=$2
           WHERE id=$1`,
          [rc.ride_id, nextDriverId]
        );
      }

      await client.query('COMMIT');
      advanced++;
    } catch (_) {
      try { await client.query('ROLLBACK'); } catch {}
    } finally {
      client.release();
    }
  }

  return advanced; // πόσες προωθήθηκαν/έκλεισαν
}





  
  module.exports = { monthlyStatsByDriver, rejectPendingByDriverId, monthlySuccessByDriver, insertPendingRide, findLatestPendingForDriver, updateStatusById, findByIdOwnedByDriver, completeRide, markProblematic, pendingForDriver, createWithCandidates, findLatestAwaitingForDriver, acceptByDriver, rejectByDriverAndAdvance, findByReviewToken, markReviewSent, getReviewDeliveryDetails, markReviewSent, sweepExpiredAwaiting  };