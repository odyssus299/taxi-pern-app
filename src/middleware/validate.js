/**
 * Ενιαίο shape για validation errors από express-validator.
 * Γιατί: ίδια λογική error handling σε όλο το API.
 */
const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  // Πάρε flat array λαθών
  const flat = result.array({ onlyFirstError: false });

  // Ομαδοποίησε ανά πεδίο (όπως είχες)
  const errors = {};
  for (const e of flat) {
    const key = e.path || e.param || 'general'; // (v7: e.path)
    const msg = e.msg && e.msg !== 'Invalid value' ? e.msg : 'Μη έγκυρη τιμή.';
    if (!errors[key]) errors[key] = [];
    if (!errors[key].includes(msg)) errors[key].push(msg);
  }

  // 🔧 ΔΙΟΡΘΩΣΗ: μην καλείς errors.array() - δεν είναι μέθοδος
  if (process.env.NODE_ENV !== 'production') {
    console.log('[VALIDATE] 422 errors:', errors);
    console.log('[VALIDATE] body at 422:', req.body);
  }

  // Ένα συνοπτικό μήνυμα για ευκολία στο frontend
  const firstMsg =
    flat[0]?.msg && flat[0].msg !== 'Invalid value'
      ? flat[0].msg
      : 'Υπάρχουν λάθη στη φόρμα.';

  return res.status(422).json({
    success: false,
    message: firstMsg,
    errors, // { field: [msgs...] }
  });
};
