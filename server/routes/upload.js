const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { uploadAvatar, uploadTeamLogo } = require('../middleware/upload');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

// Never accept a URL, filename or publicId supplied by the client as a delete target.
const ownedAvatarId = (userId, publicId) => typeof publicId === 'string' &&
  publicId.startsWith(`esports/avatars/${userId}/`) &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(publicId.slice(`esports/avatars/${userId}/`.length));

// @route   POST /api/upload/avatar
// @desc    Upload user avatar to Cloudinary
// @access  Private
router.post('/avatar', auth, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded'
        }
      });
    }

    const userId = req.user.userId;
    const avatarUrl = req.file.path; // Cloudinary URL
    if (!ownedAvatarId(userId, req.file.filename)) throw new Error('Invalid avatar upload reference');

    console.log('📸 Avatar uploaded:', avatarUrl);

    // Update user's avatar in database
    const user = await User.findByIdAndUpdate(
      userId,
      { avatarUrl, avatarAsset: { publicId: req.file.filename, url: avatarUrl } },
      { new: true }
    ).select('-passwordHash');
    if (!user) throw new Error('User no longer exists');

    res.json({
      success: true,
      data: {
        avatarUrl,
        user
      },
      message: 'Avatar uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Avatar upload error:', error);
    
    // Delete uploaded file if database update fails
    if (req.file && ownedAvatarId(req.user.userId, req.file.filename)) {
      try {
        await cloudinary.uploader.destroy(req.file.filename);
      } catch (deleteError) {
        console.error('Error deleting file:', deleteError);
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: error.message || 'Failed to upload avatar'
      }
    });
  }
});

// @route   DELETE /api/upload/avatar
// @desc    Delete user avatar from Cloudinary
// @access  Private
router.delete('/avatar', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('+avatarAsset');
    if (!user) return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND' } });

    if (!user.avatarUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_AVATAR',
          message: 'No avatar to delete'
        }
      });
    }

    const asset = user.avatarAsset;
    if (asset && !ownedAvatarId(userId, asset.publicId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_AVATAR_ASSET' } });
    }
    // Changed/legacy display URLs can be cleared but never establish ownership.
    if (asset && asset.url === user.avatarUrl) await cloudinary.uploader.destroy(asset.publicId);

    // Do not erase an avatar uploaded concurrently while Cloudinary was responding.
    const filter = { _id: userId, avatarUrl: user.avatarUrl };
    filter['avatarAsset.publicId'] = asset ? asset.publicId : { $exists: false };
    const cleared = await User.updateOne(filter, { $set: { avatarUrl: '' }, $unset: { avatarAsset: '' } });
    if (!cleared.matchedCount) return res.status(409).json({ success: false, error: { code: 'AVATAR_CHANGED' } });

    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });

  } catch (error) {
    console.error('❌ Avatar delete error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: 'Failed to delete avatar'
      }
    });
  }
});

// @route   POST /api/upload/team-logo
// @desc    Upload team logo to Cloudinary
// @access  Private
router.post('/team-logo', auth, uploadTeamLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded'
        }
      });
    }

    const logoUrl = req.file.path;

    res.json({
      success: true,
      data: {
        logoUrl
      },
      message: 'Team logo uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Team logo upload error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: 'Failed to upload team logo'
      }
    });
  }
});

// @route   POST /api/upload/image
// @desc    Upload any image to Cloudinary (for site images, banners, etc.)
// @access  Private (Designer/Admin)
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

router.post('/image', auth, adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No image file uploaded',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('📤 Uploading image to Cloudinary...');
    console.log('File size:', (req.file.size / 1024).toFixed(2), 'KB');

    // Upload to Cloudinary using upload_stream
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'site-images',
          resource_type: 'image',
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload success:', result.secure_url);
            resolve(result);
          }
        }
      );
      
      // Write buffer to stream
      uploadStream.end(req.file.buffer);
    });

    res.json({
      success: true,
      data: {
        imageUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        size: uploadResult.bytes
      },
      message: 'Image uploaded successfully to Cloudinary',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: error.message || 'Failed to upload image to Cloudinary',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
