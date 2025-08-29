const HttpError = require('../../utils/HttpError');
const AdminsRepo = require('../../repos/admins.repo');
const catchAsync = require('../../utils/catchAsync');


function toApi(adminRow) {
  const { password, ...a } = adminRow;
  return {
    id: a.id,
    firstName: a.first_name ?? a.firstName,
    lastName: a.last_name ?? a.lastName,
    email: a.email,
    phone: a.phone,
    created_at: a.created_at
  };
}

exports.getMe = catchAsync(async (req, res, next) => {
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }
  let admin;
  try {
    admin = await AdminsRepo.getById(req.session.id);
  } catch (e) {
    return next(e);
  }
  if (!admin) {
    req.destroySession?.();
    return next(new HttpError('Ο admin δεν βρέθηκε.', 404));
  }
  return res.json({ success: true, data: { admin: toApi(admin) } });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  let current;
  try {
    current = await AdminsRepo.getById(req.session.id);
  } catch (e) { return next(e); }
  if (!current) return next(new HttpError('Ο admin δεν βρέθηκε.', 404));

  const body = req.body || {};
  const nextState = {
    firstName: typeof body.firstName === 'string' ? body.firstName.trim() : current.first_name,
    lastName:  typeof body.lastName  === 'string' ? body.lastName.trim()  : current.last_name,
    email:     typeof body.email     === 'string' ? body.email.trim()     : current.email,
    phone:     typeof body.phone     === 'string' ? body.phone.trim()     : current.phone
  };
  const passwordChanged = typeof body.password === 'string' && body.password.length > 0;

  const nameChanged  = (nextState.firstName !== current.first_name) || (nextState.lastName !== current.last_name);
  const emailChanged = nextState.email !== current.email;
  const phoneChanged = nextState.phone !== current.phone;

  if (!emailChanged && !phoneChanged && !nameChanged && !passwordChanged) {
    return res.status(400).json({ success: false, message: 'Δεν έχετε κάνει καμία αλλαγή στα στοιχεία σας.' });
  }

  const errors = {};
  const isEmail = (s) => /^\S+@\S+\.\S+$/.test(String(s || '').toLowerCase());
  const isPhone = (s) => /^\d{10,}$/.test(String(s || ''));
  const passwordPolicy = (pwd) => ({
    minLength: String(pwd).length >= 10,
    hasLower: /[a-z]/.test(pwd),
    hasUpper: /[A-Z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSymbol: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
  });

  if (!nextState.firstName) errors.firstName = 'Το πεδίο είναι υποχρεωτικό.';
  if (!nextState.lastName)  errors.lastName  = 'Το πεδίο είναι υποχρεωτικό.';
  if (!nextState.email) errors.email = 'Το πεδίο είναι υποχρεωτικό.';
  else if (!isEmail(nextState.email)) errors.email = 'Το email δεν είναι έγκυρο.';
  if (!nextState.phone) errors.phone = 'Το πεδίο είναι υποχρεωτικό.';
  else if (!isPhone(nextState.phone)) errors.phone = 'Το τηλέφωνο δεν είναι έγκυρο.';

  if (passwordChanged) {
    const reqs = passwordPolicy(body.password);
    const allOk = Object.values(reqs).every(Boolean);
    if (!allOk) {
      return res.status(422).json({
        success: false,
        errors: { password: 'Το πεδίο είναι υποχρεωτικό.' },
        passwordRequirements: reqs
      });
    }
  }
  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ success: false, errors });
  }

  const patch = {
    firstName: nextState.firstName,
    lastName:  nextState.lastName,
    email:     nextState.email,
    phone:     nextState.phone,
    password:  passwordChanged ? body.password : undefined
  };

  let updated;
  try {
    updated = await AdminsRepo.updateById(req.session.id, patch);
  } catch (e) { return next(e); }
  if (!updated) return next(new HttpError('Ο admin δεν βρέθηκε.', 404));

  // --- NEW: auto-logout όταν αλλάξει email ή/και password ---
  if (emailChanged || passwordChanged) {
    try {
      req.destroySession?.();
      // Αν χρειάζεται καθάρισμα cookie ρητά, ξεσχόλιασε και βάλε το σωστό όνομα cookie:
      // res.clearCookie('sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    } catch (_) { /* σκόπιμα σιωπηλό */ }
  }

  const message = (emailChanged || passwordChanged)
    ? 'Τα στοιχεία εισόδου άλλαξαν. Θα χρειαστεί να συνδεθείτε ξανά.'
    : 'Οι αλλαγές αποθηκεύτηκαν επιτυχώς!';

  const toApi = (a) => ({
    id: a.id,
    firstName: a.first_name ?? a.firstName,
    lastName: a.last_name ?? a.lastName,
    email: a.email, phone: a.phone, created_at: a.created_at
  });

  return res.json({ success: true, message, data: { admin: toApi(updated) } });
});