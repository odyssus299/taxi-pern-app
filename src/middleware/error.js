const HttpError = require('../utils/HttpError');

const notFound = (req, _res, next) => next(new HttpError('Η διαδρομή δεν βρέθηκε.', 404));

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.code) ? err.code : 500;

  const payload = { success: false, error: { message: err.message || 'Σφάλμα διακομιστή.' } };
  if (err.details) payload.error.details = err.details;
  if (process.env.NODE_ENV !== 'production') payload.error.stack = err.stack; // why: visibility only in dev

  res.status(status).json(payload);
};

module.exports = { notFound, errorHandler };