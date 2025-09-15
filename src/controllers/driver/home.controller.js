const HttpError = require('../../utils/HttpError');
const DriversRepo = require('../../repos/drivers.repo');
const AdminMessagesRepo = require('../../repos/adminMessages.repo');
const RidesRepo = require('../../repos/rides.repo');

// Βασικά στοιχεία για home (όνομα, rating, carNumber)
exports.getOverview = async (req, res, next) => {
  const driverId = Number(req.user?.id);
  if (!Number.isInteger(driverId) || driverId <= 0) {
      return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  let row;
  try {
    row = await DriversRepo.findById(driverId);
  } catch (e) {
    return next(e);
  }
  if (!row) return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));

  return res.json({
    success: true,
    data: {
      id: String(row.id),
      firstName: row.first_name,
      lastName: row.last_name,
      carNumber: row.car_number,
      average_rating: Number(row.average_rating)
    }
  });
};

// Τα 2 πιο πρόσφατα μηνύματα admin
exports.listAdminMessages = async (req, res, next) => {
  const driverId = Number(req.user?.id);
  if (!Number.isInteger(driverId) || driverId <= 0) {
      return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }
    try {
      const rows = await AdminMessagesRepo.listLatest(2); // raw: created_at
      const items = rows.map(r => ({
        id: r.id,                // κρατάμε number (συμβατό)
        content: r.content,
        created_at: r.created_at // ή createdAt: r.created_at, ανάλογα τι περιμένει το front
      }));
      return res.json({ success: true, data: { items, total: items.length } });
    } catch (e) {
      return next(e);
    }
  };

// Επιτυχημένες διαδρομές ανά μήνα (τελευταίο 6μηνο)
exports.getMonthlySuccess = async (req, res, next) => {
  const driverId = Number(req.user?.id);
  if (!Number.isInteger(driverId) || driverId <= 0) {
      return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  let months;
  try {
    months = await RidesRepo.monthlySuccessByDriver(driverId, 6);
  } catch (e) {
    return next(e);
  }
  return res.json({ success: true, data: { months } });
};
