const express = require('express');
const SiteImage = require('../models/SiteImage');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Middleware to check designer role
const designerAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'designer' && user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Designer or Admin access required',
          timestamp: new Date().toISOString()
        }
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to verify permissions',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// @route   GET /api/site-images
// @desc    Get all site images
// @access  Public
router.get('/', async (req, res) => {
  try {
    const images = await SiteImage.find()
      .populate('updatedBy', 'username')
      .sort({ updatedAt: -1 })
      .lean();

    const formattedImages = images.reduce((acc, image) => {
      acc[image.key] = {
        id: image._id,
        key: image.key,
        name: image.name,
        description: image.description,
        imageUrl: image.imageUrl,
        category: image.category,
        dimensions: image.dimensions,
        updatedBy: image.updatedBy?.username || 'System',
        updatedAt: image.updatedAt
      };
      return acc;
    }, {});

    res.json({
      success: true,
      data: { images: formattedImages },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching site images:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch site images',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/site-images/:key
// @desc    Update site image
// @access  Designer/Admin
router.put('/:key', auth, designerAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { imageUrl, name, description, category, dimensions } = req.body;
    const userId = req.user.userId;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_IMAGE_URL',
          message: 'Image URL is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update or create image
    const image = await SiteImage.findOneAndUpdate(
      { key },
      {
        key,
        name: name || key,
        description: description || '',
        imageUrl,
        category: category || 'other',
        dimensions: dimensions || {},
        updatedBy: userId
      },
      { 
        new: true, 
        upsert: true,
        runValidators: true
      }
    ).populate('updatedBy', 'username');

    console.log(`🎨 Image updated: ${key} by ${image.updatedBy.username}`);

    res.json({
      success: true,
      data: {
        image: {
          id: image._id,
          key: image.key,
          name: image.name,
          description: image.description,
          imageUrl: image.imageUrl,
          category: image.category,
          dimensions: image.dimensions,
          updatedBy: image.updatedBy.username,
          updatedAt: image.updatedAt
        }
      },
      message: 'Image updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error updating site image:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update image',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/site-images/:key
// @desc    Get specific site image
// @access  Public
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    const image = await SiteImage.findOne({ key })
      .populate('updatedBy', 'username')
      .lean();

    if (!image) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IMAGE_NOT_FOUND',
          message: 'Image not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: {
        image: {
          id: image._id,
          key: image.key,
          name: image.name,
          description: image.description,
          imageUrl: image.imageUrl,
          category: image.category,
          dimensions: image.dimensions,
          updatedBy: image.updatedBy?.username || 'System',
          updatedAt: image.updatedAt
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching site image:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch image',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/site-images/seed
// @desc    Seed default images
// @access  Admin
router.post('/seed', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Admin access required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const defaultImages = [
      {
        key: 'hero-banner-main',
        name: 'Main Hero Banner',
        description: 'Primary banner on homepage',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Web_banner_CP_new_-_1.jpg?v=1764247341',
        category: 'banner',
        dimensions: { width: 1920, height: 1080 }
      },
      {
        key: 'logo-main',
        name: 'Main Logo',
        description: 'Primary site logo',
        imageUrl: '/logo.png',
        category: 'logo',
        dimensions: { width: 200, height: 60 }
      }
    ];

    for (const imageData of defaultImages) {
      await SiteImage.findOneAndUpdate(
        { key: imageData.key },
        { ...imageData, updatedBy: req.user.userId },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      message: 'Default images seeded successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error seeding images:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to seed images',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
