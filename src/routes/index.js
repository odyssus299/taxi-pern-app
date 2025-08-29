const express = require('express');
const HttpError = require('../utils/HttpError');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

router.get('/ping', (_req, res) => res.json({ pong: true }));
router.get('/demo-error', (_req, _res) => { throw new (require('../utils/HttpError'))('Δοκιμαστικό σφάλμα αιτήματος.', 400); });

module.exports = router;