const HttpError = require('../../utils/HttpError');
const RequestsRepo = require('../../repos/requests.repo');
const DriversRepo = require('../../repos/drivers.repo');
const { pool } = require('../../db/pool');

// regex όπως στα validators του router
const isEmail = (s) => /^\S+@\S+\.\S+$/.test(String(s || '').toLowerCase());
const isPhone = (s) => /^[0-9]{10,}$/.test(String(s || ''));
const isPlate = (s) => /^[Α-Ω]{3}-[0-9]{4}$/.test(String(s || ''));

// Λίστα open requests
exports.listRequests = async (req, res, next) => {
  const adminId = Number(req.user?.id);
  if (!adminId) return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));

  let items;
  try {
    items = await RequestsRepo.listOpen();
  } catch (e) {
    return next(e);
  }

  // shape συμβατό με front (παίρνει current + requested)
  return res.json({
    success: true,
    data: items.map(r => ({
      id: String(r.id),
      driverId: String(r.driver_id),
      current: {
        firstName: r.current_first_name,
        lastName:  r.current_last_name,
        email:     r.current_email,
        phone:     r.current_phone,
        carNumber: r.current_car_number
      },
      requested: {
        firstName: r.requested_first_name,
        lastName:  r.requested_last_name,
        email:     r.requested_email,
        phone:     r.requested_phone,
        carNumber: r.requested_car_number
      },
      createdAt: r.created_at
    }))
  });
};

// Προβολή ενός request
exports.getRequestById = async (req, res, next) => {
  const adminId = Number(req.user?.id);
  if (!adminId) return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));

  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό αιτήματος.', 400));
  }

  let r;
  try {
    r = await RequestsRepo.getById(id);
  } catch (e) {
    return next(e);
  }
  if (!r) {
    return next(new HttpError('Το αίτημα δεν βρέθηκε.', 404));
  }

  return res.json({
    success: true,
    data: {
      id: String(r.id),
      driverId: String(r.driver_id),
      current: {
        firstName: r.current_first_name,
        lastName:  r.current_last_name,
        email:     r.current_email,
        phone:     r.current_phone,
        carNumber: r.current_car_number
      },
      requested: {
        firstName: r.requested_first_name,
        lastName:  r.requested_last_name,
        email:     r.requested_email,
        phone:     r.requested_phone,
        carNumber: r.requested_car_number
      },
      createdAt: r.created_at
    }
  });
};

// Έγκριση αιτήματος: εφαρμόζουμε αλλαγές στον driver & διαγράφουμε το request
exports.approveRequest = async (req, res, next) => {
  const adminId = Number(req.user?.id);
  if (!adminId) return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));

  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό αιτήματος.', 400));
  }

  // Φόρτωσε αίτημα
  let r;
  try {
    r = await RequestsRepo.getById(id);
  } catch (e) {
    return next(e);
  }
  if (!r) return next(new HttpError('Το αίτημα δεν βρέθηκε.', 404));

  // Ετοίμασε updates μόνο με ό,τι όντως ζητήθηκε
  const updates = {};
  if (r.requested_first_name && r.requested_first_name.trim()) updates.firstName = r.requested_first_name.trim();
  if (r.requested_last_name && r.requested_last_name.trim())   updates.lastName  = r.requested_last_name.trim();
  if (r.requested_email && r.requested_email.trim())           updates.email     = r.requested_email.trim();
  if (r.requested_phone && r.requested_phone.trim())           updates.phone     = r.requested_phone.trim();
  if (r.requested_car_number && r.requested_car_number.trim()) updates.carNumber = r.requested_car_number.trim();

  // Αν δεν έχει τίποτα να αλλάξει, απλά σβήστο (business rule)
  const nothingToChange = Object.keys(updates).length === 0;

  // Validations (ίδια λογική με front)
  const fieldErrors = {};
  if (updates.firstName !== undefined && updates.firstName === '') fieldErrors.firstName = ['Το πεδίο είναι υποχρεωτικό.'];
  if (updates.lastName  !== undefined && updates.lastName  === '') fieldErrors.lastName  = ['Το πεδίο είναι υποχρεωτικό.'];
  if (updates.email     !== undefined && !isEmail(updates.email))  fieldErrors.email     = ['Το email δεν είναι έγκυρο.'];
  if (updates.phone     !== undefined && !isPhone(updates.phone))  fieldErrors.phone     = ['Το τηλέφωνο δεν είναι έγκυρο.'];
  if (updates.carNumber !== undefined && !isPlate(updates.carNumber)) fieldErrors.carNumber = ['Η πινακίδα δεν είναι έγκυρη.'];

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(422).json({ success: false, errors: fieldErrors });
  }

  // Email uniqueness αν αλλάζει
  if (updates.email && updates.email.toLowerCase() !== String(r.current_email).toLowerCase()) {
    try {
      const existing = await DriversRepo.findByEmail(updates.email);
      if (existing && String(existing.id) !== String(r.driver_id)) {
        return res.status(409).json({ success: false, message: 'Αυτό το email οδηγού χρησιμοποιείται ήδη.' });
      }
    } catch (e) {
      return next(e);
    }
  }

  // TRX: ενημέρωση driver + διαγραφή request
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!nothingToChange) {
      // why: ενημερώνουμε ΜΟΝΟ τα πεδία που υπάρχουν στο updates
      await DriversRepo.updateById(r.driver_id, updates, client);
    }

    await RequestsRepo.deleteById(id, client);

    await client.query('COMMIT');
  } catch (_e) {
    await client.query('ROLLBACK');
    return next(new HttpError('Προέκυψε σφάλμα κατά την έγκριση αιτήματος οδηγού.', 500));
  } finally {
    client.release();
  }

  return res.json({ success: true });
};

// Απόρριψη αιτήματος: απλή διαγραφή
exports.rejectRequest = async (req, res, next) => {
  const adminId = Number(req.user?.id);
  if (!adminId) return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));

  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό αιτήματος.', 400));
  }

  try {
    const ok = await RequestsRepo.deleteById(id);
    if (!ok) return next(new HttpError('Το αίτημα δεν βρέθηκε.', 404));
  } catch (e) {
    return next(e);
  }

  return res.json({ success: true });
};
