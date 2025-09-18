const HttpError = require('../../utils/HttpError');
const RidesRepo = require('../../repos/rides.repo');
const { pool } = require('../../db/pool');
const { getHub, hub } = require('../../ws');

exports.createRideRequest = async (req, res, next) => {
  const firstName = String(req.body?.firstName || '').trim();
  const lastName  = String(req.body?.lastName  || '').trim();
  const email     = String(req.body?.email     || '').trim();   // guest only
  const phone     = String(req.body?.phone     || '').trim();
  const address   = String(req.body?.address   || '').trim();
  const coords    = req.body?.coordinates || {};
  const lat       = (coords && coords.lat != null) ? Number(coords.lat) : null;
  const lng       = (coords && coords.lng != null) ? Number(coords.lng) : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return next(new HttpError('Μη έγκυρες συντεταγμένες παραλαβής.', 422));
  }

  // Αν είναι logged-in user, απλά περνάμε userId — δεν αποθηκεύουμε requester_*
  const jwtUserId =
    (req.user?.role === 'user' && Number.isFinite(Number(req.user?.id)))
      ? Number(req.user.id)
      : null;

  // On-demand WS ping: φρεσκάρισμα θέσης πριν το nearest
  try {
    const pingId = `ride-${Date.now()}`;
    const ws = getHub();
    if (ws && typeof ws.pingAllDrivers === 'function') {
      ws.pingAllDrivers({ pingId, pickupLat: lat, pickupLng: lng, requestedAt: Date.now() });
      // μικρό “παράθυρο” να γραφτούν τα νέα lat/lng
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (_e) {
    // σιωπηλά: αν για κάποιο λόγο δεν υπάρχει WS, συνεχίζουμε με τα υπάρχοντα coords
  }

  const requesterEmail = jwtUserId ? null : (email || null);

  // Δημιουργία ride + υπολογισμός κοντινότερων οδηγών
  let result;
  try {
    result = await RidesRepo.createWithCandidates({
      userId: jwtUserId,
      requesterFirstName: jwtUserId ? null : firstName,
      requesterLastName : jwtUserId ? null : lastName,
      requesterPhone    : jwtUserId ? null : phone,
      requesterEmail    : requesterEmail,
      pickupAddress     : address,
      pickupLat         : lat,
      pickupLng         : lng,
      nearestLimit      : 10
    });
  } catch (e) {
    console.log('heys')
    console.log(e)
    if (e instanceof HttpError) return next(e);
    return next(new HttpError('Προέκυψε σφάλμα κατά τη δημιουργία αιτήματος διαδρομής.', 500));
  }

  if (!result || result.candidatesCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Δεν βρέθηκε διαθέσιμος οδηγός κοντά σας.'
    });
  }

  // WS PUSH: Στείλε proposal στον τρέχοντα awaiting driver (αν υπάρχει) με ΣΩΣΤΟ pickup & σωστό respondBy
  try {
    const ws = getHub();
    if (ws && typeof ws.notifyDriverProposal === 'function') {
      const { rows } = await pool.query(
        `
        SELECT driver_id, expires_at
        FROM public.ride_candidates
        WHERE ride_id = $1 AND status = 'awaiting_response'
        ORDER BY assigned_at DESC NULLS LAST, position ASC
        LIMIT 1
        `,
        [result.rideId]
      );
      const awaiting = rows[0];
      if (awaiting && Number.isFinite(Number(awaiting.driver_id))) {
        ws.notifyDriverProposal(Number(awaiting.driver_id), {
          rideId: String(result.rideId),
          pickupLat: lat,
          pickupLng: lng,
          respondByMs: awaiting.expires_at ? new Date(awaiting.expires_at).getTime() : null
        });
      }
    }
  } catch (_e) {
    // σιωπηλά: δεν επηρεάζουμε το HTTP 201
  }

  return res.status(201).json({
    success: true,
    data: {
      rideId: String(result.rideId),
      etaKm: result.firstCandidateKm != null ? Number(result.firstCandidateKm.toFixed(2)) : null,
      candidates: result.candidatesCount
    }
  });
};



// GET /api/public/rides/:id/status
exports.getRideStatus = async (req, res, next) => {
  const rideId = parseInt(String(req.params?.id), 10);
  if (!Number.isInteger(rideId) || rideId <= 0) {
    return next(new HttpError('Μη έγκυρο αναγνωριστικό διαδρομής.', 400));
  }

  let status;
  try {
    // Επιστρέφει { state, attempt, total, updatedAt, assignedDriver? }
    status = await RidesRepo.getPublicRideStatus(rideId);
  } catch (_e) {
    console.log(_e)
    return next(new HttpError('Προέκυψε σφάλμα κατά την ανάκτηση κατάστασης διαδρομής.', 500));
  }

  if (!status) {
    return res.status(404).json({ success: false, message: 'Η διαδρομή δεν βρέθηκε.' });
  }

  // Σταθερό σχήμα απόκρισης για το frontend
  return res.json({
    success: true,
    data: {
      state: status.state, // 'awaiting_response' | 'accepted' | 'exhausted' | 'cancelled'
      assignedDriver: status.assignedDriver
        ? {
            id: String(status.assignedDriver.id),
            firstName: status.assignedDriver.firstName,
            lastName: status.assignedDriver.lastName,
            carNumber: status.assignedDriver.carNumber,
            average_rating: Number(status.assignedDriver.average_rating),
            ratingCount: Number(status.assignedDriver.ratingCount)
          }
        : null,
      attempt: status.attempt ?? null,
      total: status.total ?? null,
      updatedAt: status.updatedAt ?? null
    }
  });
};