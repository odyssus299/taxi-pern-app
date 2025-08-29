/**
 * Ενιαίο shape για validation errors από express-validator.
 * Γιατί: ίδια λογική error handling σε όλο το API.
 */
const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = {};
  for (const e of result.array({ onlyFirstError: false })) {
    const key = e.path || e.param || 'general';        // v7: e.path
    const msg = e.msg && e.msg !== 'Invalid value' ? e.msg : 'Μη έγκυρη τιμή.';
    if (!errors[key]) errors[key] = [];
    if (!errors[key].includes(msg)) errors[key].push(msg);
  }

  return res.status(422).json({ success: false, errors });
};

