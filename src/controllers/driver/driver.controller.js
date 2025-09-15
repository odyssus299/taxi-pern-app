const HttpError = require('../../utils/HttpError');
const DriversRepo = require('../../repos/drivers.repo');
const RidesRepo = require('../../repos/rides.repo');


// exports.getMonthlyRideStats = async (req, res) => {
//     const { id } = req.params;
  
//     const driver = drivers.find((d) => d.id === id && d.role === 'driver');
//     if (!driver) {
//       console.log('this')
//       return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
//     }
  
//     const stats = {};
//     const now = new Date();
  
//     // Υπολογισμός αρχής εξαμήνου
//     const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  
//     for (const ride of rides) {
//       if (ride.driverId !== id || ride.status !== 'success') continue;
  
//       const date = new Date(ride.createdAt);
//       if (date < sixMonthsAgo) continue;
  
//       const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
//       stats[key] = (stats[key] || 0) + 1;
//     }
  
//     return res.json({ success: true, data: stats });
//   };

  // exports.getMonthlyRideBreakdown = async (req, res) => {
  //   const { id } = req.params;
  
  //   const driver = drivers.find((d) => d.id === id && d.role === 'driver');
  //   if (!driver) {
  //     return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
  //   }
  
  //   // why: σταθερά τελευταίοι 6 μήνες (από την 1η τρέχοντος μήνα προς τα πίσω)
  //   const now = new Date();
  //   const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  //   const months = [];
  //   const indexByKey = new Map();
  
  //   for (let i = 5; i >= 0; i--) {
  //     const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
  //     const key = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  //     const row = {
  //       monthKey: key,
  //       monthName: GREEK_MONTHS[d.getUTCMonth()],
  //       problem: 0,
  //       rejected: 0,
  //       completed: 0
  //     };
  //     indexByKey.set(key, months.length);
  //     months.push(row);
  //   }
  
  //   // Συγκέντρωση rides για τον συγκεκριμένο driver στο 6μηνο
  //   for (const r of rides) {
  //     const rideDriverId = r.driverId || r.driver_id;
  //     if (rideDriverId !== id) continue;
  
  //     const dateStr = r.createdAt || r.completed_at || r.date;
  //     if (!dateStr) continue;
  //     const dt = new Date(dateStr);
  
  //     const key = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
  //     if (!indexByKey.has(key)) continue;
  
  //     const k = normalizeStatus(r.status);
  //     const idx = indexByKey.get(key);
  //     if (k === 'completed') months[idx].completed += 1;
  //     else if (k === 'rejected') months[idx].rejected += 1;
  //     else if (k === 'problem') months[idx].problem += 1;
  //   }
  
  //   return res.json({ success: true, data: months });
  // };

  exports.getMyMonthlyRideBreakdown = async (req, res, next) => {
    const driverId = Number(req.user?.id);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
    }
  
    try {
      const d = await DriversRepo.findById(driverId);
      if (!d || d.role !== 'driver') {
        console.log(driverId)
        return next(new HttpError('Ο οδηγός δεν βρέθηκε.', 404));
      }
    } catch (e) {
      return next(e);
    }
  
    try {
      const months = await RidesRepo.monthlyStatsByDriver(driverId);
      return res.json({ success: true, data: { months } });
    } catch (e) {
      return next(e);
    }
  };