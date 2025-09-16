const HttpError = require('../../utils/HttpError');
const DriversRepo = require('../../repos/drivers.repo');
const DriverRequestsRepo = require('../../repos/driverRequests.repo');

exports.getProfile = async (req, res, next) => {
  const jwtId = Number(req.user?.id);
  const role  = String(req.user?.role || '').toLowerCase();
  if (!Number.isFinite(jwtId) || jwtId <= 0 || role !== 'driver') {
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  // 2) Αν υπάρχει :id στο route, πρέπει να ταιριάζει με το JWT id
  const paramId = req.params?.id != null ? Number(req.params.id) : null;
  if (paramId != null && Number.isFinite(paramId) && paramId !== jwtId) {
    return next(new HttpError('Δεν έχετε δικαίωμα πρόσβασης σε αυτό το προφίλ.', 403));
  }

  let row;
  try {
    row = await DriversRepo.findById(jwtId);
  } catch (e) {
    return next(e);
  }
  if (!row) return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));

  return res.json({
    success: true,
    data: {
      driver: {
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
      }
    }
  });
};


exports.updateProfile = async (req, res, next) => {
  const driverId = Number(req.user?.id);
  if (!driverId) {
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  // Τρέχων driver από DB
  let cur;
  try { cur = await DriversRepo.findById(driverId); } catch (e) { return next(e); }
  if (!cur) return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));

  // Μόνο όσα στάλθηκαν
  const norm = (s) => (typeof s === 'string' ? s.trim() : undefined);
  const bodyVals = {
    firstName: norm(req.body?.firstName),
    lastName:  norm(req.body?.lastName),
    email:     norm(req.body?.email),
    phone:     norm(req.body?.phone),
    carNumber: norm(req.body?.carNumber)
  };
  const provided = {};
  for (const [k, v] of Object.entries(bodyVals)) {
    if (typeof v !== 'undefined') provided[k] = v;
  }
  if (Object.keys(provided).length === 0) {
    return next(new HttpError('Δεν δώσατε αλλαγές.', 400));
  }

  // Υπάρχον ανοιχτό αίτημα;
  let existing;
  try { existing = await DriverRequestsRepo.findOpenByDriverId(driverId); } catch (e) { return next(e); }

  // Uniqueness για email ΜΟΝΟ αν στέλνεται τώρα ΚΑΙ διαφέρει από DB
  if (Object.prototype.hasOwnProperty.call(provided, 'email') && provided.email !== cur.email) {
    try {
      const exists = await DriversRepo.findByEmail(provided.email);
      if (exists && Number(exists.id) !== Number(driverId)) {
        return next(new HttpError('Αυτό το email οδηγού χρησιμοποιείται ήδη.', 409));
      }
    } catch (e) { return next(e); }
  }

  if (existing) {
    // Merge/update: για κάθε provided πεδίο
    // - αν ίσο με DB ⇒ null (αφαίρεση από request)
    // - αλλιώς ⇒ νέα τιμή
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(provided, 'firstName')) {
      patch.firstName = (provided.firstName === cur.first_name) ? null : provided.firstName;
    }
    if (Object.prototype.hasOwnProperty.call(provided, 'lastName')) {
      patch.lastName = (provided.lastName === cur.last_name) ? null : provided.lastName;
    }
    if (Object.prototype.hasOwnProperty.call(provided, 'email')) {
      patch.email = (provided.email === cur.email) ? null : provided.email;
    }
    if (Object.prototype.hasOwnProperty.call(provided, 'phone')) {
      patch.phone = (provided.phone === cur.phone) ? null : provided.phone;
    }
    if (Object.prototype.hasOwnProperty.call(provided, 'carNumber')) {
      patch.carNumber = (provided.carNumber === cur.car_number) ? null : provided.carNumber;
    }

    let updated;
    try {
      updated = await DriverRequestsRepo.updateByIdAllowNull(existing.id, patch);
    } catch (e) { return next(e); }

    // Αν άδειασαν όλα τα πεδία → διαγραφή αιτήματος (ακυρώθηκε)
    if (DriverRequestsRepo.isEmptyRequestRow(updated)) {
      try { await DriverRequestsRepo.deleteById(existing.id); } catch (e) { return next(e); }
      return res.status(200).json({
        success: true,
        message: 'Το αίτημά σας δεν έχει πλέον αλλαγές και ακυρώθηκε.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Το αίτημά σας ενημερώθηκε.',
      data: {
        request: {
          id: String(updated.id),
          driverId: String(updated.driver_id),
          firstName: updated.first_name ?? null,
          lastName:  updated.last_name ?? null,
          email:     updated.email ?? null,
          phone:     updated.phone ?? null,
          carNumber: updated.car_number ?? null,
          createdAt: updated.created_at
        }
      }
    });
  }

  // Δεν υπάρχει αίτημα → δημιουργούμε ΜΟΝΟ ό,τι διαφέρει από DB
  const diff = {};
  if (Object.prototype.hasOwnProperty.call(provided, 'firstName') && provided.firstName !== cur.first_name) diff.firstName = provided.firstName;
  if (Object.prototype.hasOwnProperty.call(provided, 'lastName')  && provided.lastName  !== cur.last_name)  diff.lastName  = provided.lastName;
  if (Object.prototype.hasOwnProperty.call(provided, 'email')     && provided.email     !== cur.email)      diff.email     = provided.email;
  if (Object.prototype.hasOwnProperty.call(provided, 'phone')     && provided.phone     !== cur.phone)      diff.phone     = provided.phone;
  if (Object.prototype.hasOwnProperty.call(provided, 'carNumber') && provided.carNumber !== cur.car_number) diff.carNumber = provided.carNumber;

  if (Object.keys(diff).length === 0) {
    return next(new HttpError('Δεν έχετε κάνει καμία αλλαγή στα στοιχεία.', 400));
  }

  let created;
  try { created = await DriverRequestsRepo.insert(driverId, diff); } catch (e) { return next(e); }

  return res.status(201).json({
    success: true,
    message: 'Το αίτημά σας καταχωρήθηκε και αναμένει έγκριση από τον διαχειριστή.',
    data: {
      request: {
        id: String(created.id),
        driverId: String(created.driver_id),
        firstName: created.first_name ?? null,
        lastName:  created.last_name ?? null,
        email:     created.email ?? null,
        phone:     created.phone ?? null,
        carNumber: created.car_number ?? null,
        createdAt: created.created_at
      }
    }
  });
};