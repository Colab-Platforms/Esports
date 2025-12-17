const express = require('express');
const { body, validationResult, query } = require('express-validator');
const whatsappService = require('../services/whatsappService');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const TournamentRegistration = require('../models/TournamentRegistration');
const User = require('../models/User');
const auth = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');

const router = express.Router();

// @route   GET /api/whatsapp/webhook
// @desc    WhatsApp webhook verification (simplified - no verify token needed)
// @access  Public
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];

  // Simple verification without token check (as per your working setup)
  if (mode === 'subscribe' && challenge) {
    console.log('✅ WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    console.log('❌ WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

// @route   POST /api/whatsapp/webhook
// @desc    WhatsApp webhook for receiving messages and images
// @access  Public
router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('🔥 WEBHOOK RECEIVED - FULL BODY:');
    console.log(JSON.stringify(req.body, null, 2));

    const body = req.body;

    // Check if this is a WhatsApp API event
    if (!(body.object && body.entry)) {
      return res.status(404).json({ error: 'Invalid payload' });
    }

    const change = body.entry?.[0]?.changes?.[0]?.value;

    // Handle delivery status updates (from your working code)
    if (change?.statuses) {
      change.statuses.forEach((status) => {
        const statusLog = {
          statuses: [{
            status: status.status,
            errors: status.errors ? status.errors.map(err => ({
              code: err.code,
              title: err.title,
              message: err.message
            })) : undefined
          }]
        };
        console.log('📦 DELIVERY STATUS UPDATE:\n' + JSON.stringify(statusLog, null, 2));
      });
    }

    // Handle incoming messages
    const messages = change?.messages;
    if (!messages) {
      return res.status(200).json({ status: 'no messages' });
    }

    for (const message of messages) {
      await processIncomingMessage(message, change);
    }

    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('❌ WhatsApp webhook error:', error);
    res.status(500).send('WEBHOOK_ERROR');
  }
});

// Function to process incoming WhatsApp messages (based on your working code)
async function processIncomingMessage(message, value) {
  try {
    const from = message.from; // e.g., 91987xxxxxxx
    const shortPhone = from.slice(-10); // use 10-digit for matching
    console.log('🔥 PROCESSING MESSAGE:');
    console.log('📱 From:', from, '→ Short:', shortPhone);
    console.log('📱 Message type:', message.type);
    console.log('📱 Full message:', JSON.stringify(message, null, 2));

    // Find registration by phone number (using 10-digit format)
    const registration = await TournamentRegistration.findOne({
      $or: [
        { whatsappNumber: shortPhone },
        { 'teamLeader.phone': shortPhone }
      ],
      status: { $in: ['pending', 'images_uploaded'] }
    }).populate('tournamentId', 'name');

    if (!registration) {
      console.log('❌ No pending registration found for phone:', shortPhone);
      // Send help message
      await whatsappService.sendTextMessage(shortPhone, 
        '❌ No pending registration found. Please register for a tournament first through our website.');
      return;
    }

    console.log('✅ Found registration:', registration.teamName);

    // Handle different message types
    if (message.type === 'image') {
      await handleImageMessage(message, registration, shortPhone);
    } else if (message.type === 'text') {
      await handleTextMessage(message, registration, shortPhone);
    }

  } catch (error) {
    console.error('❌ Process message error:', error);
  }
}

// Function to handle image messages (simplified based on your working code)
async function handleImageMessage(message, registration, phoneNumber) {
  try {
    console.log('📸 Processing image message');
    
    const mediaId = message.image.id;
    const caption = message.image.caption || '';
    
    // Get media URL from WhatsApp API (using your working approach)
    const mediaRes = await axios.get(`https://graph.facebook.com/v24.0/${mediaId}`, {
      headers: { 
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` 
      }
    });
    
    const mediaUrl = mediaRes.data.url;
    
    // Download the image
    const imageResponse = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: { 
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` 
      }
    });

    // Upload to Cloudinary (using your working method)
    const uploadedImage = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: `bgmi_verification/${registration._id}`,
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(imageResponse.data);
    });

    console.log('✅ Uploaded to Cloudinary:', uploadedImage.secure_url);

    // Auto-assign image to player (2 images per player)
    const existingImages = registration.verificationImages || [];
    const imageCount = existingImages.length;
    
    if (imageCount >= 8) {
      await whatsappService.sendTextMessage(phoneNumber, 
        '✅ All 8 verification images already received! Your registration is complete and pending admin verification.');
      return;
    }

    let playerId, imageNumber;
    
    // Simple assignment based on count
    if (imageCount < 2) {
      playerId = 'leader';
      imageNumber = (imageCount % 2) + 1;
    } else if (imageCount < 4) {
      playerId = 'member1';
      imageNumber = ((imageCount - 2) % 2) + 1;
    } else if (imageCount < 6) {
      playerId = 'member2';
      imageNumber = ((imageCount - 4) % 2) + 1;
    } else {
      playerId = 'member3';
      imageNumber = ((imageCount - 6) % 2) + 1;
    }

    // Add image to registration (using your working structure)
    const imageData = {
      playerId,
      imageNumber,
      cloudinaryUrl: uploadedImage.secure_url,
      publicId: uploadedImage.public_id,
      uploadedAt: new Date(),
      caption: caption
    };

    registration.verificationImages.push(imageData);

    // Update status if all 8 images received
    if (registration.verificationImages.length >= 8) {
      registration.status = 'images_uploaded';
    }

    await registration.save();

    // Send confirmation message
    const playerName = playerId === 'leader' ? registration.teamLeader.name : 
                      registration.teamMembers[parseInt(playerId.replace('member', '')) - 1]?.name || 'Team Member';
    
    const imageType = imageNumber === 1 ? 'ID Proof' : 'BGMI Screenshot';
    
    await whatsappService.sendTextMessage(phoneNumber, 
      `✅ Image ${registration.verificationImages.length}/8 received!\n\n` +
      `Player: ${playerName}\n` +
      `Type: ${imageType}\n\n` +
      (registration.verificationImages.length >= 8 ? 
        '🎉 All verification images received! Your registration is now pending admin verification.' :
        `📸 Please send ${8 - registration.verificationImages.length} more images to complete verification.`)
    );

    console.log(`✅ Image ${registration.verificationImages.length}/8 saved for registration:`, registration.teamName);

  } catch (error) {
    console.error('❌ Handle image error:', error);
    await whatsappService.sendTextMessage(phoneNumber, 
      '❌ Failed to process your image. Please try sending it again.');
  }
}

// Function to handle text messages
async function handleTextMessage(message, registration, phoneNumber) {
  try {
    const text = message.text.body.toLowerCase().trim();
    
    if (text.includes('status') || text.includes('check')) {
      // Send status update
      const imageCount = registration.verificationImages?.length || 0;
      const statusMessage = 
        `📊 Registration Status: ${registration.status}\n\n` +
        `Team: ${registration.teamName}\n` +
        `Tournament: ${registration.tournamentId.name}\n` +
        `Images: ${imageCount}/8\n\n` +
        (imageCount < 8 ? 
          `📸 Please send ${8 - imageCount} more verification images.` :
          '✅ All images received! Pending admin verification.');
      
      await whatsappService.sendTextMessage(phoneNumber, statusMessage);
    } else if (text.includes('help')) {
      // Send help message
      const helpMessage = 
        `🎮 BGMI Registration Help\n\n` +
        `📸 Send 8 verification images:\n` +
        `• 2 images per player (ID + BGMI screenshot)\n` +
        `• Send images one by one\n` +
        `• We'll automatically organize them\n\n` +
        `💬 Commands:\n` +
        `• "status" - Check registration status\n` +
        `• "help" - Show this help message`;
      
      await whatsappService.sendTextMessage(phoneNumber, helpMessage);
    } else {
      // Default response
      await whatsappService.sendTextMessage(phoneNumber, 
        `📸 Please send your verification images (${(registration.verificationImages?.length || 0)}/8 received)\n\n` +
        `Type "help" for instructions or "status" to check progress.`);
    }
  } catch (error) {
    console.error('❌ Handle text error:', error);
  }
}

// @route   POST /api/whatsapp/test
// @desc    Test WhatsApp configuration (Admin only)
// @access  Private (Admin)
router.post('/test', auth, [
  body('phoneNumber')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Phone number must be a valid Indian number')
], async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid phone number',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { phoneNumber } = req.body;

    console.log('🧪 Admin testing WhatsApp configuration:', {
      adminUser: user.username,
      testPhone: phoneNumber
    });

    const testResult = await whatsappService.testConfiguration(phoneNumber);

    res.json({
      success: testResult.success,
      data: testResult,
      message: testResult.success ? 
        '✅ WhatsApp test message sent successfully' : 
        '❌ WhatsApp test failed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ WhatsApp test error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WHATSAPP_TEST_FAILED',
        message: 'Failed to test WhatsApp configuration',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/whatsapp/send-text
// @desc    Send custom text message (Admin only)
// @access  Private (Admin)
router.post('/send-text', auth, [
  body('phoneNumber')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Phone number must be a valid Indian number'),
  body('message')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be 1-1000 characters')
], async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

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

    const { phoneNumber, message } = req.body;

    console.log('📱 Admin sending custom WhatsApp message:', {
      adminUser: user.username,
      recipient: phoneNumber,
      messageLength: message.length
    });

    const result = await whatsappService.sendTextMessage(phoneNumber, message);

    res.json({
      success: result.success,
      data: {
        messageId: result.messageId,
        error: result.error
      },
      message: result.success ? 
        '✅ WhatsApp message sent successfully' : 
        '❌ WhatsApp message failed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Send WhatsApp text error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WHATSAPP_SEND_FAILED',
        message: 'Failed to send WhatsApp message',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/whatsapp/process-queue
// @desc    Process queued WhatsApp messages (Admin only)
// @access  Private (Admin)
router.post('/process-queue', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('📱 Admin processing WhatsApp message queue:', {
      adminUser: user.username
    });

    const result = await whatsappService.processQueuedMessages();

    res.json({
      success: true,
      data: result,
      message: `📱 Processed ${result.processed} messages, ${result.failed} failed`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Process WhatsApp queue error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'QUEUE_PROCESS_FAILED',
        message: 'Failed to process WhatsApp message queue',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/whatsapp/stats
// @desc    Get WhatsApp message statistics (Admin only)
// @access  Private (Admin)
router.get('/stats', auth, [
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('messageType').optional().isIn(['registration_success', 'verification_approved', 'verification_rejected', 'tournament_update'])
], async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { dateFrom, dateTo, messageType } = req.query;

    const filters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (messageType) filters.messageType = messageType;

    const stats = await whatsappService.getMessageStats(filters);

    res.json({
      success: true,
      data: stats,
      message: 'WhatsApp message statistics retrieved',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get WhatsApp stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_FAILED',
        message: 'Failed to fetch WhatsApp statistics',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/whatsapp/messages
// @desc    Get WhatsApp message history (Admin only)
// @access  Private (Admin)
router.get('/messages', auth, [
  query('status').optional().isIn(['queued', 'sent', 'delivered', 'read', 'failed']),
  query('messageType').optional().isIn(['registration_success', 'verification_approved', 'verification_rejected', 'tournament_update']),
  query('recipientPhone').optional().matches(/^[6-9]\d{9}$/),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { status, messageType, recipientPhone, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (messageType) query.messageType = messageType;
    if (recipientPhone) query.recipientPhone = recipientPhone;

    // Get messages with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const messages = await WhatsAppMessage.find(query)
      .populate('registrationId', 'teamName')
      .sort({ queuedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await WhatsAppMessage.countDocuments(query);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get WhatsApp messages error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MESSAGES_FETCH_FAILED',
        message: 'Failed to fetch WhatsApp messages',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/whatsapp/retry/:messageId
// @desc    Retry failed WhatsApp message (Admin only)
// @access  Private (Admin)
router.post('/retry/:messageId', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { messageId } = req.params;

    const message = await WhatsAppMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: 'WhatsApp message not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if retry is possible
    if (!message.canRetry()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'RETRY_NOT_ALLOWED',
          message: 'Message cannot be retried (max retries exceeded or not failed)',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('🔄 Admin retrying WhatsApp message:', {
      adminUser: user.username,
      messageId: message._id,
      messageType: message.messageType,
      retryCount: message.retryCount
    });

    // Reset status to queued for processing
    message.status = 'queued';
    await message.save();

    // Process the message immediately
    const result = await whatsappService.processQueuedMessages();

    res.json({
      success: true,
      data: {
        messageId: message._id,
        retryCount: message.retryCount,
        processResult: result
      },
      message: 'WhatsApp message queued for retry',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Retry WhatsApp message error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RETRY_FAILED',
        message: 'Failed to retry WhatsApp message',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/whatsapp/send-template
// @desc    Send template message (Admin only) - based on your working code
// @access  Private (Admin)
router.post('/send-template', auth, [
  body('phoneNumber')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Phone number must be a valid Indian number'),
  body('templateName')
    .isIn(['verified', 'not_eligible', 'pending', 'game_greeting'])
    .withMessage('Invalid template name')
], async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { phoneNumber, templateName } = req.body;

    console.log(`📱 Admin sending template message: ${templateName} → ${phoneNumber}`);

    // Send template message using your working approach
    const url = `${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: `91${phoneNumber}`, // Add country code
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' }
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Template message sent: ${templateName} → ${phoneNumber}`);

    res.json({
      success: true,
      data: {
        messageId: response.data.messages?.[0]?.id,
        templateName,
        phoneNumber
      },
      message: 'Template message sent successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Send template message error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATE_SEND_FAILED',
        message: 'Failed to send template message',
        details: error.response?.data || error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;