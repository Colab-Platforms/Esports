const express = require('express');
const router = express.Router();
const StoreItem = require('../models/StoreItem');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const auth = require('../middleware/auth');

// @route   GET /api/store
// @desc    Get all active store items
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    let query = { isActive: true };
    if (category) {
      query.category = category;
    }

    const items = await StoreItem.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { items },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching store items:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch store items',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/store/buy/:itemId
// @desc    Purchase/redeem an item
// @access  Private
router.post('/buy/:itemId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.params;
    const { playerID } = req.body;

    if (!playerID || !playerID.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLAYER_ID',
          message: 'Player ID is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get item
    const item = await StoreItem.findById(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Item not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!item.isActive) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ITEM_INACTIVE',
          message: 'Item is not available',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check stock
    if (item.stock !== -1 && item.stock <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: 'Item is out of stock',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get wallet
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }

    // Check balance
    if (wallet.balance < item.price) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient Colab Coins',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Deduct coins
    await wallet.deductCoins(
      item.price,
      `Purchased ${item.name}`,
      { source: 'store_purchase', itemId: item._id }
    );

    // Update stock
    if (item.stock !== -1) {
      item.stock -= 1;
      await item.save();
    }

    // Create order with pending status
    const order = new Order({
      userId,
      itemId: item._id,
      itemName: item.name,
      price: item.price,
      playerID: playerID.trim(),
      status: 'pending',
      claimStatus: 'pending',
      metadata: item.metadata
    });
    await order.save();

    res.json({
      success: true,
      data: {
        order,
        newBalance: wallet.balance
      },
      message: 'Item claimed! Admin will fulfill your order shortly.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to purchase item',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/store/orders
// @desc    Get user's order history
// @access  Private
router.get('/orders', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalOrders = await Order.countDocuments({ userId });

    const orders = await Order.find({ userId })
      .populate('itemId', 'name image category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalOrders / limitNum),
          totalOrders,
          hasNextPage: pageNum < Math.ceil(totalOrders / limitNum),
          hasPrevPage: pageNum > 1
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch orders',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/store/admin/claims
// @desc    Get all pending claims for admin
// @access  Private (Admin only)
router.get('/admin/claims', auth, async (req, res) => {
  try {
    const { page = 1, limit = 8, status = 'all' } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let query = {};
    if (status === 'cancelled') {
      // User-cancelled orders have order status = 'cancelled', not claimStatus
      query.status = 'cancelled';
    } else if (status !== 'all') {
      query.claimStatus = status;
    }

    const totalClaims = await Order.countDocuments(query);

    const claims = await Order.find(query)
      .populate('userId', 'username email')
      .populate('itemId', 'name category metadata')
      .populate('fulfilledBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        claims,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalClaims / limitNum),
          totalClaims,
          hasNextPage: pageNum < Math.ceil(totalClaims / limitNum),
          hasPrevPage: pageNum > 1
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch claims',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/store/admin/claims/:claimId/fulfill
// @desc    Mark a claim as fulfilled
// @access  Private (Admin only)
router.put('/admin/claims/:claimId/fulfill', auth, async (req, res) => {
  try {
    const { claimId } = req.params;
    const adminId = req.user.userId;

    const claim = await Order.findById(claimId);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CLAIM_NOT_FOUND',
          message: 'Claim not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (claim.claimStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot fulfill claim with status: ${claim.claimStatus}`,
          timestamp: new Date().toISOString()
        }
      });
    }

    claim.claimStatus = 'fulfilled';
    claim.status = 'completed';
    claim.fulfilledBy = adminId;
    claim.fulfilledAt = new Date();
    await claim.save();

    res.json({
      success: true,
      data: { claim },
      message: 'Claim marked as fulfilled',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fulfilling claim:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fulfill claim',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/store/admin/claims/:claimId/fail
// @desc    Mark a claim as failed
// @access  Private (Admin only)
router.put('/admin/claims/:claimId/fail', auth, async (req, res) => {
  try {
    const { claimId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.userId;

    const claim = await Order.findById(claimId);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CLAIM_NOT_FOUND',
          message: 'Claim not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (claim.claimStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot fail claim with status: ${claim.claimStatus}`,
          timestamp: new Date().toISOString()
        }
      });
    }

    claim.claimStatus = 'failed';
    claim.status = 'cancelled';
    claim.fulfilledBy = adminId;
    claim.fulfilledAt = new Date();
    claim.failureReason = reason || 'No reason provided';
    await claim.save();

    // Refund coins if failed
    const wallet = await Wallet.findOne({ userId: claim.userId });
    if (wallet) {
      await wallet.addCoins(
        claim.price,
        'refund',
        `Refund for failed claim: ${claim.itemName}`,
        { source: 'claim_refund', claimId: claim._id }
      );
    }

    res.json({
      success: true,
      data: { claim },
      message: 'Claim marked as failed and coins refunded',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error failing claim:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to mark claim as failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/store/orders/:orderId/cancel
// @desc    Cancel an order within 5-hour window and refund coins
// @access  Private
router.post('/orders/:orderId/cancel', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' }
      });
    }

    // Must belong to requesting user
    if (order.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not your order' }
      });
    }

    // Block if already cancelled or delivered/completed
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CANCELLED', message: 'Order is already cancelled' }
      });
    }

    if (order.status === 'completed' || order.claimStatus === 'fulfilled') {
      return res.status(400).json({
        success: false,
        error: { code: 'ORDER_FULFILLED', message: 'Cannot cancel a fulfilled order' }
      });
    }

    // Enforce 5-hour cancellation window
    const CANCEL_WINDOW_MS = 5 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(order.createdAt).getTime();

    if (elapsed > CANCEL_WINDOW_MS) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANCELLATION_WINDOW_EXPIRED',
          message: 'Cancellation window of 5 hours has passed'
        }
      });
    }

    // Cancel the order
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by user';
    await order.save();

    // Refund coins immediately
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
    }

    await wallet.addCoins(
      order.price,
      'refund',
      `Refund for cancelled order: ${order.itemName}`,
      { source: 'order_cancellation', orderId: order._id }
    );

    // Restore stock if applicable
    const StoreItem = require('../models/StoreItem');
    const item = await StoreItem.findById(order.itemId);
    if (item && item.stock !== -1) {
      item.stock += 1;
      await item.save();
    }

    console.log(`🔄 Order ${order._id} cancelled by user ${userId}, refunded ${order.price} coins`);

    res.json({
      success: true,
      data: {
        order,
        refundedCoins: order.price,
        newBalance: wallet.balance
      },
      message: `Order cancelled. ${order.price} coins refunded to your wallet.`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to cancel order' }
    });
  }
});

module.exports = router;
