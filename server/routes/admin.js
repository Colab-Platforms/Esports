const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const PaymentService = require('../services/paymentService');

// Admin authentication middleware
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get admin dashboard stats
router.get('/dashboard', auth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTournaments = await Tournament.countDocuments();
    const activeTournaments = await Tournament.countDocuments({ 
      status: { $in: ['registration_open', 'active'] } 
    });
    
    const totalTransactions = await Transaction.countDocuments();
    const pendingWithdrawals = await Transaction.countDocuments({
      type: 'withdrawal',
      status: 'pending'
    });

    // Calculate total wallet balance
    const walletStats = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' },
          totalEarnings: { $sum: '$totalEarnings' },
          totalSpent: { $sum: '$totalSpent' },
          totalWithdrawn: { $sum: '$totalWithdrawn' }
        }
      }
    ]);

    const stats = walletStats[0] || {
      totalBalance: 0,
      totalEarnings: 0,
      totalSpent: 0,
      totalWithdrawn: 0
    };

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers
        },
        tournaments: {
          total: totalTournaments,
          active: activeTournaments
        },
        transactions: {
          total: totalTransactions,
          pendingWithdrawals
        },
        wallet: stats
      },
      message: 'Admin dashboard stats retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get pending withdrawal requests
router.get('/withdrawals/pending', auth, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const withdrawals = await Transaction.find({
      type: 'withdrawal',
      status: 'pending'
    })
    .populate('userId', 'username email phone')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Transaction.countDocuments({
      type: 'withdrawal',
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      },
      message: 'Pending withdrawals retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Process withdrawal request
router.post('/withdrawals/:id/process', auth, isAdmin, async (req, res) => {
  try {
    const { status, adminNotes = '' } = req.body;
    
    if (!['completed', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be completed, failed, or cancelled'
      });
    }

    const transaction = await PaymentService.processWithdrawal(
      req.params.id,
      status,
      adminNotes
    );

    res.json({
      success: true,
      data: transaction,
      message: `Withdrawal ${status} successfully`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get all transactions with filters
router.get('/transactions', auth, isAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      type, 
      status, 
      userId,
      startDate,
      endDate 
    } = req.query;

    const query = {};
    
    if (type) query.type = type;
    if (status) query.status = status;
    if (userId) query.userId = userId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .populate('userId', 'username email')
      .populate('reference.tournamentId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      },
      message: 'Transactions retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get user wallet details
router.get('/users/:userId/wallet', auth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('username email phone');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const wallet = await Wallet.findOne({ userId });
    const transactions = await Transaction.find({ userId })
      .populate('reference.tournamentId', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      data: {
        user,
        wallet,
        recentTransactions: transactions
      },
      message: 'User wallet details retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Manually add/deduct money from user wallet (admin only)
router.post('/users/:userId/wallet/adjust', auth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, type, description } = req.body;

    if (!amount || !type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Amount, type, and description are required'
      });
    }

    if (!['bonus', 'refund', 'adjustment'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be bonus, refund, or adjustment'
      });
    }

    const WalletService = require('../services/walletService');
    
    let result;
    if (amount > 0) {
      result = await WalletService.addMoney(
        userId,
        Math.abs(amount),
        type,
        `Admin adjustment: ${description}`,
        { adminId: req.user.userId }
      );
    } else {
      result = await WalletService.deductMoney(
        userId,
        Math.abs(amount),
        'adjustment',
        `Admin adjustment: ${description}`,
        { adminId: req.user.userId }
      );
    }

    res.json({
      success: true,
      data: result,
      message: 'Wallet adjusted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;