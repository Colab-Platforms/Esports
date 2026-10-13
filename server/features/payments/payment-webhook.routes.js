const express = require('express');

const {
  handleRazorpayWebhook
} = require('./payment.service');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const signature = req.get('X-Razorpay-Signature');
    const result = await handleRazorpayWebhook({
      rawBody: req.body,
      signature
    });

    return res.status(200).json({
      success: true,
      duplicate: result.duplicate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'WEBHOOK_FAILED',
        message: error.message || 'Webhook processing failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
