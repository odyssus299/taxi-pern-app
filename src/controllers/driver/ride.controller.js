const HttpError = require('../../utils/HttpError');
const DriversRepo = require('../../repos/drivers.repo');
const RidesRepo = require('../../repos/rides.repo');
const ProblemsRepo = require('../../repos/problems.repo');
const ReviewEmail = require('../../services/reviewEmail.service');
const { getHub } = require('../../ws'); // <— WS hub

// === Πάρε πρόταση ride για συγκεκριμένο οδηγό (polling) ===
// GET /api/driver/:id/ride-request
exports.getRideProposal = async (req, res, next) => {
  const driverId = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(driverId) || driverId <= 0) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }

  // Έλεγχος οδηγού
  let driver;
  try {
    driver = await DriversRepo.findById(driverId);
  } catch (_e) {
    return next(new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγού.', 500));
  }
  if (!driver || driver.role !== 'driver') {
    return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
  }

  // Πιο πρόσφατη πρόταση (pending) για τον οδηγό
  let ride;
  try {
    ride = await RidesRepo.findLatestAwaitingForDriver(driverId); // alias -> pendingForDriver
  } catch (_e) {
    return next(new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση ανάθεσης διαδρομής.', 500));
  }

  if (!ride) {
    return res.json({ success: true, data: null });
  }

  return res.json({
    success: true,
    data: {
      rideId: String(ride.id),
      customerLocation:
        ride.pickup_lat == null || ride.pickup_lng == null
          ? null
          : { lat: ride.pickup_lat, lng: ride.pickup_lng },
      // FIX: χρησιμοποίησε τα aliases από το repo
      customerFirstName: ride.customer_first_name ?? '',
      customerLastName:  ride.customer_last_name  ?? '',
      customerPhone:     ride.customer_phone      ?? '',
      customerAddress:   ride.pickup_address      ?? ''
    }
  });
};


// === Απάντηση οδηγού σε πρόταση ===
// POST /api/driver/:id/ride-response { response: 'accept' | 'reject' }
exports.respondToRideRequest = async (req, res, next) => {
  const driverId = parseInt(String(req.params.id), 10);
  const response = String(req.body?.response || '');
  if (!Number.isInteger(driverId) || driverId <= 0) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }
  if (response !== 'accept' && response !== 'reject') {
    return res.status(400).json({ success: false, message: 'Μη έγκυρη απάντηση.' });
  }

  // Έλεγχος οδηγού
  let driver;
  try {
    driver = await DriversRepo.findById(driverId);
  } catch {
    return next(new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγού.', 500));
  }
  if (!driver || driver.role !== 'driver') {
    return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
  }

  // Υπάρχει ενεργή πρόταση για τον οδηγό;
  let current;
  try {
    current = await RidesRepo.findLatestAwaitingForDriver(driverId);
  } catch {
    return next(new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση ανάθεσης διαδρομής.', 500));
  }
  if (!current) {
    return res.status(404).json({ success: false, message: 'Δεν υπάρχει ανάθεση διαδρομής.' });
  }

  if (response === 'accept') {
    // Αποδοχή με TRX: μαρκάρει τον candidate ως accepted, ενημερώνει το ride (driver_id, status=ongoing)
    // και θέτει τον οδηγό σε on_ride
    try {
      await RidesRepo.acceptByDriver(current.id, driverId);
      await DriversRepo.updateStatusById(driverId, 'on_ride');
    } catch {
      return next(new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση διαδρομής.', 500));
    }
    return res.json({ success: true, message: 'Η διαδρομή έγινε δεκτή' });
  }

  // Απόρριψη: μαρκάρει τον candidate ως rejected και προωθεί στον επόμενο (αν υπάρχει)
  let forwarded = false;
  try {
    forwarded = await RidesRepo.rejectByDriverAndAdvance(current.id, driverId);
    await DriversRepo.updateStatusById(driverId, 'available');
  } catch {
    return next(new HttpError('Προέκυψε σφάλμα κατά την ενημέρωση διαδρομής.', 500));
  }

   // WS PUSH στον νέο awaiting driver (αν υπάρχει)
  try {
    const ws = (typeof getHub === 'function') ? getHub() : null;
    if (ws && typeof ws.notifyDriverProposal === 'function') {
      // Βρες ποιος είναι τώρα awaiting για το συγκεκριμένο ride
      let awaiting = null;
      if (typeof RidesRepo.getAwaitingCandidate === 'function') {
        awaiting = await RidesRepo.getAwaitingCandidate(rideId);
      } else if (typeof RidesRepo.listCandidates === 'function') {
        const list = await RidesRepo.listCandidates(rideId);
        awaiting = (list || []).find(c => String(c.status || c.candidate_status) === 'awaiting_response');
      }
      if (awaiting) {
        const nextDriverId = Number(awaiting.driverId || awaiting.driver_id || awaiting.id);
        if (Number.isFinite(nextDriverId)) {
          // θες pickup coords -> φέρε το ride για καθαρά payload
          let rideRow = null;
          if (typeof RidesRepo.findById === 'function') {
            try { rideRow = await RidesRepo.findById(rideId); } catch {}
          }
          ws.notifyDriverProposal(nextDriverId, {
            rideId: String(rideId),
            pickupLat: Number(rideRow?.pickup_lat ?? rideRow?.pickupLat ?? 0),
            pickupLng: Number(rideRow?.pickup_lng ?? rideRow?.pickupLng ?? 0),
            respondByMs: Date.now() + 20_000
          });
        }
      }
    }
  } catch (_) { /* σιωπηλά */ }

  return res.json({
    success: true,
    message: forwarded
      ? 'Απορρίφθηκε. Η διαδρομή προωθήθηκε σε άλλο οδηγό.'
      : 'Απορρίφθηκε. Δεν υπάρχουν άλλοι διαθέσιμοι οδηγοί.'
  });
};

exports.getActiveRide = async (req, res, next) => {
  const driverId = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(driverId) || driverId <= 0) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }

  // Έλεγχος οδηγού
  let driver;
  try {
    driver = await DriversRepo.findById(driverId);
  } catch {
    return next(new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγού.', 500));
  }
  if (!driver || driver.role !== 'driver') {
    return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
  }

  // Ενεργή διαδρομή;
  let ride;
  try {
    ride = await RidesRepo.findOngoingForDriver(driverId);
  } catch {
    return next(new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση ενεργής διαδρομής.', 500));
  }

  if (!ride) {
    return res.json({ success: true, data: null });
  }

  return res.json({
    success: true,
    data: {
      rideId: String(ride.id),
      customerLocation:
        ride.pickup_lat == null || ride.pickup_lng == null
          ? null
          : { lat: ride.pickup_lat, lng: ride.pickup_lng },
      customerFirstName: ride.customer_first_name ?? '',
      customerLastName:  ride.customer_last_name  ?? '',
      customerPhone:     ride.customer_phone      ?? '',
      customerAddress:   ride.pickup_address      ?? ''
    }
  });
};

// === Ολοκλήρωση διαδρομής από οδηγό ===
// POST /api/driver/:id/ride/complete { rideId, dropoffLat?, dropoffLng? }
exports.completeRide = async (req, res, next) => {
  const driverId = parseInt(String(req.params.id), 10);
  const rideId   = parseInt(String(req.body?.rideId ?? req.params?.rideId), 10);
  const dropoffLat = req.body?.dropoffLat == null ? null : Number(req.body.dropoffLat);
  const dropoffLng = req.body?.dropoffLng == null ? null : Number(req.body.dropoffLng);
  const ttlDays = Number(process.env.REVIEW_TOKEN_TTL_DAYS || 20);

  if (!Number.isInteger(driverId) || driverId <= 0) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }
  if (!Number.isInteger(rideId) || rideId <= 0) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό διαδρομής.', 400));
  }

  let driver;
  try { driver = await DriversRepo.findById(driverId); }
  catch { return next(new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγού.', 500)); }
  if (!driver || driver.role !== 'driver') {
    return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
  }

  let ride;
  try { ride = await RidesRepo.findByIdOwnedByDriver(rideId, driverId); }
  catch { return next(new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση διαδρομής.', 500)); }
  if (!ride) return res.status(404).json({ success: false, message: 'Η διαδρομή δεν βρέθηκε.' });
  if (ride.status !== 'ongoing') {
    return res.status(400).json({ success: false, message: 'Δεν υπάρχει ενεργή διαδρομή για ολοκλήρωση.' });
  }

  try {
    await RidesRepo.completeRide(rideId, { dropoffLat, dropoffLng });
    await DriversRepo.updateStatusById(driverId, 'available');
  } catch {
    return next(new HttpError('Προέκυψε σφάλμα κατά την ολοκλήρωση διαδρομής.', 500));
  }

  // 2) Αποστολή email για review (best-effort)
  try {
    console.log(ride.requester_email)
    console.log(ride)
    // φέρε φρέσκο row για να σιγουρευτούμε ότι έχουμε requester_email
    const freshRide = ride.requester_email != null ? ride : await RidesRepo.findByIdOwnedByDriver(rideId, driverId);
    console.log(freshRide)
    if (!freshRide?.requester_email) {
      console.log('no email')
      // Δεν υπάρχει email => δεν στέλνουμε τίποτα, δεν μαρκάρουμε review
      return res.json({ success: true, message: 'Η διαδρομή ολοκληρώθηκε.' });
    }

    const resEmail = await ReviewEmail.sendForRide(rideId);

    // Βάζουμε "έναρξη" και "λήξη" ισχύος token (expires σε ttlDays)
    try {
      await RidesRepo.markReviewSent(rideId, { ttlDays });
    } catch (_e) {
    }
  } catch (e) {
    console.error('[review-email][error]', e);
  }

  return res.json({ success: true, message: 'Η διαδρομή ολοκληρώθηκε.' });
};

// === Αναφορά προβλήματος διαδρομής ===
// POST /api/driver/:id/ride/problem { rideId, description }
exports.reportProblem = async (req, res, next) => {
  const driverId = parseInt(String(req.params.id), 10);
  const rideId   = parseInt(String(req.body?.rideId ?? req.params?.rideId), 10);
  const description = String(req.body?.description || '').trim();

  if (!Number.isInteger(driverId) || driverId <= 0) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό οδηγού.', 400));
  }
  if (!Number.isInteger(rideId) || rideId <= 0) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό διαδρομής.', 400));
  }
  if (!description) {
    return res.status(422).json({ success: false, errors: { description: 'Το πεδίο είναι υποχρεωτικό.' } });
  }

  let driver;
  try { driver = await DriversRepo.findById(driverId); }
  catch { return next(new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση οδηγού.', 500)); }
  if (!driver || driver.role !== 'driver') {
    return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
  }

  let ride;
  try { ride = await RidesRepo.findByIdOwnedByDriver(rideId, driverId); }
  catch { return next(new HttpError('Προέκυψε σφάλμα κατά την αναζήτηση διαδρομής.', 500)); }
  if (!ride) return res.status(404).json({ success: false, message: 'Η διαδρομή δεν βρέθηκε.' });
  if (ride.status !== 'ongoing') {
    return res.status(400).json({ success: false, message: 'Δεν υπάρχει ενεργή διαδρομή για αναφορά προβλήματος.' });
  }

  try {
    await ProblemsRepo.create({ rideId, driverId, description });
    await RidesRepo.markProblematic(rideId);
    await DriversRepo.updateStatusById(driverId, 'available');
  } catch {
    return next(new HttpError('Προέκυψε σφάλμα κατά την καταγραφή προβλήματος.', 500));
  }

  return res.json({ success: true, message: 'Το πρόβλημα καταγράφηκε.' });
};