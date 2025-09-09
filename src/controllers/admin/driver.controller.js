const DriversRepo = require('../../repos/drivers.repo');
const RidesRepo = require('../../repos/rides.repo');
const HttpError = require('../../utils/HttpError');

function toApi(row) {
  const {
    id, first_name, last_name, email, phone, car_number,
    status, lat, lng, average_rating, rating_count, role, created_at
  } = row;
  return {
    id,
    firstName: first_name,
    lastName: last_name,
    email,
    phone,
    carNumber: car_number,
    password: undefined, // δεν επιστρέφουμε ποτέ password
    status,
    location: lat == null && lng == null ? null : { lat, lng },
    averageRating: Number(average_rating),
    ratingCount: Number(rating_count),
    role,
    created_at
  };
}

  
exports.getDriverById = async (req, res, next) => {
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }

  let row;
  try {
    row = await DriversRepo.findById(id);
  } catch (e) {
    return next(e);
  }
  if (!row) {
    return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));
  }

  return res.json({ success: true, data: { driver: toApi(row) } });
};

exports.updateDriver = async (req, res, next) => {
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }

  let current;
  try {
    current = await DriversRepo.findById(id);
  } catch (e) {
    return next(e);
  }
  if (!current) {
    return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));
  }

  const { firstName, lastName, email, phone, carNumber, password } = req.body || {};

  const str = (v) => (typeof v === 'string' ? v : null);
  const t   = (v) => (typeof v === 'string' ? v.trim() : null);

  // change detection (μόνο αν στάλθηκε string και διαφέρει από το current)
  const nameChanged =
    (t(firstName) !== null && t(firstName) !== current.first_name) ||
    (t(lastName)  !== null && t(lastName)  !== current.last_name);

  const emailChanged = t(email)      !== null && t(email)      !== current.email;
  const phoneChanged = t(phone)      !== null && t(phone)      !== current.phone;
  const carChanged   = t(carNumber)  !== null && t(carNumber)  !== (current.car_number || '');

  const incomingPwd = str(password);
  const passwordChanged =
    incomingPwd !== null && incomingPwd.length > 0 && incomingPwd !== current.password;

  if (!nameChanged && !emailChanged && !phoneChanged && !carChanged && !passwordChanged) {
    return next(new HttpError('Δεν έχετε κάνει καμία αλλαγή στα στοιχεία.', 400));
  }

  // --- Προ-έλεγχοι μοναδικότητας για καθαρά μηνύματα ---
  if (emailChanged) {
    try {
      const existsOther = await DriversRepo.existsEmailForOtherId(t(email), id);
      if (existsOther) {
        return next(new HttpError('Αυτό το email οδηγού χρησιμοποιείται ήδη.', 409));
      }
    } catch (e) {
      return next(e);
    }
  }

  if (carChanged) {
    try {
      let existsOtherCar = false;
      if (typeof DriversRepo.existsCarNumberForOtherId === 'function') {
        existsOtherCar = await DriversRepo.existsCarNumberForOtherId(t(carNumber), id);
      } else if (typeof DriversRepo.findByCarNumber === 'function') {
        const found = await DriversRepo.findByCarNumber(t(carNumber));
        existsOtherCar = !!(found && found.id !== id);
      }
      if (existsOtherCar) {
        return next(new HttpError('Αυτός ο αριθμός αυτοκινήτου χρησιμοποιείται ήδη.', 409));
      }
    } catch (e) {
      return next(e);
    }
  }

  // χτίζουμε ΜΟΝΟ τα πεδία που στάλθηκαν ΚΑΙ αλλάζουν
  const patch = {};
  if (t(firstName) !== null) patch.firstName = t(firstName);
  if (t(lastName)  !== null) patch.lastName  = t(lastName);
  if (emailChanged)          patch.email     = t(email);
  if (phoneChanged)          patch.phone     = t(phone);
  if (carChanged)            patch.carNumber = t(carNumber);
  if (passwordChanged)       patch.password  = incomingPwd; // (DEV ONLY — bcrypt αργότερα)

  let updated;
  try {
    updated = await DriversRepo.updateById(id, patch);
  } catch (e) {
    // Πιάσε unique constraint της DB για καθαρά μηνύματα
    if (e && e.code === '23505') {
      const c = (e.constraint || '').toLowerCase();
      if (c.includes('car') || c.includes('car_number')) {
        return next(new HttpError('Αυτός ο αριθμός αυτοκινήτου χρησιμοποιείται ήδη.', 409));
      }
      if (c.includes('mail') || c.includes('email')) {
        return next(new HttpError('Αυτό το email οδηγού χρησιμοποιείται ήδη.', 409));
      }
    }
    return next(e); // άλλο σφάλμα DB
  }
  if (!updated) {
    return next(new HttpError('Δεν ήταν δυνατή η ενημέρωση οδηγού.', 500));
  }

  const safe = {
    id: updated.id,
    firstName: updated.first_name,
    lastName:  updated.last_name,
    email: updated.email,
    phone: updated.phone,
    carNumber: updated.car_number,
    password: undefined,
    status: updated.status,
    location:
      updated.lat == null && updated.lng == null
        ? null
        : { lat: updated.lat, lng: updated.lng },
    averageRating: Number(updated.average_rating),
    ratingCount: Number(updated.rating_count),
    role: updated.role,
    created_at: updated.created_at,
  };

  return res.json({
    success: true,
    message: 'Οι αλλαγές αποθηκεύτηκαν επιτυχώς!',
    data: { driver: safe },
  });
};


exports.createDriver = async (req, res, next) => {
  const { firstName, lastName, email, phone, carNumber, password, status, lat, lng } = req.body || {};

  // 1) UNIQUE πινακίδα
  let plateExists;
  try {
    plateExists = await DriversRepo.findByCarNumber(String(carNumber || '').trim());
  } catch (e) {
    return next(e);
  }
  if (plateExists) {
    return next(new HttpError('Αυτός ο αριθμός κυκλοφορίας χρησιμοποιείται ήδη.', 409));
  }

  // 2) UNIQUE email
  let exists;
  try {
    exists = await DriversRepo.findByEmail(String(email || '').trim());
  } catch (e) {
    return next(e);
  }
  if (exists) {
    console.log('there')
    return next(new HttpError('Αυτό το email οδηγού χρησιμοποιείται ήδη.', 409));
  }

  // 3) Δημιουργία
  let row;
  try {
    row = await DriversRepo.create({
      firstName,
      lastName,
      email,
      phone,
      carNumber,
      password,               // DEV ONLY — bcrypt αργότερα
      status: status || 'offline',
      lat,
      lng
    });
  } catch (e) {
    return next(e);
  }
  if (!row) {
    return next(new HttpError('Δεν ήταν δυνατή η δημιουργία οδηγού.', 500));
  }

  return res.status(201).json({ success: true, data: { driver: toApi(row) } });
};

exports.deleteDriver = async (req, res, next) => {
  console.log('hi')
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  const idParam = req.params?.id;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }

  let deleted;
  try {
    deleted = await DriversRepo.deleteById(id);
  } catch (e) {
    return next(e); // «Προέκυψε σφάλμα κατά τη διαγραφή οδηγού.»
  }
  if (!deleted) {
    return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));
  }

  return res.json({ success: true });
};

exports.getMonthlyRideStats = async (req, res, next) => {
  // admin session
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }

  // επιβεβαίωση ότι υπάρχει οδηγός (ίδια λογική με τα άλλα endpoints)
  let driver;
  try {
    driver = await DriversRepo.findById(id);
  } catch (e) {
    return next(e);
  }
  if (!driver) {
    return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));
  }

  // months param (προαιρετικό ?months=6)
  const months = req.query?.months ? parseInt(String(req.query.months), 10) : 6;

  let rows;
  try {
    rows = await RidesRepo.monthlyStatsByDriver(id, months);
  } catch (e) {
    return next(e); // generic 500 από repo
  }

  // Μορφή απάντησης: [{ month: '2025-05-01', success: N, problematic: M, rejected: K }, ...]
  return res.json({ success: true, data: { months: rows } });
};
