const HttpError = require('../../utils/HttpError');
const AdminsRepo = require('../../repos/admins.repo');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');

function signToken(id) {
  return jwt.sign(
    { userId: id, userRole: 'admin' },
    process.env.JWT_SECRET || process.env.JWT_KEY,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

function sanitizeAdmin(admin) {
  if (!admin) return null;
  const { password, ...safe } = admin;
  return safe;
}

exports.login = async (req, res, next) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return next(new HttpError('Λείπουν στοιχεία σύνδεσης.', 422));
  }

  let admin;
  try {
    admin = await AdminsRepo.findByEmail(email);
  } catch (err) {
    return next(err); // «Προέκυψε σφάλμα κατά την αναζήτηση διαχειριστή από email.»
  }

  if (!admin) {
    return next(new HttpError('Τα στοιχεία δεν είναι σωστά.', 401));
  }

  const ok = await bcrypt.compare(password, admin.password || '');
  if (!ok) {
    return next(new HttpError('Ο κωδικός πρόσβασης είναι λανθασμένος.', 401));
  }

  // try {
    
  //   if (req.session && req.session.role !== 'admin') req.destroySession?.();
  //   req.createSession?.({ role: 'admin', id: admin.id });

  // } catch (_e) {
  //   return next(new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία συνεδρίας.', 500));
  // }

  const token = signToken(admin.id);
  return res.json({ success: true, data: { admin: sanitizeAdmin(admin), token }});

};

exports.me = async (req, res, next) => {
  const adminId = Number(req.user?.id);
  if (!adminId) {
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  let admin;
  try {
    admin = await AdminsRepo.getById(adminId);
  } catch (err) {
    return next(err); // «Προέκυψε σφάλμα κατά την αναζήτηση διαχειριστή από id.»
  }

  if (!admin) return next(new HttpError('Ο διαχειριστής δεν βρέθηκε.', 404));

  return res.json({ success: true, data: { admin: sanitizeAdmin(admin) } });
};

// exports.logout = async (req, res, _next) => {
//   if (req.session?.role === 'admin') {
//     req.destroySession?.();
//     return res.json({ success: true, message: 'Αποσυνδεθήκατε με επιτυχία.' });
//   }
//   req.destroySession?.();
//   return res.json({ success: true, message: 'Δεν υπήρχε ενεργή συνεδρία διαχειριστή.' });
// };

exports.logout = async (_req, res) => res.json({ success: true, message: 'Αποσυνδεθήκατε.' });