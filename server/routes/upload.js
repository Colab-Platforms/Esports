const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer Storage with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'esports-banners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1920, height: 1080, crop: 'limit' }]
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware to check designer role
const designerAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'designer' && user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Designer or Admin access required'
        }
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to verify permissions'
      }
    });
  }
};

// @route   POST /api/upload/image
// @desc    Upload image to Cloudinary
// @access  Designer/Admin
router.post('/image', auth, designerAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No image file provided'
        }
      });
    }

    console.log('✅ Image uploaded to Cloudinary:', req.file.path);

    res.json({
      success: true,
      data: {
        imageUrl: req.file.path,
        publicId: req.file.filename,
        width: req.file.width,
        height: req.file.height
      },
      message: 'Image uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Error uploading image:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: 'Failed to upload image'
      }
    });
  }
});

// @route   DELETE /api/upload/image/:publicId
// @desc    Delete image from Cloudinary
// @access  Designer/Admin
router.delete('/image/:publicId', auth, designerAuth, async (req, res) => {
  try {
    const { publicId } = req.params;
    
    await cloudinary.uploader.destroy(publicId);
    
    console.log('🗑️ Image deleted from Cloudinary:', publicId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting image:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: 'Failed to delete image'
      }
    });
  }
});

module.exports = router;
