const HttpError = require('../../utils/HttpError');
const ProblemsRepo = require('../../repos/problems.repo');

exports.listProblems = async (req, res, next) => {
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  let items;
  try {
    items = await ProblemsRepo.listAll();
  } catch (e) {
    return next(e);
  }

  // Επιστρέφουμε first/last name (το front μπορεί να φτιάξει πλήρες όνομα)
  return res.json({
    success: true,
    data: items.map(r => ({
      id: String(r.id),
      driverId: String(r.driver_id),
      firstName: r.first_name,
      lastName:  r.last_name,
      createdAt: r.created_at
    }))
  });
};

exports.getProblemById = async (req, res, next) => {
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό προβλήματος.', 400));
  }

  let row;
  try {
    row = await ProblemsRepo.getById(id);
  } catch (e) {
    return next(e);
  }
  if (!row) {
    return next(new HttpError('Το πρόβλημα δεν βρέθηκε.', 404));
  }

  return res.json({
    success: true,
    data: {
      id: String(row.id),
      driverId: String(row.driver_id),
      firstName: row.first_name,
      lastName:  row.last_name,
      description: row.description,
      createdAt: row.created_at
    }
  });
};