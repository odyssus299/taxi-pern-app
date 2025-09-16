const { pool } = require('../db/pool');
const HttpError = require('../utils/HttpError');

async function updateStatusById(driverId, nextStatus) {
  // why: κλείδωμα τιμών όπως χρησιμοποιούνται στο UI
  const allowed = new Set(['available', 'on_ride', 'offline']);
  if (!allowed.has(nextStatus)) {
    throw new HttpError('Μη έγκυρη αλλαγή κατάστασης οδηγού.', 400);
  }
  const sql = `
    UPDATE public.drivers
    SET status = $2
    WHERE id = $1
    RETURNING id, status
  `;
  try {
    const { rows } = await pool.query(sql, [driverId, nextStatus]);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση κατάστασης οδηγού.', 500);
  }
}

async function getAll() {
    try {
      const sql = `
        SELECT id, first_name, last_name, email, phone, car_number,
               status, lat, lng, average_rating, rating_count, role, created_at
        FROM drivers
        WHERE role = 'driver'
        ORDER BY created_at DESC, id DESC
      `;
      const { rows } = await pool.query(sql);
      return rows;
    } catch (_e) {
      throw new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση οδηγών.', 500);
    }
  }

async function listByFullName({ search } = {}) {
    const q = String(search || '').trim();
    if (!q || q.length < 4) {
      try {
        const { rows } = await pool.query(`
          SELECT id, first_name, last_name, email, phone, car_number,
                 status, lat, lng, average_rating, rating_count, role, created_at
          FROM drivers
          WHERE role = 'driver'
          ORDER BY created_at DESC, id DESC
        `);
        return rows;
      } catch {
        throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγών.', 500);
      }
    }
  
    const like = `%${q}%`;
  
    // Προσπάθεια με unaccent
    try {
      const sqlAcc = `
        SELECT id, first_name, last_name, email, phone, car_number,
               status, lat, lng, average_rating, rating_count, role, created_at
        FROM drivers
        WHERE role = 'driver'
          AND lower(unaccent(first_name || ' ' || last_name)) LIKE lower(unaccent($1))
        ORDER BY created_at DESC, id DESC
      `;
      const { rows } = await pool.query(sqlAcc, [like]);
      return rows;
    } catch (e) {
      if (e && e.code !== '42883') { // undefined function
        throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγών.', 500);
      }
    }
  
    // Fallback χωρίς unaccent
    try {
      const sql = `
        SELECT id, first_name, last_name, email, phone, car_number,
               status, lat, lng, average_rating, rating_count, role, created_at
        FROM drivers
        WHERE role = 'driver'
          AND lower(first_name || ' ' || last_name) LIKE lower($1)
        ORDER BY created_at DESC, id DESC
      `;
      const { rows } = await pool.query(sql, [like]);
      return rows;
    } catch {
      throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγών.', 500);
    }
  }

async function findByEmail(email) {
  try {
    const sql = `
      SELECT id, first_name, last_name, email, phone, car_number, password,
             status, lat, lng, average_rating, rating_count, role, created_at
      FROM drivers
      WHERE lower(email) = lower($1)
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [email]);
    return rows[0] || null;
  } catch (_e) {
    console.log(_e)
    throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγού από email.', 500);
  }
}

async function create(driver) {
    const {
      firstName, lastName, email, phone, carNumber,
      password, status = 'offline', lat = null, lng = null
    } = driver;
  
    // προσοχή: strings τύπου "40,939" → NaN. Αν βγει NaN, το κάνουμε null για να μην σκάσει το CHECK.
    const latNum = lat === undefined || lat === null || lat === '' ? null : Number(lat);
    const lngNum = lng === undefined || lng === null || lng === '' ? null : Number(lng);
    const latSafe = Number.isFinite(latNum) ? latNum : null;
    const lngSafe = Number.isFinite(lngNum) ? lngNum : null;
  
    try {
      const sql = `
        INSERT INTO drivers
        (first_name, last_name, email, phone, car_number, password, status, lat, lng)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, first_name, last_name, email, phone, car_number, password,
                  status, lat, lng, average_rating, rating_count, role, created_at
      `;
      const params = [firstName, lastName, email, phone, carNumber, password, status, latSafe, lngSafe];
      const { rows } = await pool.query(sql, params);
      return rows[0] || null;
    } catch (e) {
      if (e && e.code === '23505') {
        throw new HttpError('Αυτό το email οδηγού χρησιμοποιείται ήδη.', 409);
      }
      throw new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία οδηγού.', 500);
    }
  }

  async function deleteById(id) {
    try {
      const { rows } = await pool.query(`DELETE FROM drivers WHERE id = $1 RETURNING id`, [id]);
      return !!rows[0];
    } catch {
      throw new HttpError('Προέκυψε σφάλμα κατά τη διαγραφή οδηγού.', 500);
    }
  }

  async function findById(id) {
    try {
      const sql = `
        SELECT id, first_name, last_name, email, phone, car_number, password,
               status, lat, lng, average_rating, rating_count, role, created_at
        FROM drivers
        WHERE id = $1 AND role = 'driver'
        LIMIT 1
      `;
      const { rows } = await pool.query(sql, [id]);
      return rows[0] || null;
    } catch {
      throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγού.', 500);
    }
  }

  async function existsEmailForOtherId(email, id) {
    try {
      const sql = `
        SELECT 1
        FROM drivers
        WHERE lower(email) = lower($1) AND id <> $2
        LIMIT 1
      `;
      const { rows } = await pool.query(sql, [email, id]);
      return !!rows[0];
    } catch {
      throw new HttpError('Προέκυψε σφάλμα κατά τον έλεγχο μοναδικότητας email.', 500);
    }
  }

  async function updateById(id, fields) {
    // Επιτρέπουμε μόνο συγκεκριμένα πεδία
    const map = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      carNumber: 'car_number',
      password: 'password',
      status: 'status',
      lat: 'lat',
      lng: 'lng'
    };
  
    const set = [];
    const params = [];
    let i = 1;
  
    // lat/lng coercion
    const coerce = (v, isLatLng = false) => {
      if (!isLatLng) return v;
      if (v === undefined || v === null || v === '') return null;
      const num = Number(v);
      return Number.isFinite(num) ? num : null;
    };
  
    for (const [k, v] of Object.entries(fields || {})) {
      if (!(k in map)) continue;
      const col = map[k];
      const isLatLng = (k === 'lat' || k === 'lng');
      const val = isLatLng ? coerce(v, true) : v;
      set.push(`${col} = $${i++}`);
      params.push(val);
    }
  
    if (set.length === 0) {
      // Καμία αλλαγή προς DB
      try {
        const current = await findById(id);
        return current; // επιστρέφουμε το υπάρχον state
      } catch {
        throw new HttpError('Προέκυψε σφάλμα κατά την ανάγνωση οδηγού.', 500);
      }
    }
  
    try {
      const sql = `
        UPDATE drivers
        SET ${set.join(', ')}
        WHERE id = $${i} AND role = 'driver'
        RETURNING id, first_name, last_name, email, phone, car_number, password,
                  status, lat, lng, average_rating, rating_count, role, created_at
      `;
      params.push(id);
      const { rows } = await pool.query(sql, params);
      return rows[0] || null;
    } catch (e) {
      if (e && e.code === '23505') {
        // π.χ. unique lower(email)
        throw new HttpError('Αυτό το email οδηγού χρησιμοποιείται ήδη.', 409);
      }
      console.log(e)
      throw new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση οδηγού.', 500);
    }
  }

  async function setStatusById(id, status, client = null) {
    try {
      const runner = client || pool;
      const sql = `
        UPDATE public.drivers
        SET status = $2
        WHERE id = $1
        RETURNING id, first_name, last_name, email, phone, car_number,
                  status, lat, lng, average_rating, rating_count, role, created_at
      `;
      const { rows } = await runner.query(sql, [id, status]);
      return rows[0] || null;
    } catch (_e) {
      throw new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση κατάστασης οδηγού.', 500);
    }
  }

  async function findNearestAvailable(lat, lng, limit = 10) {
    const sql = `
      SELECT
        d.id, d.first_name, d.last_name, d.email, d.phone, d.car_number,
        d.status, d.lat, d.lng, d.average_rating, d.rating_count, d.role, d.created_at,
        (
          2 * 6371 * asin(
            sqrt(
              pow(sin(radians(($1 - d.lat)) / 2), 2) +
              cos(radians(d.lat)) * cos(radians($1)) *
              pow(sin(radians(($2 - d.lng)) / 2), 2)
            )
          )
        ) AS dist_km
      FROM public.drivers d
      WHERE d.status = 'available'
        AND d.lat IS NOT NULL
        AND d.lng IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.ride_candidates rc
          JOIN public.rides r ON r.id = rc.ride_id
          WHERE rc.driver_id = d.id
            AND rc.status   = 'awaiting_response'
            AND r.status    = 'pending'
            -- θεωρούμε ενεργή την πρόταση όσο δεν έχει απαντηθεί/λήξει
            AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
        )
      ORDER BY dist_km ASC
      LIMIT $3
    `;
    try {
      const { rows } = await pool.query(sql, [lat, lng, limit]);
      return rows;
    } catch {
      throw new HttpError('Προέκυψε σφάλμα κατά την εύρεση κοντινών οδηγών.', 500);
    }
  }
  

  async function findByCarNumber(carNumber) {
    const plate = String(carNumber || '').trim();
    if (!plate) return null;
    try {
      const { rows } = await pool.query(
        'SELECT id, first_name, last_name, email, phone, car_number FROM public.drivers WHERE car_number = $1 LIMIT 1',
        [plate]
      );
      return rows[0] || null;
    } catch (_e) {
      throw new HttpError('Προέκυψε σφάλμα κατά τον έλεγχο πινακίδας.', 500);
    }
  }

  // ΝΕΟ: ενημέρωση θέσης οδηγού από WS pong
async function updatePosition(driverId, lat, lng) {
    const sql = `
      UPDATE public.drivers
      SET lat = $2, lng = $3
      WHERE id = $1
      RETURNING id, lat, lng
    `;
    try {
      const { rows } = await pool.query(sql, [driverId, lat, lng]);
      return rows[0] || null;
    } catch (_e) {
      throw new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση θέσης οδηγού.', 500);
    }
  }
  
  

module.exports = { findByEmail, setStatusById, findById, existsEmailForOtherId, create, updateById, listByFullName, deleteById, getAll, updateStatusById, findNearestAvailable, findByCarNumber, updatePosition };