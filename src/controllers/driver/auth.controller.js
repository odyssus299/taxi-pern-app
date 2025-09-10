const HttpError = require('../../utils/HttpError');
const DriversRepo = require('../../repos/drivers.repo');
const RidesRepo = require('../../repos/rides.repo');
const { pool } = require('../../db/pool');

exports.login = async (req, res, next) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');

  let row;
  try {
    row = await DriversRepo.findByEmail(email);
  } catch (e) {
    return next(e);
  }

  if (!row || String(row.password) !== password) {
    return next(new HttpError('Λάθος email ή κωδικός.', 401));
  }

  // >>> FIX: πρέπει να δημιουργήσουμε session με το custom helper σου
  if (typeof req.createSession !== 'function') {
    return next(new HttpError('Το session middleware δεν αρχικοποιήθηκε.', 500));
  }

  try {
    req.createSession({
      role: 'driver',
      driverId: String(row.id),
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name
    });
  } catch (_e) {
    return next(new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία συνεδρίας οδηγού.', 500));
  }

  try {
    if (row.status !== 'on_ride') {
      await DriversRepo.updateStatusById(row.id, 'available');
    }
    // Ξαναφόρτωσε όλα τα πεδία για σωστό response
    row = await DriversRepo.findById(row.id);
  } catch {
    return next(new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση της κατάστασης οδηγού.', 500));
  }

  const safe = {
    id: String(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    carNumber: row.car_number,
    status: row.status,
    average_rating: Number(row.average_rating),
    ratingCount: Number(row.rating_count),
    role: row.role
  };

  return res.json({ success: true, data: { driver: safe } });
};

// === LOGOUT ΜΕ ΙΔΙΑ ΛΟΓΙΚΗ ΜΕ ΤΟ MOCK (id param, on_ride block, reject pending, set offline) ===
exports.logout = async (req, res, next) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }

  // 1) Βρες οδηγό
  let driver;
  try {
    driver = await DriversRepo.findById(id);
  } catch (e) {
    return next(e);
  }
  if (!driver || driver.role !== 'driver') {
    return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
  }

  // 2) Μπλοκ αν είναι on_ride
  if (driver.status === 'on_ride') {
    return res.status(400).json({
      success: false,
      message: 'Δεν μπορείτε να αποσυνδεθείτε ενώ είστε σε διαδρομή.'
    });
  }

  // 2a) ΝΕΟ: Μπλοκ αν υπάρχει awaiting_response/pending πρόταση στον οδηγό
  try {
    // χρησιμοποιούμε το ήδη υπάρχον repo που φέρνει το “τρέχον” pending για τον οδηγό
    const pending = await RidesRepo.findLatestAwaitingForDriver(id);
    if (pending) {
      return res.status(400).json({
        success: false,
        message: 'Έχετε εκκρεμή πρόταση διαδρομής. Απαντήστε (Αποδοχή/Άρνηση) πριν αποσυνδεθείτε.'
      });
    }
  } catch (_e) {
    return next(new HttpError('Σφάλμα κατά τον έλεγχο εκκρεμούς πρότασης.', 500));
  }

  // 3) TRX: απόρριψη εκκρεμών rides + set offline
  const client = await pool.connect();
  let updated;
  try {
    await client.query('BEGIN');

    await RidesRepo.rejectPendingByDriverId(id, client);
    updated = await DriversRepo.setStatusById(id, 'offline', client);

    await client.query('COMMIT');
  } catch (_e) {
    await client.query('ROLLBACK');
    return next(new HttpError('Προέκυψε σφάλμα κατά την αποσύνδεση οδηγού.', 500));
  } finally {
    client.release();
  }

  const safe = {
    id: String(updated.id),
    firstName: updated.first_name,
    lastName: updated.last_name,
    email: updated.email,
    phone: updated.phone,
    carNumber: updated.car_number,
    status: updated.status,
    average_rating: Number(updated.average_rating),
    ratingCount: Number(updated.rating_count),
    role: updated.role
  };

  return res.json({
    success: true,
    message: 'Αποσυνδεθήκατε με επιτυχία.',
    data: { driver: safe }
  });
};
