const HttpError = require('../../utils/HttpError');
const DriversRepo = require('../../repos/drivers.repo');
const RidesRepo = require('../../repos/rides.repo');

const MONTH_NAMES = [
  'Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος',
  'Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'
];

/** Γιατί: σταθερά οι τελευταίοι 6 μήνες, νεότερος → παλαιότερος */
function lastSixMonths() {
  const now = new Date();
  const arr = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    arr.push({
      key: `${y}-${String(m).padStart(2,'0')}`,   // YYYY-MM
      label: `${MONTH_NAMES[m-1]} ${y}`,
      year: y,
      month: m
    });
  }
  return arr;
}

function monthKeyFromISO(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2,'0')}`;
}

/** Γιατί: συμβατότητα με front statuses */
function normalizeStatus(s) {
  if (s === 'success') return 'completed';
  if (s === 'failed') return 'rejected';
  return s; // 'problem' παραμένει
}

/**
 * GET /api/admin/drivers/:id/rides/monthly
 * Επιστρέφει 6μήνο, counts ανά μήνα {completed, problem, rejected}
 */
// exports.getDriverMonthlyRideStats = async (req, res) => {
//   const { id } = req.params;

//   const driver = drivers.find(d => d.id === id && d.role === 'driver');
//   if (!driver) {
//     return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
//   }

//   const months = lastSixMonths(); // newest → oldest
//   const monthMap = new Map(
//     months.map(m => [m.key, { ...m, counts: { completed: 0, problem: 0, rejected: 0 } }])
//   );

//   for (const r of rides) {
//     const rDriverId = r.driverId ?? r.driver_id;
//     if (rDriverId !== id) continue;

//     const key = monthKeyFromISO(r.createdAt);
//     if (!key || !monthMap.has(key)) continue;

//     const st = normalizeStatus(r.status);
//     if (st === 'completed' || st === 'problem' || st === 'rejected') {
//       monthMap.get(key).counts[st] += 1;
//     }
//   }

//   return res.json({
//     success: true,
//     data: {
//       driver: { id: driver.id, name: `${driver.firstName} ${driver.lastName}` },
//       months: months.map(m => ({
//         key: m.key,
//         label: m.label,
//         counts: monthMap.get(m.key).counts
//       }))
//     }
//   });
// };

exports.getDriverMonthlyRideStats = async (req, res, next) => {
  // auth
  const adminId = Number(req.user?.id);
  if (!adminId) return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }

  // check driver exists
  let driver;
  try {
    driver = await DriversRepo.findById(id);
  } catch (e) {
    return next(e);
  }
  if (!driver) {
    return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));
  }

  // πάντα 6 μήνες
  let monthsRows;
  try {
    monthsRows = await RidesRepo.monthlyStatsByDriver(id);
  } catch (e) {
    return next(e);
  }

  return res.json({ success: true, data: { months: monthsRows } });
};