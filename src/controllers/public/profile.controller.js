const HttpError = require('../../utils/HttpError');
const UsersRepo = require('../../repos/users.repo');
const bcrypt = require('bcryptjs');


// function sanitizeUser(u) {
//   const { password, ...rest } = u;
//   return rest;
// }

// function findMe(req) {
//   if (req.session?.role !== 'user') return null;
//   return users.find(u => u.id === req.session.id) || null;
// }

exports.updateMe = async (req, res, next) => {
  // Το requireUser προηγείται στο route, οπότε εδώ υποθέτουμε ότι έχουμε userId
  const userId =
    req.user?.id ??
    (Number.isInteger(parseInt(req.session?.userId, 10)) ? parseInt(req.session.userId, 10) : null);

  if (!userId) return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));

  // 1) Τρέχων χρήστης
  let current;
  try {
    current = await UsersRepo.findById(userId);
  } catch (e) {
    return next(e);
  }
  if (!current) return next(new HttpError('Ο χρήστης δεν βρέθηκε.', 404));

  // 2) Μόνο τα πεδία που δόθηκαν στο body (validators έχουν ήδη τρέξει στο route)
  const { firstName, lastName, email, phone, password } = req.body || {};
  const desired = {
    firstName: firstName?.trim(),
    lastName:  lastName?.trim(),
    email:     email?.trim(),
    phone:     phone?.trim(),
    // password: μόνο αν δόθηκε μη-κενό string
    password:  typeof password === 'string' && password.length > 0 ? String(password) : undefined
  };

  // 3) Υπολογισμός πραγματικών αλλαγών (μην στείλουμε ό,τι είναι ίδιο)
  const changed = {};
   if (desired.firstName !== undefined && desired.firstName !== current.first_name) changed.firstName = desired.firstName;
   if (desired.lastName  !== undefined && desired.lastName  !== current.last_name)  changed.lastName  = desired.lastName;
   if (desired.email     !== undefined && desired.email     !== current.email)      changed.email     = desired.email;
   if (desired.phone     !== undefined && desired.phone     !== current.phone)      changed.phone     = desired.phone;

  // if (Object.keys(changed).length === 0) {
  //   return res.status(400).json({ success: false, message: 'Δεν έχετε κάνει καμία αλλαγή στα στοιχεία σας.' });
  // }

  if (typeof desired.password === 'string') {
     const incomingPwd = desired.password;
     const currentPwd  = String(current.password || '');
     const looksHashed = /^\$2[aby]\$\d{2}\$/.test(currentPwd);
    
     let shouldChangePassword = false;
     if (looksHashed) {
       try {
         const same = await bcrypt.compare(incomingPwd, currentPwd);
         shouldChangePassword = !same;
       } catch (_e) {
         return next(new HttpError('Προέκυψε σφάλμα κατά τον έλεγχο του κωδικού.', 500));
       }
     } else {
       // Παλιά plaintext αποθήκευση: αν διαφέρει, θα το αλλάξουμε και θα γράψουμε hash
       shouldChangePassword = incomingPwd !== currentPwd;
     }
    
     if (shouldChangePassword) {
       try {
         const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
         changed.password = await bcrypt.hash(incomingPwd, saltRounds);
       } catch (_e) {
         return next(new HttpError('Προέκυψε σφάλμα κατά την κρυπτογράφηση του κωδικού.', 500));
       }
     }
   }
    
   if (Object.keys(changed).length === 0) {
     return next(new HttpError('Δεν έχετε κάνει καμία αλλαγή στα στοιχεία σας.', 400));
   }

  // 4) Μοναδικό email (καθαρό 409 πριν το UPDATE)
  if (changed.email) {
    try {
      const existing = await UsersRepo.findByEmail(changed.email);
      if (existing && Number(existing.id) !== Number(userId)) {
        return next(new HttpError('Αυτό το email χρήστη χρησιμοποιείται ήδη.', 409));
      }
    } catch (e) {
      return next(e);
    }
  }

  // 5) Ενημέρωση
  let updated;
  try {
    updated = await UsersRepo.updateById(userId, changed);
  } catch (e) {
    return next(e); // θα επιστρέψει 409/422/500 ανάλογα με το repo
  }
  if (!updated) return next(new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση χρήστη.', 500));

  // 6) Auto-logout αν άλλαξε email ή/και password
  const emailChanged = Object.prototype.hasOwnProperty.call(changed, 'email');
  const passwordChanged = Object.prototype.hasOwnProperty.call(changed, 'password');
  if (emailChanged || passwordChanged) {
    try { req.destroySession?.(); } catch {}
  }

  const safe = {
    id: String(updated.id),
    firstName: updated.first_name,
    lastName: updated.last_name,
    email: updated.email,
    phone: updated.phone,
    role: updated.role
  };

  const message = (emailChanged || passwordChanged)
    ? 'Τα στοιχεία εισόδου άλλαξαν. Θα χρειαστεί να συνδεθείτε ξανά.'
    : 'Οι αλλαγές αποθηκεύτηκαν επιτυχώς!';

  return res.json({ success: true, message, data: { user: safe } });
};