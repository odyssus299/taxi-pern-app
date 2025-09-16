const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const DriverAuth = require('../../controllers/driver/auth.controller');
const checkAuth = require('../../middleware/check-auth');
const { loginRateLimiter } = require('../../middleware/rateLimit');
const Dashboard = require('../../controllers/driver/dashboard.controller');
const Driver = require('../../controllers/driver/driver.controller');
const Ride = require('../../controllers/driver/ride.controller');
const DriverProfile = require('../../controllers/driver/profile.controller');
const DriverHome = require('../../controllers/driver/home.controller');

const router = express.Router();

// μπορεί και άχρηστα αρχη
// router.get(
//     '/:id/dashboard',
//     [param('id').exists().withMessage('Το ID είναι υποχρεωτικό.')],
//     validate,
//     Driver.getDashboardInfo
//   );
  
//   router.get(
//     '/:id/messages',
//     [param('id').exists().withMessage('Το ID είναι υποχρεωτικό.')],
//     validate,
//     Driver.getMessages
//   );

 
  
  // router.get(
  //   '/:id/rides/monthly',
  //   [param('id').exists().withMessage('Το ID είναι υποχρεωτικό.')],
  //   validate,
  //   Driver.getMonthlyRideStats
  // );
// μπορεί και άχρηστα τέλος

router.post(
  '/login',
  loginRateLimiter,
  [
    body('email').isEmail().withMessage('Το email δεν είναι έγκυρο.'),
    body('password').notEmpty().withMessage('Ο κωδικός είναι υποχρεωτικός.')
  ],
  validate,
  DriverAuth.login
);

router.post(
  '/:id/logout',
  [param('id').exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.')],
  validate,
  DriverAuth.logout
);

router.use(checkAuth('driver'));

router.get('/stats/rides/monthly', Driver.getMyMonthlyRideBreakdown);

router.get('/:id/ride-request', Ride.getRideProposal);
router.get('/:id/ride-active', Ride.getActiveRide);

router.post(
    '/:id/ride-response',
    [
      param('id').exists().withMessage('Το id είναι υποχρεωτικό.'),
      body('response')
        .exists().withMessage('Η απάντηση είναι υποχρεωτική.')
        .isIn(['accept', 'reject']).withMessage('Η απάντηση πρέπει να είναι accept ή reject.')
    ],
    validate,
    Ride.respondToRideRequest
  );

// ── Driver Profile ───────────────────────────────────────────
// Autofill προφίλ
router.get(
  '/:id/profile',
  [param('id').exists().withMessage('Το id είναι υποχρεωτικό.')],
  validate,
  DriverProfile.getProfile
);

// Αίτημα αλλαγής προφίλ (validators με ελληνικά μηνύματα)
router.patch(
  '/profile',
  [
    body('firstName').optional({ nullable: true })
      .isString().withMessage('Μη έγκυρη τιμή.')
      .bail().trim().notEmpty().withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('lastName').optional({ nullable: true })
      .isString().withMessage('Μη έγκυρη τιμή.')
      .bail().trim().notEmpty().withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('email').optional({ checkFalsy: true })
      .isEmail().withMessage('Το email δεν είναι έγκυρο.').bail().trim(),
    body('phone').optional({ checkFalsy: true })
      .matches(/^[0-9]{10,}$/).withMessage('Το τηλέφωνο δεν είναι έγκυρο.'),
    body('carNumber').optional({ checkFalsy: true })
      .matches(/^[Α-Ω]{3}-\d{4}$/).withMessage('Μορφή πινακίδας: ΧΧΧ-1234').trim()
  ],
  validate,
  DriverProfile.updateProfile
);


router.get('/overview', DriverHome.getOverview);
router.get('/messages', DriverHome.listAdminMessages);
router.get('/rides/monthly', DriverHome.getMonthlySuccess);

router.post(
  '/:id/ride/complete',
  [
    param('id').exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.'),
    body('rideId').exists({ checkFalsy: true }).withMessage('Το rideId είναι υποχρεωτικό.')
      .bail().isInt().withMessage('Μη έγκυρο rideId.'),
    body('dropoffLat').optional({ nullable: true }).isFloat({ min: -90, max: 90 })
      .withMessage('Μη έγκυρο πλάτος.'),
    body('dropoffLng').optional({ nullable: true }).isFloat({ min: -180, max: 180 })
      .withMessage('Μη έγκυρο μήκος.')
  ],
  validate,
  Ride.completeRide
);

// Δήλωση προβλήματος
router.post(
  '/:id/ride/problem',
  [
    param('id').exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.'),
    body('rideId').exists({ checkFalsy: true }).withMessage('Το rideId είναι υποχρεωτικό.')
      .bail().isInt().withMessage('Μη έγκυρο rideId.'),
    body('description').exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.')
      .bail().isString().withMessage('Μη έγκυρη τιμή.')
  ],
  validate,
  Ride.reportProblem
);


  

module.exports = router;
