const HttpError = require('../../utils/HttpError');
const AdminsRepo = require('../../repos/admins.repo');

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
  if (admin.password !== password) {
    return next(new HttpError('Ο κωδικός πρόσβασης είναι λανθασμένος.', 401));
  }

  try {
    
    if (req.session && req.session.role !== 'admin') req.destroySession?.();
    req.createSession?.({ role: 'admin', id: admin.id });

  } catch (_e) {
    return next(new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία συνεδρίας.', 500));
  }

  return res.json({ success: true, data: { admin: sanitizeAdmin(admin) } });
};

exports.me = async (req, res, next) => {
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  let admin;
  try {
    admin = await AdminsRepo.getById(req.session.id);
  } catch (err) {
    return next(err); // «Προέκυψε σφάλμα κατά την αναζήτηση διαχειριστή από id.»
  }

  if (!admin) {
    req.destroySession?.();
    return next(new HttpError('Η συνεδρία δεν είναι έγκυρη.', 401));
  }

  return res.json({ success: true, data: { admin: sanitizeAdmin(admin) } });
};

exports.logout = async (req, res, _next) => {
  if (req.session?.role === 'admin') {
    req.destroySession?.();
    return res.json({ success: true, message: 'Αποσυνδεθήκατε με επιτυχία.' });
  }
  req.destroySession?.();
  return res.json({ success: true, message: 'Δεν υπήρχε ενεργή συνεδρία διαχειριστή.' });
};