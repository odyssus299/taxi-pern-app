const HttpError = require('../../utils/HttpError');
const UsersRepo = require('../../repos/users.repo');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');


function signToken(userId) {
  console.log(process.env.JWT_EXPIRES_IN)
  return jwt.sign(
    { userId, userRole: 'user' },
    process.env.JWT_SECRET || process.env.JWT_KEY,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
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

    return next(e);
  }

  // Δημιουργία χρήστη
  let row;
  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);
    row = await UsersRepo.create({ firstName, lastName, email, phone, password: passwordHash });
  } catch (e) {

    return next(new HttpError('Προέκυψε σφάλμα κατά την δημιουργία χρήστη.', 500));
  }
  if (!row) {
    return next(new HttpError('Δεν ήταν δυνατή η δημιουργία χρήστη.', 500));
  }

  // Auto-login (session)
  // if (typeof req.createSession !== 'function') {
  //   return next(new HttpError('Το session middleware δεν αρχικοποιήθηκε.', 500));
  // }
  // try {
  //   req.createSession({
  //     role: 'user',
  //     userId: String(row.id),
  //     email: row.email,
  //     firstName: row.first_name,
  //     lastName: row.last_name,
  //     test: 'ok'
  //   });
  // } catch (_e) {

  //   return next(new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία συνεδρίας χρήστη.', 500));
  // }
  const token = signToken(row.id);

  const safe = {
    id: String(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    created_at: row.created_at,
  };

  return res.status(201).json({ success: true, data: { user: safe, token } });
};

exports.login = async (req, res, next) => {

  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');

  let row;
  try {
    row = await UsersRepo.findByEmail(email);
  } catch (e) {
    return next(new HttpError('Προέκυψε σφάλμα στην αναζήτηση του χρήστη', 401));
  }

  const ok = row ? await bcrypt.compare(password, row.password || '') : false;
  if (!ok) {
    return next(new HttpError('Λάθος email ή κωδικός.', 401));
  }

  // if (typeof req.createSession !== 'function') {
  //   return next(new HttpError('Το session middleware δεν αρχικοποιήθηκε.', 500));
  // }

  // try {
  //   req.createSession({
  //     role: 'user',
  //     userId: String(row.id),
  //     email: row.email,
  //     firstName: row.first_name,
  //     lastName: row.last_name
  //   });
  // } catch (_e) {
  //   return next(new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία συνεδρίας χρήστη.', 500));
  // }

  const token = signToken(row.id);

  const safe = {
    id: String(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role
  };
  return res.json({ success: true, data: { user: safe, token } });
};

exports.me = async (req, res, next) => {
  const id = Number(req.user?.id);
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

// exports.logout = async (req, res, next) => {
//   if (!req.session || req.session.role !== 'user') {
//     return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
//   }

//   try {
//     req.destroySession();
//   } catch (_e) {
//     return next(new HttpError('Προέκυψε σφάλμα κατά την αποσύνδεση χρήστη.', 500));
//   }

//   return res.json({ success: true, message: 'Αποσυνδεθήκατε με επιτυχία.' });
// };

exports.logout = async (_req, res) => res.json({ success: true, message: 'Αποσυνδεθήκατε.' });