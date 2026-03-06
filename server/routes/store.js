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

    // Create order
    const order = new Order({
      userId,
      itemId: item._id,
      itemName: item.name,
      price: item.price,
      status: 'completed',
      metadata: item.metadata
    });
    await order.save();

    res.json({
      success: true,
      data: {
        order,
        newBalance: wallet.balance
      },
      message: 'Item purchased successfully!',
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

module.exports = router;
