const express = require('express');
const router = express.Router();
const WalletService = require('../services/walletService');
const PaymentService = require('../services/paymentService');
const auth = require('../middleware/auth');

// Get wallet details
router.get('/', auth, async (req, res) => {
  try {
    const wallet = await WalletService.getWallet(req.user.id);
    const stats = await WalletService.getWalletStats(req.user.id);

    res.json({
      success: true,
      data: {
        wallet,
        stats
      },
      message: 'Wallet details retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get transaction history
router.get('/transactions', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    
    const result = await WalletService.getTransactionHistory(
      req.user.id,
      parseInt(page),
      parseInt(limit),
      type
    );

    res.json({
      success: true,
      data: result,
      message: 'Transaction history retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Create deposit order
router.post('/deposit/create-order', auth, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({
        success: false,
        message: 'Minimum deposit amount is ₹10'
      });
    }

    if (amount > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum deposit amount is ₹50,000'
      });
    }

    const order = await PaymentService.createDepositOrder(req.user.id, amount);

    res.json({
      success: true,
      data: order,
      message: 'Deposit order created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Verify payment
router.post('/deposit/verify', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    const result = await PaymentService.verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    res.json({
      success: true,
      data: result,
      message: 'Payment verified and wallet updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Handle payment failure
router.post('/deposit/failed', auth, async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    await PaymentService.handleFailedPayment(orderId, reason);

    res.json({
      success: true,
      message: 'Payment failure handled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Create withdrawal request
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;

    if (!amount || !bankDetails) {
      return res.status(400).json({
        success: false,
        message: 'Amount and bank details are required'
      });
    }

    const { accountNumber, ifscCode, accountHolderName, bankName } = bankDetails;

    if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
      return res.status(400).json({
        success: false,
        message: 'Complete bank details are required'
      });
    }

    const transaction = await PaymentService.createWithdrawalRequest(
      req.user.id,
      amount,
      bankDetails
    );

    res.json({
      success: true,
      data: transaction,
      message: 'Withdrawal request created successfully. It will be processed within 24-48 hours.'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Check balance for tournament entry
router.post('/check-balance', auth, async (req, res) => {
  try {
    const { amount } = req.body;

    const hasSufficientBalance = await WalletService.hasSufficientBalance(
      req.user.id,
      amount
    );

    res.json({
      success: true,
      data: {
        hasSufficientBalance,
        requiredAmount: amount
      },
      message: hasSufficientBalance 
        ? 'Sufficient balance available' 
        : 'Insufficient balance'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;