const express = require('express');
const { body, validationResult } = require('express-validator');

const auth = require('../../middleware/auth');
const {
  verifyRazorpayCheckout
} = require('./payment.service');

const router = express.Router();

const sendPaymentError = (res, error, fallbackCode = 'PAYMENT_FAILED') => res.status(error.status || 500).json({
  success: false,
  error: {
    code: error.code || fallbackCode,
    message: error.message || 'Payment operation failed',
    timestamp: new Date().toISOString()
  }
});

router.post('/razorpay/verify', auth, [
  body('paymentOrderId').isMongoId().withMessage('A valid paymentOrderId is required'),
  body('razorpay_order_id').isString().notEmpty().withMessage('Razorpay order ID is required'),
  body('razorpay_payment_id').isString().notEmpty().withMessage('Razorpay payment ID is required'),
  body('razorpay_signature').isString().notEmpty().withMessage('Razorpay signature is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const result = await verifyRazorpayCheckout({
      requesterUserId: req.user.userId,
      paymentOrderId: req.body.paymentOrderId,
      razorpay_order_id: req.body.razorpay_order_id,
      razorpay_payment_id: req.body.razorpay_payment_id,
      razorpay_signature: req.body.razorpay_signature
    });

    return res.json({
      success: true,
      data: {
        paymentStatus: result.paymentOrder.status,
        fulfillmentStatus: result.paymentOrder.fulfillmentStatus,
        registrationId: result.registration?._id || null,
        registrationStatus: result.registration?.status || null,
        alreadyProcessed: result.alreadyProcessed
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return sendPaymentError(res, error, 'PAYMENT_VERIFY_FAILED');
  }
});

module.exports = router;
