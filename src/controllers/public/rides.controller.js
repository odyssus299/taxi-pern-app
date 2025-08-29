const HttpError = require('../../utils/HttpError');
const RidesRepo = require('../../repos/rides.repo');

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

  // Αν είναι logged-in user, ΑΠΛΑ περνάμε userId — δεν αποθηκεύουμε requester_*.
  const sessionUserId = (req.session?.role === 'user' && req.session?.userId)
    ? Number(req.session.userId) : null;

  let result;
  try {
    result = await RidesRepo.createWithCandidates({
      userId: sessionUserId,
      requesterFirstName: sessionUserId ? null : firstName,
      requesterLastName : sessionUserId ? null : lastName,
      requesterPhone    : sessionUserId ? null : phone,
      requesterEmail    : sessionUserId ? null : email,
      pickupAddress     : address,
      pickupLat         : lat,
      pickupLng         : lng,
      nearestLimit      : 10
    });
  } catch (e) {
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