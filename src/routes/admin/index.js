const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../../middleware/validate');
const AdminAuth = require('../../controllers/admin/auth.controller');
const Admin = require('../../controllers/admin/admin.controller');
const Profile = require('../../controllers/admin/profile.controller');
const Driver = require('../../controllers/admin/driver.controller');
const Review = require('../../controllers/admin/review.controller');
const Request = require('../../controllers/admin/request.controller');
const Message = require('../../controllers/admin/message.controller');
const Problem = require('../../controllers/admin/problem.controller');
const Rides = require('../../controllers/admin/rides.controller');
const { loginRateLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

// router.use(checkAuth) // θα προστεθεί με JWT

const requireAdmin = (req, res, next) => {
  if (req.session?.role === 'admin') return next();
  req.destroySession?.();
  return res.status(401).json({ message: 'Δεν είστε συνδεδεμένος.' });
};

router.post(
  '/login',
  loginRateLimiter,
  [
    body('email').isString().withMessage('Το email είναι υποχρεωτικό')
      .bail().isEmail().withMessage('Το email δεν είναι έγκυρο'),
    body('password').isString().withMessage('Ο κωδικός είναι υποχρεωτικός')
  ],
  validate,
  AdminAuth.login
);

router.post('/logout', AdminAuth.logout);

router.get('/me', Profile.getMe);
router.patch(
  '/profile',
  [
    body('firstName').optional().isString().withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('lastName').optional().isString().withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('email').optional().isString().withMessage('Το πεδίο είναι υποχρεωτικό.')
      .bail().isEmail().withMessage('Το email δεν είναι έγκυρο.'),
    body('phone').optional().isString().withMessage('Το πεδίο είναι υποχρεωτικό.')
  ],
  validate,
  Profile.updateProfile
);

router.get('/overview', Admin.getOverview);
router.get('/drivers', Admin.listDrivers);
// router.post(
//   '/messages',
//   [body('content').isString().notEmpty().withMessage('Το μήνυμα δεν μπορεί να είναι κενό')],
//   validate,
//   Admin.broadcastMessage
// );

router.get(
  '/drivers/:id',
  [
    param('id')
      .exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.')
      .bail()
      .isInt().withMessage('Μη έγκυρο αναγνωριστικό οδηγού.')
  ],
  validate,
  Driver.getDriverById
);

// UPDATE driver by id (ίδιες επικυρώσεις με front)
router.patch(
  '/drivers/:id',
  [
    param('id')
      .exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.')
      .bail()
      .isInt().withMessage('Μη έγκυρο αναγνωριστικό οδηγού.'),

    body('firstName')
      .optional({ nullable: true })
      .isString().withMessage('Μη έγκυρη τιμή.')
      .bail()
      .trim()
      .notEmpty().withMessage('Το πεδίο είναι υποχρεωτικό.'),

    body('lastName')
      .optional({ nullable: true })
      .isString().withMessage('Μη έγκυρη τιμή.')
      .bail()
      .trim()
      .notEmpty().withMessage('Το πεδίο είναι υποχρεωτικό.'),

    body('email')
      .optional({ checkFalsy: true })
      .isEmail().withMessage('Το email δεν είναι έγκυρο.')
      .bail()
      .trim(),

    body('phone')
      .optional({ checkFalsy: true })
      .matches(/^[0-9]{10,}$/).withMessage('Το τηλέφωνο δεν είναι έγκυρο.'),

    body('carNumber')
      .optional({ checkFalsy: true })
      .matches(/^[Α-Ω]{3}-[0-9]{4}$/).withMessage('Η πινακίδα δεν είναι έγκυρη.'),

    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 10 }).withMessage('Ο κωδικός πρέπει να έχει τουλάχιστον 10 χαρακτήρες.')
      .bail()
      .custom((pwd) => /[a-z]/.test(pwd) && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[!@#$%^&*(),.?":{}|<>]/.test(pwd))
      .withMessage('Ο κωδικός πρέπει να περιέχει πεζά, κεφαλαία, αριθμό και σύμβολο.')
  ],
  validate,
  Driver.updateDriver
);

router.post(
  '/drivers',
  [
    // fullName
    body('firstName')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('lastName')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.'),

    // email
    body('email')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('email')
      .if(body('email').exists({ checkFalsy: true }))
      .isEmail().withMessage('Το email δεν είναι έγκυρο.')
      .trim(),

    // phone
    body('phone')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('phone')
      .if(body('phone').exists({ checkFalsy: true }))
      .matches(/^\d{10,}$/).withMessage('Το τηλέφωνο δεν είναι έγκυρο.')
      .trim(),

    // carNumber
    body('carNumber')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('carNumber')
      .if(body('carNumber').exists({ checkFalsy: true }))
      .matches(/^[Α-Ω]{3}-\d{4}$/).withMessage('Μορφή πινακίδας: ΧΧΧ-1234')
      .trim(),

    // password
    body('password')
      .exists({ checkFalsy: true }).withMessage('Το πεδίο είναι υποχρεωτικό.'),
    body('password')
      .if(body('password').exists({ checkFalsy: true }))
      .isLength({ min: 10 }).withMessage('Ο κωδικός πρέπει να έχει τουλάχιστον 10 χαρακτήρες.')
      .matches(/[a-z]/).withMessage('Ο κωδικός πρέπει να περιέχει πεζό γράμμα.')
      .matches(/[A-Z]/).withMessage('Ο κωδικός πρέπει να περιέχει κεφαλαίο γράμμα.')
      .matches(/[0-9]/).withMessage('Ο κωδικός πρέπει να περιέχει αριθμό.')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Ο κωδικός πρέπει να περιέχει σύμβολο.')
  ],
  validate,
  Driver.createDriver
);

router.delete(
  '/drivers/:id',
  requireAdmin,
  [
    param('id')
      .exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.')
      .isString().withMessage('Μη έγκυρη τιμή.')
  ],
  validate,
  Driver.deleteDriver
);

router.get('/reviews/drivers', Review.listDriversForReviews);

router.get('/requests', Request.listRequests);

router.get(
  '/requests/:id',
  [param('id').exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.')],
  validate,
  Request.getRequestById
);

// έγκριση
router.post(
  '/requests/:id/approve',
  [param('id').exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.')],
  validate,
  Request.approveRequest
);

// απόρριψη
router.post(
  '/requests/:id/reject',
  [param('id').exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.')],
  validate,
  Request.rejectRequest
);

router.post(
  '/messages',
  [
    body('content')
      .exists({ checkFalsy: true }).withMessage('Το μήνυμα δεν μπορεί να είναι κενό.')
      .isString().withMessage('Μη έγκυρη τιμή.')
      .trim()
  ],
  validate,
  Message.sendMessage
);

router.get('/problems', Problem.listProblems);

// Λεπτομέρειες προβλήματος (modal)
router.get(
  '/problems/:id',
  [param('id').exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.')],
  validate,
  Problem.getProblemById
);

router.get(
  '/drivers/:id/rides/monthly',
  [ param('id').exists({ checkFalsy: true }).withMessage('Το id είναι υποχρεωτικό.') ],
  validate,
  Rides.getDriverMonthlyRideStats
);

router.get(
  '/drivers/:id/reviews',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Μη έγκυρο αναγνωριστικό οδηγού.'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Το page πρέπει να είναι >= 1')
  ],
  validate,
  Review.listDriverReviews
);

module.exports = router;