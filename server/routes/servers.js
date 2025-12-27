const express = require('express');
const Server = require('../models/Server');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/servers
// @desc    Get all active servers
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { gameType, region, status } = req.query;
    
    const query = { isPublic: true };
    if (gameType) query.gameType = gameType;
    if (region) query.region = region;
    if (status) query.status = status;
    
    const servers = await Server.find(query)
      .sort({ region: 1, name: 1 })
      .select('-password -connectCommand'); // Hide sensitive info for public
    
    res.json({
      success: true,
      data: servers,
      count: servers.length
    });
  } catch (error) {
    console.error('❌ Get servers error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch servers',
        details: error.message
      }
    });
  }
});

// @route   GET /api/servers/:id
// @desc    Get single server
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const server = await Server.findById(req.params.id)
      .select('-password -connectCommand'); // Hide sensitive info
    
    if (!server) {
      return res.status(404).json({
        success: false,
        error: { message: 'Server not found' }
      });
    }
    
    res.json({
      success: true,
      data: server
    });
  } catch (error) {
    console.error('❌ Get server error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch server',
        details: error.message
      }
    });
  }
});

// @route   POST /api/servers
// @desc    Create new server (Admin only)
// @access  Private (Admin)
router.post('/', auth, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required' }
      });
    }
    
    const server = new Server(req.body);
    await server.save();
    
    res.status(201).json({
      success: true,
      data: server,
      message: 'Server created successfully'
    });
  } catch (error) {
    console.error('❌ Create server error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create server',
        details: error.message
      }
    });
  }
});

// @route   PUT /api/servers/:id
// @desc    Update server (Admin only)
// @access  Private (Admin)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required' }
      });
    }
    
    const server = await Server.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!server) {
      return res.status(404).json({
        success: false,
        error: { message: 'Server not found' }
      });
    }
    
    res.json({
      success: true,
      data: server,
      message: 'Server updated successfully'
    });
  } catch (error) {
    console.error('❌ Update server error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update server',
        details: error.message
      }
    });
  }
});

// @route   DELETE /api/servers/:id
// @desc    Delete server (Admin only)
// @access  Private (Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required' }
      });
    }
    
    const server = await Server.findByIdAndDelete(req.params.id);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        error: { message: 'Server not found' }
      });
    }
    
    res.json({
      success: true,
      message: 'Server deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete server error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete server',
        details: error.message
      }
    });
  }
});

module.exports = router;