const HttpError = require('../../utils/HttpError');
const DriversRepo = require('../../repos/drivers.repo');
const ReviewsRepo = require('../../repos/reviews.repo');

const PAGE_SIZE = 5; // σταθερό

// Λίστα όλων των οδηγών με rating για τη σελίδα "Κριτικές οδηγών"
exports.listDriversForReviews = async (_req, res, next) => {
  // (προαιρετικά) έλεγχος admin session, αν τον βάζεις παντού
  if (_req.session?.role !== 'admin') {
    _req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  let data;
  try {
    data = await ReviewsRepo.listDriversForReviews();
  } catch (e) {
    return next(e);
  }
  return res.json({ success: true, data });
};

// Reviews συγκεκριμένου οδηγού με AJAX pagination (page, limit=5)
exports.listDriverReviews = async (req, res, next) => {
  if (req.session?.role !== 'admin') {
    req.destroySession?.();
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  // Συμβατότητα: δεχόμαστε είτε :driverId είτε :id στο route
  const paramId = req.params.driverId ?? req.params.id;
  const driverId = parseInt(String(paramId), 10);
  if (!Number.isInteger(driverId) || driverId < 1) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }

  // Υπάρχει οδηγός;
  let driver;
  try {
    driver = await DriversRepo.findById(driverId);
  } catch (e) {
    return next(e);
  }
  if (!driver) {
    return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));
  }

  // Pagination: page μόνο, limit σταθερά 5
  let page = parseInt(String(req.query.page || '1'), 10);
  if (!Number.isInteger(page) || page < 1) page = 1;

  let result;
  try {
    result = await ReviewsRepo.listByDriverPaginated(driverId, page, PAGE_SIZE);
  } catch (e) {
    return next(e);
  }

  const { items, total } = result;
  const hasMore = page * PAGE_SIZE < total;

  // ΣΥΜΒΑΤΟ σχήμα με το υπάρχον front
  return res.json({
    success: true,
    data: {
      items,
      page,
      limit: PAGE_SIZE,
      total,
      hasMore
    }
  });
};