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
// @desc    WhatsApp webhook verification with proper verify token
// @access  Public
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = req.query['hub.verify_token'];

  console.log('🔍 WhatsApp webhook verification attempt:', {
    mode,
    challenge: challenge ? 'present' : 'missing',
    verifyToken: verifyToken ? 'present' : 'missing',
    expectedToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? 'configured' : 'missing'
  });

  // Proper webhook verification with token check
  if (mode === 'subscribe' && challenge && verifyToken === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ WhatsApp webhook verification failed:', {
      modeMatch: mode === 'subscribe',
      challengePresent: !!challenge,
      tokenMatch: verifyToken === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    });
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
      console.log('❌ Invalid webhook payload - missing object or entry');
      return res.status(404).json({ error: 'Invalid payload' });
    }

    const change = body.entry?.[0]?.changes?.[0]?.value;
    console.log('📱 Webhook change value:', JSON.stringify(change, null, 2));

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
    console.log('📱 Messages found in webhook:', messages ? messages.length : 0);
    
    if (!messages || messages.length === 0) {
      console.log('⚠️ No messages in webhook - only status updates');
      return res.status(200).json({ status: 'no messages' });
    }

    console.log('📱 Processing', messages.length, 'messages...');
    for (const message of messages) {
      console.log('📱 Processing message:', JSON.stringify(message, null, 2));
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
    
    // Check if message has text content
    if (message.type === 'text' && (!message.text || !message.text.body)) {
      console.log('❌ Text message missing text.body field');
      console.log('📱 Message structure:', Object.keys(message));
      if (message.text) {
        console.log('📱 Text object keys:', Object.keys(message.text));
      }
      return;
    }

    // Find registration by phone number (using 10-digit format)
    console.log('🔍 Looking for registration with phone:', shortPhone);
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
    console.log('📱 Registration status:', registration.status);
    console.log('📱 Registration ID:', registration._id);
    console.log('� Messoage type check:', message.type);

    // Check if registration status allows message processing
    if (!['pending', 'images_uploaded'].includes(registration.status)) {
      console.log('⚠️ Registration status not eligible for message processing:', registration.status);
      console.log('⚠️ Only pending and images_uploaded registrations can receive messages');
      return;
    }

    // Handle different message types
    if (message.type === 'image') {
      console.log('📸 Processing as image message');
      await handleImageMessage(message, registration, shortPhone);
    } else if (message.type === 'text') {
      console.log('📱 Processing as text message - calling handleTextMessage');
      console.log('📱 About to call handleTextMessage with:', {
        messageText: message.text.body,
        registrationId: registration._id,
        phoneNumber: shortPhone
      });
      await handleTextMessage(message, registration, shortPhone);
      console.log('📱 handleTextMessage completed successfully');
    } else {
      console.log('❓ Unknown message type:', message.type);
    }
    
    console.log('✅ processIncomingMessage completed successfully');

  } catch (error) {
    console.error('❌ Process message error:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    console.error('❌ Message that caused error:', JSON.stringify(message, null, 2));
  }
}

// Function to handle image messages (fixed duplicate processing and counter)
async function handleImageMessage(message, registration, phoneNumber) {
  try {
    console.log('📸 Processing image message for registration:', registration._id);
    
    const mediaId = message.image.id;
    const caption = message.image.caption || '';
    
    // Check if this image was already processed (prevent duplicates)
    const existingImage = registration.verificationImages?.find(img => img.mediaId === mediaId);
    if (existingImage) {
      console.log('⚠️ Image already processed, skipping:', mediaId);
      return;
    }
    
    // Get media URL from WhatsApp API
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

    // Upload to Cloudinary
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

    // Get current image count BEFORE adding new image
    const currentImages = registration.verificationImages || [];
    const imageCount = currentImages.length;
    
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

    // Add image to registration with mediaId for duplicate prevention
    const imageData = {
      playerId,
      imageNumber,
      cloudinaryUrl: uploadedImage.secure_url,
      publicId: uploadedImage.public_id,
      mediaId: mediaId, // Add mediaId to prevent duplicates
      uploadedAt: new Date(),
      caption: caption
    };

    // Use atomic update to prevent race conditions
    const updatedRegistration = await TournamentRegistration.findByIdAndUpdate(
      registration._id,
      { 
        $push: { verificationImages: imageData },
        $set: { 
          status: (imageCount + 1) >= 8 ? 'images_uploaded' : 'pending'
        }
      },
      { new: true }
    );

    const newImageCount = updatedRegistration.verificationImages.length;

    // Send confirmation message (FREE-FORM MESSAGE - NO TEMPLATE NEEDED)
    const playerName = playerId === 'leader' ? registration.teamLeader.name : 
                      registration.teamMembers[parseInt(playerId.replace('member', '')) - 1]?.name || 'Team Member';
    
    const imageType = imageNumber === 1 ? 'ID Proof' : 'BGMI Screenshot';
    
    const confirmationMessage = newImageCount >= 8 ? 
      `🎉 All verification images received!\n\n` +
      `✅ Registration complete for: ${registration.teamName}\n` +
      `📋 Status: Pending admin verification\n\n` +
      `We'll notify you once your team is verified!` :
      `✅ Image ${newImageCount}/8 received!\n\n` +
      `👤 Player: ${playerName}\n` +
      `📄 Type: ${imageType}\n\n` +
      `📸 Please send ${8 - newImageCount} more images to complete verification.`;
    
    await whatsappService.sendTextMessage(phoneNumber, confirmationMessage);

    // Save to chat interface (for admin dashboard)
    await saveWhatsAppMessage({
      registrationId: registration._id,
      messageType: 'image_received',
      content: `Image ${newImageCount}/8 received from ${playerName}`,
      direction: 'incoming',
      phoneNumber: phoneNumber,
      imageUrl: uploadedImage.secure_url
    });

    console.log(`✅ Image ${newImageCount}/8 saved for registration:`, registration.teamName);

  } catch (error) {
    console.error('❌ Handle image error:', error);
    await whatsappService.sendTextMessage(phoneNumber, 
      '❌ Failed to process your image. Please try sending it again.');
  }
}

// Function to handle text messages with chat interface integration
async function handleTextMessage(message, registration, phoneNumber) {
  try {
    console.log('🔥 ENTERING handleTextMessage function');
    console.log('📱 Message text:', message.text.body);
    console.log('📱 Registration ID:', registration._id);
    console.log('📱 Phone number:', phoneNumber);
    console.log('📱 Registration status:', registration.status);
    
    const text = message.text.body.toLowerCase().trim();
    let responseMessage = '';
    
    // Only respond to specific commands, not every message
    if (text.includes('status') || text.includes('check')) {
      // Send status update
      const imageCount = registration.verificationImages?.length || 0;
      responseMessage = 
        `📊 Registration Status: ${registration.status}\n\n` +
        `� Teamn: ${registration.teamName}\n` +
        `🎮 Tournament: ${registration.tournamentId.name}\n` +
        `📸 Images: ${imageCount}/8\n\n` +
        (imageCount < 8 ? 
          `📸 Please send ${8 - imageCount} more verification images.` :
          '✅ All images received! Pending admin verification.');
    } else if (text.includes('help')) {
      // Send help message
      responseMessage = 
        `🎮 BGMI Registration Help\n\n` +
        `📸 Send 8 verification images:\n` +
        `• 2 images per player (ID + BGMI screenshot)\n` +
        `• Send images one by one\n` +
        `• We'll automatically organize them\n\n` +
        `💬 Commands:\n` +
        `• "status" - Check registration status\n` +
        `• "help" - Show this help message`;
    } else {
      // For regular messages, just save them without auto-response
      console.log('📱 Regular message received, saving without auto-response');
      responseMessage = null; // No automatic response
    }
    
    // Save incoming message to chat interface
    console.log('📱 About to save incoming message to chat interface...');
    console.log('📱 Message data to save:', {
      registrationId: registration._id,
      messageType: 'text_received',
      content: message.text.body,
      direction: 'incoming',
      phoneNumber: phoneNumber
    });
    
    try {
      await saveWhatsAppMessage({
        registrationId: registration._id,
        messageType: 'text_received',
        content: message.text.body,
        direction: 'incoming',
        phoneNumber: phoneNumber
      });
      console.log('✅ Incoming message saved successfully to chat interface');
    } catch (saveError) {
      console.error('❌ Failed to save incoming message:', saveError);
      console.error('❌ Save error details:', {
        name: saveError.name,
        message: saveError.message,
        stack: saveError.stack
      });
    }
    
    // Only send response if there's a specific command
    if (responseMessage) {
      console.log('📱 Sending response for command:', text);
      await whatsappService.sendTextMessage(phoneNumber, responseMessage);
      
      // Save outgoing response to chat interface
      console.log('📱 About to save outgoing response to chat interface...');
      console.log('📱 Response data to save:', {
        registrationId: registration._id,
        messageType: 'text_sent',
        content: responseMessage,
        direction: 'outgoing',
        phoneNumber: phoneNumber
      });
      
      try {
        await saveWhatsAppMessage({
          registrationId: registration._id,
          messageType: 'text_sent',
          content: responseMessage,
          direction: 'outgoing',
          phoneNumber: phoneNumber
        });
        console.log('✅ Outgoing response saved successfully to chat interface');
      } catch (saveError) {
        console.error('❌ Failed to save outgoing response:', saveError);
        console.error('❌ Save error details:', {
          name: saveError.name,
          message: saveError.message,
          stack: saveError.stack
        });
      }
    } else {
      console.log('📱 No auto-response sent for regular message');
    }
    
  } catch (error) {
    console.error('❌ Handle text error:', error);
  }
}

// Helper function to save messages to chat interface
async function saveWhatsAppMessage(messageData) {
  try {
    console.log('💾 Attempting to save message:', {
      registrationId: messageData.registrationId,
      messageType: messageData.messageType,
      direction: messageData.direction,
      contentLength: messageData.content?.length || 0,
      phoneNumber: messageData.phoneNumber
    });
    
    const messageDoc = {
      registrationId: messageData.registrationId,
      messageType: messageData.messageType || 'tournament_update',
      recipientPhone: messageData.phoneNumber,
      messageContent: messageData.content,
      status: 'delivered', // Mark as delivered since it's already processed
      queuedAt: new Date(),
      sentAt: new Date(),
      deliveredAt: new Date(),
      direction: messageData.direction || 'outgoing',
      imageUrl: messageData.imageUrl || null,
      adminUser: messageData.adminUser || null
    };

    // Only add templateName and templateParams for template messages
    if (['registration_success', 'verification_approved', 'verification_rejected'].includes(messageDoc.messageType)) {
      messageDoc.templateName = 'custom_message';
      messageDoc.templateParams = new Map();
    }

    console.log('💾 Creating WhatsAppMessage with data:', JSON.stringify(messageDoc, null, 2));
    const whatsappMessage = new WhatsAppMessage(messageDoc);
    
    console.log('💾 Validating message before save...');
    const validationError = whatsappMessage.validateSync();
    if (validationError) {
      console.error('❌ Validation error:', validationError);
      throw validationError;
    }
    
    console.log('💾 Saving to database...');
    const savedMessage = await whatsappMessage.save();
    console.log('✅ Message saved to chat interface successfully!');
    console.log('✅ Saved message ID:', savedMessage._id);
    return savedMessage;
  } catch (error) {
    console.error('❌ Failed to save message to chat interface:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    console.error('❌ Message data that failed:', JSON.stringify(messageData, null, 2));
    throw error; // Re-throw so calling function knows it failed
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

// @route   GET /api/whatsapp/chat/:registrationId
// @desc    Get chat messages for a specific registration (Admin only)
// @access  Private (Admin)
router.get('/chat/:registrationId', auth, async (req, res) => {
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

    const { registrationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    console.log('📱 Fetching chat messages for registration:', registrationId);

    // Get chat messages for this registration
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const messages = await WhatsAppMessage.find({ registrationId })
      .sort({ queuedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log('📱 Found messages:', messages.length);

    // Get total count
    const total = await WhatsAppMessage.countDocuments({ registrationId });

    // Reverse to show oldest first and map to frontend format
    const formattedMessages = messages.reverse().map(msg => ({
      _id: msg._id,
      content: msg.messageContent, // Map messageContent to content
      direction: msg.direction || (msg.messageType === 'admin_message' ? 'outgoing' : 'incoming'),
      queuedAt: msg.queuedAt,
      createdAt: msg.createdAt,
      status: msg.status,
      imageUrl: msg.imageUrl,
      messageType: msg.messageType
    }));

    res.json({
      success: true,
      data: {
        messages: formattedMessages,
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
    console.error('❌ Get chat messages error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAT_FETCH_FAILED',
        message: 'Failed to fetch chat messages',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/whatsapp/chat/:registrationId/send
// @desc    Send message from admin chat interface
// @access  Private (Admin)
router.post('/chat/:registrationId/send', auth, [
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
          message: 'Invalid message content',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { registrationId } = req.params;
    const { message } = req.body;

    // Find the registration
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

    const phoneNumber = registration.whatsappNumber || registration.teamLeader.phone;
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PHONE_NOT_FOUND',
          message: 'No phone number found for this registration',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Send WhatsApp message
    const result = await whatsappService.sendTextMessage(phoneNumber, message);

    // Save to chat interface
    await saveWhatsAppMessage({
      registrationId: registrationId,
      messageType: 'admin_message',
      content: message,
      direction: 'outgoing',
      phoneNumber: phoneNumber,
      adminUser: user.username
    });

    console.log(`📱 Admin ${user.username} sent message to registration:`, registration.teamName);

    res.json({
      success: result.success,
      data: {
        messageId: result.messageId,
        phoneNumber: phoneNumber,
        adminUser: user.username
      },
      message: result.success ? 
        'Message sent successfully' : 
        'Failed to send message',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Send chat message error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAT_SEND_FAILED',
        message: 'Failed to send chat message',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/whatsapp/image/:registrationId/:imageId
// @desc    Delete verification image (Admin only)
// @access  Private (Admin)
router.delete('/image/:registrationId/:imageId', auth, async (req, res) => {
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

    const { registrationId, imageId } = req.params;

    // Find the registration
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

    // Find the image to delete
    const imageIndex = registration.verificationImages.findIndex(img => img._id.toString() === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IMAGE_NOT_FOUND',
          message: 'Image not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const imageToDelete = registration.verificationImages[imageIndex];

    // Delete from Cloudinary
    if (imageToDelete.publicId) {
      try {
        await cloudinary.uploader.destroy(imageToDelete.publicId);
        console.log('✅ Image deleted from Cloudinary:', imageToDelete.publicId);
      } catch (cloudinaryError) {
        console.error('⚠️ Failed to delete from Cloudinary:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Remove from database
    registration.verificationImages.splice(imageIndex, 1);
    
    // Update status if needed
    if (registration.verificationImages.length < 8 && registration.status === 'images_uploaded') {
      registration.status = 'pending';
    }
    
    await registration.save();

    // Notify user via WhatsApp
    const phoneNumber = registration.whatsappNumber || registration.teamLeader.phone;
    if (phoneNumber) {
      await whatsappService.sendTextMessage(phoneNumber, 
        `⚠️ Admin removed one of your verification images.\n\n` +
        `📸 Current images: ${registration.verificationImages.length}/8\n\n` +
        `Please send ${8 - registration.verificationImages.length} more images to complete verification.`
      );
    }

    console.log(`🗑️ Admin ${user.username} deleted image from registration:`, registration.teamName);

    res.json({
      success: true,
      data: {
        deletedImageId: imageId,
        remainingImages: registration.verificationImages.length,
        newStatus: registration.status
      },
      message: 'Image deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Delete image error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'IMAGE_DELETE_FAILED',
        message: 'Failed to delete image',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/whatsapp/debug/messages/:registrationId
// @desc    Debug endpoint to check messages in database (Admin only)
// @access  Private (Admin)
router.get('/debug/messages/:registrationId', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Admin privileges required'
      });
    }

    const { registrationId } = req.params;
    
    // Get registration info
    const registration = await TournamentRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

    // Get all messages for this registration
    const messages = await WhatsAppMessage.find({ registrationId }).sort({ queuedAt: -1 });
    
    res.json({
      success: true,
      debug: {
        registrationId,
        teamName: registration.teamName,
        whatsappNumber: registration.whatsappNumber,
        teamLeaderPhone: registration.teamLeader.phone,
        registrationStatus: registration.status,
        totalMessages: messages.length,
        messages: messages.map(msg => ({
          id: msg._id,
          type: msg.messageType,
          content: msg.messageContent,
          direction: msg.direction,
          recipientPhone: msg.recipientPhone,
          status: msg.status,
          created: msg.queuedAt,
          adminUser: msg.adminUser
        }))
      }
    });

  } catch (error) {
    console.error('❌ Debug messages error:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;