const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const TournamentRegistration = require('../models/TournamentRegistration');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
    files: 8 // Maximum 8 files at once
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// @route   POST /api/bgmi-images/:registrationId/upload
// @desc    Upload verification images for BGMI registration (8 images: 2 per player)
// @access  Private
router.post('/:registrationId/upload', auth, upload.array('images', 8), [
  body('imageLabels')
    .isArray({ min: 1, max: 8 })
    .withMessage('Image labels must be an array of 1-8 items'),
  body('imageLabels.*')
    .isIn(['leader_1', 'leader_2', 'member1_1', 'member1_2', 'member2_1', 'member2_2', 'member3_1', 'member3_2'])
    .withMessage('Invalid image label')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { registrationId } = req.params;
    const { imageLabels } = req.body;

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILES',
          message: 'No image files uploaded',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate number of files matches labels
    if (req.files.length !== imageLabels.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_LABEL_MISMATCH',
          message: 'Number of files must match number of labels',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Find registration
    const registration = await TournamentRegistration.findById(registrationId)
      .populate('tournamentId', 'name gameType')
      .populate('userId', 'username');

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user owns this registration
    if (registration.userId._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only upload images for your own registration',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if registration is in correct status
    if (!['pending', 'images_uploaded'].includes(registration.status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Images can only be uploaded for pending registrations',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('📸 Uploading verification images:', {
      registrationId,
      teamName: registration.teamName,
      imageCount: req.files.length,
      labels: imageLabels
    });

    const uploadedImages = [];
    const uploadErrors = [];

    // Upload each image to Cloudinary
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const label = imageLabels[i];

      try {
        console.log(`📤 Uploading image ${i + 1}/${req.files.length}: ${label}`);

        // Parse label to get player and image number
        const [playerId, imageNumber] = label.split('_');
        
        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `bgmi-verification/${registrationId}`,
              public_id: `${playerId}_${imageNumber}_${Date.now()}`,
              resource_type: 'image',
              transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' },
                { width: 1200, height: 1200, crop: 'limit' } // Limit size for storage efficiency
              ]
            },
            (error, result) => {
              if (error) {
                console.error(`❌ Cloudinary upload error for ${label}:`, error);
                reject(error);
              } else {
                console.log(`✅ Cloudinary upload success for ${label}:`, result.secure_url);
                resolve(result);
              }
            }
          );
          
          uploadStream.end(file.buffer);
        });

        // Add to registration's verification images
        await registration.addVerificationImage(
          playerId,
          parseInt(imageNumber),
          uploadResult.secure_url,
          uploadResult.public_id
        );

        uploadedImages.push({
          label,
          playerId,
          imageNumber: parseInt(imageNumber),
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          size: uploadResult.bytes
        });

      } catch (error) {
        console.error(`❌ Upload failed for ${label}:`, error);
        uploadErrors.push({
          label,
          error: error.message
        });
      }
    }

    // Refresh registration to get updated data
    await registration.populate('tournamentId', 'name gameType');
    await registration.populate('userId', 'username');

    const response = {
      success: uploadErrors.length === 0,
      data: {
        registration,
        uploadedImages,
        totalImages: registration.verificationImages.length,
        allImagesUploaded: registration.allImagesUploaded
      },
      message: uploadErrors.length === 0 
        ? `✅ ${uploadedImages.length} images uploaded successfully`
        : `⚠️ ${uploadedImages.length} images uploaded, ${uploadErrors.length} failed`,
      timestamp: new Date().toISOString()
    };

    if (uploadErrors.length > 0) {
      response.errors = uploadErrors;
    }

    // If all 8 images are now uploaded, log success
    if (registration.allImagesUploaded) {
      console.log('🎉 All 8 verification images uploaded for registration:', registrationId);
    }

    res.status(uploadErrors.length === 0 ? 200 : 207).json(response); // 207 = Multi-Status

  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Failed to upload verification images',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/bgmi-images/:registrationId/images
// @desc    Get verification images for a registration
// @access  Private
router.get('/:registrationId/images', auth, async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await TournamentRegistration.findById(registrationId)
      .populate('tournamentId', 'name gameType')
      .populate('userId', 'username');

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check access permissions
    const user = await User.findById(req.user.userId);
    const isOwner = registration.userId._id.toString() === req.user.userId;
    const isAdmin = user && ['admin', 'moderator'].includes(user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only view your own registration images',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Organize images by player
    const imagesByPlayer = registration.imagesByPlayer;

    res.json({
      success: true,
      data: {
        registrationId: registration._id,
        teamName: registration.teamName,
        status: registration.status,
        totalImages: registration.verificationImages.length,
        allImagesUploaded: registration.allImagesUploaded,
        images: registration.verificationImages,
        imagesByPlayer
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get images error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_IMAGES_FAILED',
        message: 'Failed to fetch verification images',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/bgmi-images/:registrationId/image/:imageId
// @desc    Delete a specific verification image
// @access  Private
router.delete('/:registrationId/image/:imageId', auth, async (req, res) => {
  try {
    const { registrationId, imageId } = req.params;

    const registration = await TournamentRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user owns this registration
    if (registration.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only delete your own registration images',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if registration allows image deletion
    if (!['pending', 'images_uploaded'].includes(registration.status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Images can only be deleted for pending registrations',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Find the image
    const imageIndex = registration.verificationImages.findIndex(
      img => img._id.toString() === imageId
    );

    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IMAGE_NOT_FOUND',
          message: 'Verification image not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const image = registration.verificationImages[imageIndex];

    try {
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(image.publicId);
      console.log('✅ Image deleted from Cloudinary:', image.publicId);
    } catch (cloudinaryError) {
      console.error('❌ Cloudinary delete error:', cloudinaryError);
      // Continue with database deletion even if Cloudinary fails
    }

    // Remove from database
    registration.verificationImages.splice(imageIndex, 1);
    
    // Update status if no longer all images uploaded
    if (registration.status === 'images_uploaded' && registration.verificationImages.length < 8) {
      registration.status = 'pending';
    }
    
    await registration.save();

    res.json({
      success: true,
      data: {
        deletedImage: {
          id: imageId,
          playerId: image.playerId,
          imageNumber: image.imageNumber
        },
        remainingImages: registration.verificationImages.length,
        allImagesUploaded: registration.allImagesUploaded
      },
      message: 'Verification image deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Delete image error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete verification image',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/bgmi-images/:registrationId/replace/:playerId/:imageNumber
// @desc    Replace a specific verification image
// @access  Private
router.post('/:registrationId/replace/:playerId/:imageNumber', auth, upload.single('image'), async (req, res) => {
  try {
    const { registrationId, playerId, imageNumber } = req.params;

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

    const registration = await TournamentRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user owns this registration
    if (registration.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only replace your own registration images',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate playerId and imageNumber
    const validPlayerIds = ['leader', 'member1', 'member2', 'member3'];
    const validImageNumbers = ['1', '2'];

    if (!validPlayerIds.includes(playerId) || !validImageNumbers.includes(imageNumber)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Invalid playerId or imageNumber',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`🔄 Replacing image for ${playerId}_${imageNumber}:`, registrationId);

    // Find existing image to delete
    const existingImage = registration.verificationImages.find(
      img => img.playerId === playerId && img.imageNumber === parseInt(imageNumber)
    );

    // Upload new image to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `bgmi-verification/${registrationId}`,
          public_id: `${playerId}_${imageNumber}_${Date.now()}`,
          resource_type: 'image',
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
            { width: 1200, height: 1200, crop: 'limit' }
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
      
      uploadStream.end(req.file.buffer);
    });

    // Delete old image from Cloudinary if it exists
    if (existingImage) {
      try {
        await cloudinary.uploader.destroy(existingImage.publicId);
        console.log('✅ Old image deleted from Cloudinary:', existingImage.publicId);
      } catch (deleteError) {
        console.error('❌ Failed to delete old image:', deleteError);
        // Continue anyway
      }
    }

    // Add/replace image in registration
    await registration.addVerificationImage(
      playerId,
      parseInt(imageNumber),
      uploadResult.secure_url,
      uploadResult.public_id
    );

    res.json({
      success: true,
      data: {
        playerId,
        imageNumber: parseInt(imageNumber),
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        totalImages: registration.verificationImages.length,
        allImagesUploaded: registration.allImagesUploaded
      },
      message: `Image replaced successfully for ${playerId} image ${imageNumber}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Replace image error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REPLACE_FAILED',
        message: 'Failed to replace verification image',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;