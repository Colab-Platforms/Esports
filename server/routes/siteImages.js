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
        responsiveUrls: image.responsiveUrls || {},  // ✅ Added!
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
    const { imageUrl, responsiveUrls, name, description, category, dimensions } = req.body;
    const userId = req.user.userId;

    // Get existing image to check if we're just updating
    const existingImage = await SiteImage.findOne({ key });
    
    // Validate: Either imageUrl or responsiveUrls must be provided (for new images)
    // For updates, we can keep existing data
    if (!existingImage && !imageUrl && (!responsiveUrls || Object.keys(responsiveUrls).length === 0)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_IMAGE_DATA',
          message: 'Either imageUrl or responsiveUrls is required for new images',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Prepare update data
    const updateData = {
      key,
      name: name || key,
      description: description || '',
      category: category || 'other',
      dimensions: dimensions || {},
      updatedBy: userId
    };

    // Add imageUrl if provided
    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    // Add or merge responsiveUrls if provided
    if (responsiveUrls !== undefined) {
      // If responsiveUrls is provided (even if empty), use it
      // This allows deleting device-specific images
      if (existingImage && existingImage.responsiveUrls && Object.keys(responsiveUrls).length > 0) {
        // Merge with existing responsiveUrls (for adding new devices)
        updateData.responsiveUrls = {
          ...existingImage.responsiveUrls,
          ...responsiveUrls
        };
      } else {
        // Replace with new responsiveUrls (for deleting devices)
        updateData.responsiveUrls = responsiveUrls;
      }
    }

    // Update or create image
    const image = await SiteImage.findOneAndUpdate(
      { key },
      updateData,
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
          responsiveUrls: image.responsiveUrls || {},  // ✅ Added!
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
          responsiveUrls: image.responsiveUrls || {},  // ✅ Added!
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

// @route   DELETE /api/site-images/:key
// @desc    Delete main image (all devices)
// @access  Designer/Admin
router.delete('/:key', auth, designerAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const userId = req.user.userId;

    // Get existing image
    const existingImage = await SiteImage.findOne({ key });
    if (!existingImage) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IMAGE_NOT_FOUND',
          message: 'Image not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Delete the entire image document
    await SiteImage.findOneAndDelete({ key });

    console.log(`🗑️ Deleted entire image: ${key}`);

    res.json({
      success: true,
      data: {
        message: 'Image deleted successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error deleting image:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete image',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/site-images/:key/device/:device
// @desc    Delete device-specific image
// @access  Designer/Admin
router.delete('/:key/device/:device', auth, designerAuth, async (req, res) => {
  try {
    const { key, device } = req.params;
    const userId = req.user.userId;

    // Validate device
    const validDevices = ['desktop', 'tablet', 'mobile'];
    if (!validDevices.includes(device)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DEVICE',
          message: `Device must be one of: ${validDevices.join(', ')}`,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get existing image
    const existingImage = await SiteImage.findOne({ key });
    if (!existingImage) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IMAGE_NOT_FOUND',
          message: 'Image not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if device image exists
    if (!existingImage.responsiveUrls || !existingImage.responsiveUrls[device]) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEVICE_IMAGE_NOT_FOUND',
          message: `No ${device} image found for this slide`,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Remove device from responsiveUrls
    const updatedResponsiveUrls = { ...existingImage.responsiveUrls };
    delete updatedResponsiveUrls[device];

    // Update image
    const updatedImage = await SiteImage.findOneAndUpdate(
      { key },
      { 
        responsiveUrls: updatedResponsiveUrls,
        updatedBy: userId
      },
      { new: true }
    ).populate('updatedBy', 'username');

    console.log(`🗑️ Deleted ${device} image from ${key} by ${updatedImage.updatedBy.username}`);

    res.json({
      success: true,
      data: {
        image: {
          id: updatedImage._id,
          key: updatedImage.key,
          name: updatedImage.name,
          description: updatedImage.description,
          imageUrl: updatedImage.imageUrl,
          responsiveUrls: updatedImage.responsiveUrls || {},
          category: updatedImage.category,
          dimensions: updatedImage.dimensions,
          updatedBy: updatedImage.updatedBy.username,
          updatedAt: updatedImage.updatedAt
        }
      },
      message: `${device.charAt(0).toUpperCase() + device.slice(1)} image deleted successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error deleting device image:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete device image',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
