const router = require('express').Router();
const { webhook } = require('./payment.service');
router.post('/', require('./payment.routes').safeRoute(req => webhook({ rawBody: req.body,
  signature: req.get('X-Razorpay-Signature'), eventId: req.get('X-Razorpay-Event-Id') })));
module.exports = router;
