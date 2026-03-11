const express = require('express');
const router = express.Router();
const { CoinConfig, TimeMultiplier } = require('../models/CoinConfig');
const StoreItem = require('../models/StoreItem');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Test route to verify routing is working
router.get('/test', auth, adminAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Admin coin routes are working!',
    user: {
      username: req.user?.username,
      role: req.user?.role
    },
    timestamp: new Date().toISOString()
  });
});

// @route   GET /api/admin/coin/coin-config
// @desc    Get all coin configuration rules
// @access  Admin only
router.get('/coin-config', auth, adminAuth, async (req, res) => {
  try {
    console.log('🔧 Fetching coin configs for user:', req.user?.username, 'Role:', req.user?.role);
    const configs = await CoinConfig.find().sort({ category: 1, key: 1 });

    res.json({
      success: true,
      data: { configs },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching coin config:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch coin configuration',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/admin/coin/coin-config/:key
// @desc    Update a coin configuration rule
// @access  Admin only
router.put('/coin-config/:key', auth, adminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description, category } = req.body;

    if (value === undefined || value < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VALUE',
          message: 'Value must be a non-negative number',
          timestamp: new Date().toISOString()
        }
      });
    }

    let config = await CoinConfig.findOne({ key });

    if (!config) {
      // Create new config
      config = new CoinConfig({
        key,
        value,
        description,
        category: category || 'earning'
      });
    } else {
      // Update existing
      config.value = value;
      if (description) config.description = description;
      if (category) config.category = category;
    }

    await config.save();

    res.json({
      success: true,
      data: { config },
      message: 'Configuration updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating coin config:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update configuration',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/admin/coin/coin-config/init
// @desc    Initialize default coin configurations
// @access  Admin only
router.post('/coin-config/init', auth, adminAuth, async (req, res) => {
  try {
    const defaultConfigs = [
      { key: 'daily_login_reward', value: 10, description: 'Daily login bonus', category: 'earning' },
      { key: 'welcome_bonus', value: 100, description: 'Welcome bonus for new users', category: 'bonus' },
      { key: 'tournament_win_reward', value: 100, description: 'Reward for winning tournament', category: 'tournament' },
      { key: 'tournament_participation', value: 20, description: 'Reward for participating in tournament', category: 'tournament' },
      { key: 'referral_reward', value: 50, description: 'Reward for successful referral', category: 'referral' },
      { key: 'profile_complete_bonus', value: 25, description: 'Bonus for completing profile', category: 'bonus' },
      { key: 'first_tournament_bonus', value: 30, description: 'Bonus for first tournament registration', category: 'bonus' }
    ];

    for (const configData of defaultConfigs) {
      const exists = await CoinConfig.findOne({ key: configData.key });
      if (!exists) {
        await CoinConfig.create(configData);
      }
    }

    res.json({
      success: true,
      message: 'Default configurations initialized',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error initializing configs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to initialize configurations',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/admin/coin/multiplier
// @desc    Get all time multipliers
// @access  Admin only
router.get('/multiplier', auth, adminAuth, async (req, res) => {
  try {
    let multiplierDoc = await TimeMultiplier.findOne();

    if (!multiplierDoc) {
      multiplierDoc = new TimeMultiplier({ multipliers: [] });
      await multiplierDoc.save();
    }

    res.json({
      success: true,
      data: { multipliers: multiplierDoc.multipliers },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching multipliers:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch multipliers',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/admin/coin/multiplier
// @desc    Create a time-based multiplier
// @access  Admin only
router.post('/multiplier', auth, adminAuth, async (req, res) => {
  try {
    const { name, multiplier, startTime, endTime, days } = req.body;

    if (!name || !multiplier || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Name, multiplier, start time, and end time are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    let multiplierDoc = await TimeMultiplier.findOne();

    if (!multiplierDoc) {
      multiplierDoc = new TimeMultiplier({ multipliers: [] });
    }

    multiplierDoc.multipliers.push({
      name,
      multiplier,
      startTime,
      endTime,
      days: days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      isActive: true
    });

    await multiplierDoc.save();

    res.json({
      success: true,
      data: { multipliers: multiplierDoc.multipliers },
      message: 'Multiplier created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating multiplier:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create multiplier',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/admin/coin/multiplier/:id
// @desc    Remove a multiplier
// @access  Admin only
router.delete('/multiplier/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const multiplierDoc = await TimeMultiplier.findOne();

    if (!multiplierDoc) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Multipliers not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    multiplierDoc.multipliers = multiplierDoc.multipliers.filter(
      m => m._id.toString() !== id
    );

    await multiplierDoc.save();

    res.json({
      success: true,
      message: 'Multiplier removed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error removing multiplier:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to remove multiplier',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/admin/coin/store
// @desc    Add new store item
// @access  Admin only
router.post('/store', auth, adminAuth, async (req, res) => {
  try {
    console.log('📦 Creating store item:', req.body);
    console.log('👤 User:', req.user?.username, 'Role:', req.user?.role);
    
    const { name, description, image, price, category, stock, metadata } = req.body;

    if (!name || !description || price === undefined) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Name, description, and price are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const item = new StoreItem({
      name,
      description,
      image,
      price,
      category: category || 'other',
      stock: stock !== undefined ? stock : -1,
      metadata
    });

    await item.save();
    
    console.log('✅ Store item created:', item._id);

    res.status(201).json({
      success: true,
      data: { item },
      message: 'Store item created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error creating store item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create store item',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/admin/coin/store/:id
// @desc    Edit store item
// @access  Admin only
router.put('/store/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, price, category, stock, isActive, metadata } = req.body;

    const item = await StoreItem.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Store item not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (name) item.name = name;
    if (description) item.description = description;
    if (image !== undefined) item.image = image;
    if (price !== undefined) item.price = price;
    if (category) item.category = category;
    if (stock !== undefined) item.stock = stock;
    if (isActive !== undefined) item.isActive = isActive;
    if (metadata) item.metadata = metadata;

    await item.save();

    res.json({
      success: true,
      data: { item },
      message: 'Store item updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating store item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update store item',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/admin/coin/store/:id
// @desc    Delete store item
// @access  Admin only
router.delete('/store/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await StoreItem.findByIdAndDelete(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Store item not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      message: 'Store item deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting store item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete store item',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
