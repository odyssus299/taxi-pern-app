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

const rideRequestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Πάρα πολλά αιτήματα. Προσπαθήστε ξανά σε λίγο.' } }
});

// μικρό όριο για polling (π.χ. 30/λεπτό/ΙΡ)
const rideStatusRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Υπερβήκατε το όριο ερωτημάτων κατάστασης. Δοκιμάστε ξανά σε λίγο.' } }
});

module.exports = { loginRateLimiter, rideRequestRateLimiter, rideStatusRateLimiter };