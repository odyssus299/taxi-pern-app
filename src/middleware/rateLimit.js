const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req /*, res*/) => {
     const ipKey = ipKeyGenerator(req); // ✅ σωστό για IPv6
     const email = String(req.body?.email || '').trim().toLowerCase();
     return email ? `${ipKey}:${email}` : ipKey;
   },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res /*, next, options*/) => {
    return res.status(429).json({
      success: false,
      message: 'Πάρα πολλές αποτυχημένες προσπάθειες. Προσπαθήστε ξανά σε 15 λεπτά.'
    });
  }
});

/**
 * Δημιουργία αιτήματος διαδρομής (POST /public/rides):
 * key = μόνο IP (ή IP:userId αν είναι logged-in), custom JSON handler.
 * Το max (ανά λεπτό) μπορείς να το προσαρμόσεις αν χρειαστεί.
 */
const rideRequestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req /*, res*/) => {
    const ipKey = ipKeyGenerator(req);
    const userId = req.user?.id ? String(req.user.id) : '';
    return userId ? `${ipKey}:user:${userId}` : ipKey;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res /*, next, options*/) => {
    return res.status(429).json({
      success: false,
      message: 'Πάρα πολλά αιτήματα. Προσπαθήστε ξανά σε λίγο.'
    });
  }
});

/**
 * Polling κατάστασης διαδρομής (GET /public/rides/:id/status):
 * key = IP + rideId (ώστε πολλά rides από το ίδιο IP να μοιράζονται δίκαια),
 * λίγο πιο “σφιχτό” όριο από το αρχικό 230.
 */
const rideStatusRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // ήταν 230 — 120 είναι πιο λογικό για ~1.5s polling
  keyGenerator: (req /*, res*/) => {
    const ipKey = ipKeyGenerator(req);
    const rideId = String(req.params?.id || req.params?.rideId || '');
    return rideId ? `${ipKey}:ride:${rideId}` : ipKey;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res /*, next, options*/) => {
    return res.status(429).json({
      success: false,
      message: 'Υπερβήκατε το όριο ερωτημάτων κατάστασης. Δοκιμάστε ξανά σε λίγο.'
    });
  }
});

module.exports = { loginRateLimiter, rideRequestRateLimiter, rideStatusRateLimiter };