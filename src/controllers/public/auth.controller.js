const HttpError = require('../../utils/HttpError');
const UsersRepo = require('../../repos/users.repo');

function sanitizeUser(u) {
  const { password, ...rest } = u;
  return rest;
}

exports.register = async (req, res, next) => {
  const firstName = String(req.body?.firstName || '').trim();
  const lastName  = String(req.body?.lastName  || '').trim();
  const email     = String(req.body?.email     || '').trim();
  const phone     = String(req.body?.phone     || '').trim();
  const password  = String(req.body?.password  || '');

  // Προσδοκούμε validators από τα routes. Εδώ κάνουμε μόνο τα min business checks.
  try {
    // Duplicate email (case-insensitive)
    const exists = await UsersRepo.findByEmail(email);
    if (exists) {
      return next(new HttpError('Αυτό το email χρησιμοποιείται ήδη.', 409));
    }
  } catch (e) {
    console.log(e)
    return next(e);
  }

  // Δημιουργία χρήστη
  let row;
  try {
    row = await UsersRepo.create({ firstName, lastName, email, phone, password }); // bcrypt αργότερα
  } catch (e) {
    console.log(e)
    return next(e);
  }
  if (!row) {
    return next(new HttpError('Δεν ήταν δυνατή η δημιουργία χρήστη.', 500));
  }

  // Auto-login (session)
  if (typeof req.createSession !== 'function') {
    return next(new HttpError('Το session middleware δεν αρχικοποιήθηκε.', 500));
  }
  try {
    req.createSession({
      role: 'user',
      userId: String(row.id),
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name
    });
  } catch (_e) {
    console.log(_e)
    return next(new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία συνεδρίας χρήστη.', 500));
  }

  const safe = {
    id: String(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    created_at: row.created_at
  };

  return res.status(201).json({ success: true, data: { user: safe } });
};

exports.login = async (req, res, next) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');

  let row;
  try {
    row = await UsersRepo.findByEmail(email);
  } catch (e) {
    return next(e); // generic “Προέκυψε σφάλμα …”
  }

  if (!row || String(row.password) !== password) {
    return next(new HttpError('Λάθος email ή κωδικός.', 401));
  }

  if (typeof req.createSession !== 'function') {
    return next(new HttpError('Το session middleware δεν αρχικοποιήθηκε.', 500));
  }

  try {
    req.createSession({
      role: 'user',
      userId: String(row.id),
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name
    });
  } catch (_e) {
    return next(new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία συνεδρίας χρήστη.', 500));
  }

  const safe = {
    id: String(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role
  };
  return res.json({ success: true, data: { user: safe } });
};

exports.me = async (req, res, next) => {
  if (!req.session || req.session.role !== 'user') {
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }
  const id = parseInt(String(req.session.userId), 10);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  let row;
  try {
    row = await UsersRepo.findById(id);
  } catch (e) {
    return next(e);
  }
  if (!row) {
    return next(new HttpError('Ο χρήστης δεν βρέθηκε.', 404));
  }

  const safe = {
    id: String(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role
  };
  return res.json({ success: true, data: { user: safe } });
};

exports.logout = async (req, res, next) => {
  if (!req.session || req.session.role !== 'user') {
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  try {
    req.destroySession();
  } catch (_e) {
    return next(new HttpError('Προέκυψε σφάλμα κατά την αποσύνδεση χρήστη.', 500));
  }

  return res.json({ success: true, message: 'Αποσυνδεθήκατε με επιτυχία.' });
};