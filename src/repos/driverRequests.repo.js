const { pool } = require('../db/pool');
const HttpError = require('../utils/HttpError');

const TABLE = 'public.requests';
// why: χρησιμοποιούμε aliases για συμβατότητα με controller
const SELECT_PROJECTION = `
  id,
  driver_id,
  requested_first_name AS first_name,
  requested_last_name  AS last_name,
  requested_email      AS email,
  requested_phone      AS phone,
  requested_car_number AS car_number,
  created_at
`;

const CHANGE_COLS = ['first_name', 'last_name', 'email', 'phone', 'car_number'];

function isEmptyRequestRow(row) {
  if (!row) return true;
  return CHANGE_COLS.every((c) => row[c] == null);
}

async function findOpenByDriverId(driverId) {
  try {
    const { rows } = await pool.query(
      `SELECT ${SELECT_PROJECTION}
       FROM ${TABLE}
       WHERE driver_id = $1
       LIMIT 1`,
      [driverId]
    );
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση αιτήματος αλλαγής οδηγού.', 500);
  }
}

async function insert(driverId, patch) {
  // map JS -> SQL requested_* columns
  const map = {
    firstName: 'requested_first_name',
    lastName:  'requested_last_name',
    email:     'requested_email',
    phone:     'requested_phone',
    carNumber: 'requested_car_number'
  };

  const cols = ['driver_id'];
  const vals = ['$1'];
  const params = [driverId];
  let idx = 2;

  for (const [jsKey, col] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(patch, jsKey) && typeof patch[jsKey] !== 'undefined') {
      cols.push(col);
      vals.push(`$${idx}`);
      params.push(patch[jsKey]);
      idx++;
    }
  }

  if (cols.length === 1) {
    throw new HttpError('Δεν υπάρχουν αλλαγές προς καταχώριση.', 400);
  }

  const sql = `
    INSERT INTO ${TABLE} (${cols.join(',')})
    VALUES (${vals.join(',')})
    RETURNING ${SELECT_PROJECTION}
  `;

  try {
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
  } catch (_e) {
    console.log(_e)
    throw new HttpError('Προέκυψε σφάλμα κατά την καταχώριση αιτήματος αλλαγής.', 500);
  }
}

/**
 * Update συγκεκριμένα πεδία (δέχεται και null για "αφαίρεση").
 */
async function updateByIdAllowNull(requestId, patch) {
  const map = {
    firstName: 'requested_first_name',
    lastName:  'requested_last_name',
    email:     'requested_email',
    phone:     'requested_phone',
    carNumber: 'requested_car_number'
  };

  const sets = [];
  const params = [];
  let idx = 1;

  for (const [jsKey, col] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(patch, jsKey)) {
      sets.push(`${col} = $${idx++}`);
      params.push(patch[jsKey]); // μπορεί να είναι null (αφαίρεση)
    }
  }

  if (sets.length === 0) {
    throw new HttpError('Δεν υπάρχουν αλλαγές προς ενημέρωση.', 400);
  }

  params.push(requestId);
  const sql = `
    UPDATE ${TABLE}
    SET ${sets.join(', ')}
    WHERE id = $${idx}
    RETURNING ${SELECT_PROJECTION}
  `;

  try {
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση αιτήματος αλλαγής.', 500);
  }
}

async function deleteById(requestId) {
  try {
    await pool.query(`DELETE FROM ${TABLE} WHERE id = $1`, [requestId]);
  } catch (_e) {
    throw new HttpError('Προέκυψε σφάλμα κατά τη διαγραφή αιτήματος αλλαγής.', 500);
  }
}

module.exports = {
  findOpenByDriverId,
  insert,
  updateByIdAllowNull,
  deleteById,
  isEmptyRequestRow
};