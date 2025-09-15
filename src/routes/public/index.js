const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const { rideRequestRateLimiter, rideStatusRateLimiter, loginRateLimiter } = require('../../middleware/rateLimit');
// const requireUser = require('../../middleware/requireUser');
const checkAuth = require('../../middleware/check-auth');
const PublicRides = require('../../controllers/public/rides.controller');
const PublicAuth = require('../../controllers/public/auth.controller');
const PublicProfile = require('../../controllers/public/profile.controller');
const PublicReviews = require('../../controllers/public/reviews.controller');

const router = express.Router();

/* ========== AUTH ========== */
router.post(
  '/register',
  [
    body('firstName')
      .exists({ checkFalsy: true }).withMessage('Το όνομα είναι υποχρεωτικό.')
      .bail().isString().withMessage('Μη έγκυρη τιμή.')
      .trim(),
    body('lastName')
      .exists({ checkFalsy: true }).withMessage('Το επίθετο είναι υποχρεωτικό.')
      .bail().isString().withMessage('Μη έγκυρη τιμή.')
      .trim(),
    body('phone')
      .exists({ checkFalsy: true }).withMessage('Το τηλέφωνο είναι υποχρεωτικό.')
      .bail().matches(/^\d{10,}$/).withMessage('Το τηλέφωνο δεν είναι έγκυρο.')
      .trim(),
    body('email')
      .exists({ checkFalsy: true }).withMessage('Το email είναι υποχρεωτικό.')
      .bail().isEmail().withMessage('Το email δεν είναι έγκυρο.')
      .trim(),
    body('password')
      .exists({ checkFalsy: true }).withMessage('Ο κωδικός είναι υποχρεωτικός.')
      .bail().isLength({ min: 10 }).withMessage('Ο κωδικός πρέπει να έχει τουλάχιστον 10 χαρακτήρες.')
      .matches(/[a-z]/).withMessage('Χρειάζεται πεζό γράμμα.')
      .matches(/[A-Z]/).withMessage('Χρειάζεται κεφαλαίο γράμμα.')
      .matches(/[0-9]/).withMessage('Χρειάζεται αριθμό.')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Χρειάζεται σύμβολο.')
  ],
  validate,
  PublicAuth.register
);

router.post(
  '/login',
  loginRateLimiter,
  [
    body('email')
      .exists({ checkFalsy: true }).withMessage('Το email είναι υποχρεωτικό.')
      .bail().isEmail().withMessage('Το email δεν είναι έγκυρο.'),
    body('password')
      .exists({ checkFalsy: true }).withMessage('Ο κωδικός είναι υποχρεωτικός.')
  ],
  validate,
  PublicAuth.login
);

router.get('/me', checkAuth('user'), PublicAuth.me);
router.post('/logout', PublicAuth.logout);

/* ========== PROFILE (logged-in user) ========== */
router.patch(
  '/me',
  [
    body('firstName').optional({ nullable: true }).isString().withMessage('Μη έγκυρη τιμή.').bail()
      .notEmpty().withMessage('Το όνομα είναι υποχρεωτικό όταν δίνεται.').trim(),
    body('lastName').optional({ nullable: true }).isString().withMessage('Μη έγκυρη τιμή.').bail()
      .notEmpty().withMessage('Το επίθετο είναι υποχρεωτικό όταν δίνεται.').trim(),
    body('phone').optional({ nullable: true })
      .matches(/^\d{10,}$/).withMessage('Το τηλέφωνο δεν είναι έγκυρο.').trim(),
    body('email').optional({ nullable: true })
      .isEmail().withMessage('Το email δεν είναι έγκυρο.').trim(),
    body('password').optional({ nullable: true })
      .if(body('password').exists({ checkFalsy: true }))
      .isLength({ min: 10 }).withMessage('Ο κωδικός πρέπει να έχει τουλάχιστον 10 χαρακτήρες.')
      .matches(/[a-z]/).withMessage('Χρειάζεται πεζό γράμμα.')
      .matches(/[A-Z]/).withMessage('Χρειάζεται κεφαλαίο γράμμα.')
      .matches(/[0-9]/).withMessage('Χρειάζεται αριθμό.')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Χρειάζεται σύμβολο.')
  ],
  validate,
  checkAuth('user'),
  PublicProfile.updateMe
);

/* ========== RIDES (public) ========== */
// Νέο/κύριο endpoint: δέχεται coordinates{lat,lng}
router.post(
  '/rides',
  rideRequestRateLimiter,
  [
    // Honeypot
    body('user_nickname').custom((v) => {
      if (v) throw new Error('Παρουσιάστηκε ένα σφάλμα. Παρακαλώ δοκιμάστε ξανά.');
      return true;
    }),

    body('firstName')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.')
      .isString().withMessage('Μη έγκυρη τιμή.')
      .trim(),

    body('lastName')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.')
      .isString().withMessage('Μη έγκυρη τιμή.')
      .trim(),

    body('email')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.')
      .bail().isEmail().withMessage('Το email δεν είναι έγκυρο.')
      .trim(),

    body('phone')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.')
      .bail().matches(/^\d{10,}$/).withMessage('Το τηλέφωνο δεν είναι έγκυρο.')
      .trim(),

    body('address')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.')
      .isString().withMessage('Μη έγκυρη τιμή.')
      .trim(),

    body('coordinates').exists().withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('coordinates.lat')
      .exists().withMessage('Το πεδίο είναι υποχρεωτικό.')
      .isFloat({ min: -90, max: 90 }).withMessage('Μη έγκυρη τιμή.'),
    body('coordinates.lng')
      .exists().withMessage('Το πεδίο είναι υποχρεωτικό.')
      .isFloat({ min: -180, max: 180 }).withMessage('Μη έγκυρη τιμή.'),

    body('termsAccepted')
      .custom(v => v === true || v === 'true')
      .withMessage('Πρέπει να αποδεχθείτε τους όρους χρήσης.')
  ],
  validate,
  PublicRides.createRideRequest
);

// Legacy dev endpoint: δέχεται pickupLat/pickupLng/pickupAddress
// Το προσαρμόζουμε σε ίδιο shape και ξαναχρησιμοποιούμε το ίδιο controller.
router.post(
  '/rides/request',
  [
    body('firstName').exists({ checkFalsy: true }).withMessage('Το όνομα είναι υποχρεωτικό.').trim(),
    body('lastName').exists({ checkFalsy: true }).withMessage('Το επίθετο είναι υποχρεωτικό.').trim(),
    body('phone').exists({ checkFalsy: true }).withMessage('Το τηλέφωνο είναι υποχρεωτικό.')
      .matches(/^[0-9]{10,}$/).withMessage('Το τηλέφωνο δεν είναι έγκυρο.'),
    body('email').optional({ nullable: true }).isEmail().withMessage('Το email δεν είναι έγκυρο.').trim(),
    body('pickupLat').exists().withMessage('Συντεταγμένη lat απαιτείται.').isFloat({ min: -90, max: 90 }),
    body('pickupLng').exists().withMessage('Συντεταγμένη lng απαιτείται.').isFloat({ min: -180, max: 180 }),
    body('pickupAddress').optional({ nullable: true }).isString().withMessage('Μη έγκυρη διεύθυνση.').trim()
  ],
  validate,
  // adapter -> ίδιο payload με /rides
  (req, _res, next) => {
    const {
      firstName, lastName, email, phone,
      pickupLat, pickupLng, pickupAddress
    } = req.body || {};
    req.body = {
      firstName,
      lastName,
      email: email || '',      // optional εδώ
      phone,
      address: pickupAddress || '',
      coordinates: { lat: Number(pickupLat), lng: Number(pickupLng) },
      termsAccepted: true      // legacy route: θεωρούμε αποδεκτούς όρους
    };
    next();
  },
  PublicRides.createRideRequest
);

router.get(
  '/rides/:id/status',
  [param('id').exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.')],
  rideStatusRateLimiter,
  validate,
  PublicRides.getRideStatus
);

/* ========== REVIEWS (public) ========== */
router.get(
  '/reviews/validate/:token',
  [param('token').exists({ checkFalsy: true }).withMessage('Λείπει token.')],
  validate,
  PublicReviews.validateToken
);

router.post(
  '/reviews',
  [
    body('driverId').exists({ checkFalsy: true }).withMessage('Λείπει driverId.').bail().isString().withMessage('Μη έγκυρη τιμή.'),
    body('reviewToken').exists({ checkFalsy: true }).withMessage('Λείπει reviewToken.').bail().isString().withMessage('Μη έγκυρη τιμή.'),
    body('rating').exists({ checkFalsy: true }).withMessage('Λείπει rating.').bail().isInt({ min: 1, max: 5 }).withMessage('Η βαθμολογία πρέπει να είναι 1-5.'),
    body('comment').optional().isString().withMessage('Μη έγκυρη τιμή.'),
    body('termsAccepted').custom(v => v === true).withMessage('Πρέπει να αποδεχθείτε τους όρους.')
  ],
  validate,
  PublicReviews.submit
);

module.exports = router;
