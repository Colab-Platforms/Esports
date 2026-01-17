const axios = require('axios');
const WhatsAppMessage = require('../models/WhatsAppMessage');

class WhatsAppService {
  constructor() {
    // WhatsApp Business API Configuration
    this.baseURL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v24.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    
    // Message Templates (must be approved by Meta)
    // Template names from your existing WhatsApp Business account
    this.templates = {
      registration_success: 'game_greeting', // Registration successful message
      verification_approved: 'verified', // Verification approved message
      verification_rejected: 'not_eligible', // Verification rejected message
      tournament_update: 'pending' // Tournament update message
    };
    
    // Rate limiting
    this.rateLimitDelay = 1000; // 1 second between messages
    this.lastMessageTime = 0;
    
    console.log('📱 WhatsApp Service initialized:', {
      hasPhoneNumberId: !!this.phoneNumberId,
      hasAccessToken: !!this.accessToken,
      baseURL: this.baseURL
    });
  }

  /**
   * Format Indian phone number for WhatsApp API
   * @param {string} phoneNumber - 10-digit Indian phone number
   * @returns {string} - Formatted phone number with country code
   */
  formatPhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add India country code if not present
    if (cleaned.length === 10 && cleaned.match(/^[6-9]/)) {
      return `91${cleaned}`;
    }
    
    // If already has country code
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return cleaned;
    }
    
    throw new Error(`Invalid Indian phone number: ${phoneNumber}`);
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} - True if valid
   */
  isValidPhoneNumber(phoneNumber) {
    try {
      this.formatPhoneNumber(phoneNumber);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Rate limiting helper
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessageTime;
    
    if (timeSinceLastMessage < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastMessage;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastMessageTime = Date.now();
  }

  /**
   * Send WhatsApp message using Business API
   * @param {string} to - Recipient phone number
   * @param {string} templateName - Template name
   * @param {Array} templateParams - Template parameters
   * @param {Object} options - Additional options (image, etc.)
   * @returns {Object} - API response
   */
  async sendTemplateMessage(to, templateName, templateParams = [], options = {}) {
    try {
      // Check if WhatsApp is configured
      if (!this.phoneNumberId || !this.accessToken) {
        console.warn('⚠️ WhatsApp not configured - message not sent');
        return {
          success: false,
          error: 'WhatsApp API not configured',
          messageId: null
        };
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(to);
      
      // Enforce rate limiting
      await this.enforceRateLimit();

      // Prepare message payload
      const messageData = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en' // English templates
          }
        }
      };

      // Add components based on template type
      const components = [];

      // Add header component if image is provided (for game_greeting template)
      if (options.headerImage) {
        components.push({
          type: 'header',
          parameters: [{
            type: 'image',
            image: {
              link: options.headerImage
            }
          }]
        });
      }

      // Add body parameters if provided
      if (templateParams && templateParams.length > 0) {
        components.push({
          type: 'body',
          parameters: templateParams.map(param => ({
            type: 'text',
            text: param
          }))
        });
      }

      // Add components to template if any exist
      if (components.length > 0) {
        messageData.template.components = components;
      }

      console.log('📱 Sending WhatsApp message:', {
        to: formattedPhone,
        template: templateName,
        params: templateParams
      });

      // Send message via WhatsApp Business API
      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log('✅ WhatsApp message sent successfully:', {
        messageId: response.data.messages?.[0]?.id,
        to: formattedPhone
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        response: response.data
      };

    } catch (error) {
      console.error('❌ WhatsApp message send failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        to: to,
        template: templateName
      });

      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        messageId: null
      };
    }
  }

  /**
   * Send simple text message (for testing)
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @returns {Object} - API response
   */
  async sendTextMessage(to, text) {
    try {
      // Check if WhatsApp is configured
      if (!this.phoneNumberId || !this.accessToken) {
        console.warn('⚠️ WhatsApp not configured - message not sent');
        return {
          success: false,
          error: 'WhatsApp API not configured',
          messageId: null
        };
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(to);
      
      // Enforce rate limiting
      await this.enforceRateLimit();

      const messageData = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: text
        }
      };

      console.log('📱 Sending WhatsApp text message:', {
        to: formattedPhone,
        text: text.substring(0, 50) + '...'
      });

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('✅ WhatsApp text message sent successfully:', {
        messageId: response.data.messages?.[0]?.id,
        to: formattedPhone
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        response: response.data
      };

    } catch (error) {
      console.error('❌ WhatsApp text message send failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        to: to
      });

      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        messageId: null
      };
    }
  }

  /**
   * Send registration success message
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} teamName - Team name
   * @param {string} tournamentName - Tournament name
   * @returns {Object} - Send result
   */
  async sendRegistrationSuccess(phoneNumber, teamName, tournamentName) {
    try {
      console.log('📱 Sending registration success message:', {
        phone: phoneNumber,
        team: teamName,
        tournament: tournamentName
      });

      // Try template with header image (like your working code)
      let result;
      
      try {
        result = await this.sendTemplateMessage(
          phoneNumber, 
          this.templates.registration_success,
          [], // No body parameters for game_greeting
          {
            headerImage: 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/POSTTTTT_1.jpg?v=1768627409'
          }
        );
        
        if (!result.success) {
          throw new Error('Template failed: ' + result.error);
        }
      } catch (templateError) {
        console.log('📱 Template failed, sending text message:', templateError.message);
        
        // Fallback to text message
        const messageText = `🎮 Registration Successful!

Team: ${teamName}
Tournament: ${tournamentName}

📸 Next Step: Send 8 verification images via WhatsApp:
• 2 images per player (ID proof + BGMI screenshot)
• Send images one by one to this number
• We'll automatically organize them by player

💬 Reply "OK" to confirm you received this message, then start sending images.

Start sending your verification images now! 📸`;

        result = await this.sendTextMessage(phoneNumber, messageText);
      }
      
      if (result.success) {
        console.log('✅ Registration success message sent');
      } else {
        console.error('❌ Registration success message failed:', result.error);
      }

      return result;

    } catch (error) {
      console.error('❌ Send registration success error:', error);
      return {
        success: false,
        error: error.message,
        messageId: null
      };
    }
  }

  /**
   * Send verification approval message (alias)
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} teamName - Team name
   * @param {string} tournamentName - Tournament name
   * @param {Object} tournamentDetails - Tournament details
   * @returns {Object} - Send result
   */
  async sendVerificationApproval(phoneNumber, teamName, tournamentName, tournamentDetails = {}) {
    return this.sendVerificationApproved(phoneNumber, teamName, tournamentName, tournamentDetails);
  }

  /**
   * Send verification approved message
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} teamName - Team name
   * @param {string} tournamentName - Tournament name
   * @param {Object} tournamentDetails - Tournament details
   * @returns {Object} - Send result
   */
  async sendVerificationApproved(phoneNumber, teamName, tournamentName, tournamentDetails = {}) {
    try {
      console.log('📱 Sending verification approved message:', {
        phone: phoneNumber,
        team: teamName,
        tournament: tournamentName
      });

      const messageText = `✅ Verification Approved!

Team: ${teamName}
Tournament: ${tournamentName}

Your registration has been verified! 

Tournament Details:
📅 Date: ${tournamentDetails.date || 'TBD'}
⏰ Time: ${tournamentDetails.time || 'TBD'}
🎮 Mode: ${tournamentDetails.mode || 'Squad'}

Room details will be shared 30 minutes before the match.

Best of luck! 🏆`;

      const result = await this.sendTextMessage(phoneNumber, messageText);
      
      if (result.success) {
        console.log('✅ Verification approved message sent');
      } else {
        console.error('❌ Verification approved message failed:', result.error);
      }

      return result;

    } catch (error) {
      console.error('❌ Send verification approved error:', error);
      return {
        success: false,
        error: error.message,
        messageId: null
      };
    }
  }

  /**
   * Send verification rejected message
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} teamName - Team name
   * @param {string} tournamentName - Tournament name
   * @param {string} reason - Rejection reason
   * @returns {Object} - Send result
   */
  async sendVerificationRejected(phoneNumber, teamName, tournamentName, reason) {
    try {
      console.log('📱 Sending verification rejected message:', {
        phone: phoneNumber,
        team: teamName,
        tournament: tournamentName,
        reason: reason
      });

      const messageText = `❌ Verification Rejected

Team: ${teamName}
Tournament: ${tournamentName}

Reason: ${reason}

You can re-register with correct information.

Contact support if you need help.`;

      const result = await this.sendTextMessage(phoneNumber, messageText);
      
      if (result.success) {
        console.log('✅ Verification rejected message sent');
      } else {
        console.error('❌ Verification rejected message failed:', result.error);
      }

      return result;

    } catch (error) {
      console.error('❌ Send verification rejected error:', error);
      return {
        success: false,
        error: error.message,
        messageId: null
      };
    }
  }

  /**
   * Send pending status message
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} teamName - Team name
   * @param {string} tournamentName - Tournament name
   * @param {string} reason - Reason for pending status
   * @returns {Object} - Send result
   */
  async sendPendingStatusMessage(phoneNumber, teamName, tournamentName, reason) {
    try {
      console.log('📱 Sending pending status message:', {
        phone: phoneNumber,
        team: teamName,
        tournament: tournamentName,
        reason: reason
      });

      const messageText = `⏳ Registration Status: Pending

Team: ${teamName}
Tournament: ${tournamentName}

${reason ? `Reason: ${reason}` : 'Your registration is under review.'}

📸 Please ensure you have sent all required verification images:
• 2 images per player (ID proof + BGMI screenshot)
• Total 8 images for 4 players

Send any missing images via WhatsApp to complete your registration.

Contact support if you need help.`;

      const result = await this.sendTextMessage(phoneNumber, messageText);
      
      if (result.success) {
        console.log('✅ Pending status message sent');
      } else {
        console.error('❌ Pending status message failed:', result.error);
      }

      return result;

    } catch (error) {
      console.error('❌ Send pending status error:', error);
      return {
        success: false,
        error: error.message,
        messageId: null
      };
    }
  }

  /**
   * Process queued WhatsApp messages
   * This should be called periodically by a cron job
   */
  async processQueuedMessages() {
    try {
      console.log('📱 Processing queued WhatsApp messages...');

      // Get queued messages
      const queuedMessages = await WhatsAppMessage.find({
        status: 'queued'
      }).limit(10); // Process 10 at a time

      if (queuedMessages.length === 0) {
        console.log('📱 No queued messages to process');
        return { processed: 0, failed: 0 };
      }

      let processed = 0;
      let failed = 0;

      for (const message of queuedMessages) {
        try {
          let result;

          // Send message based on type
          switch (message.messageType) {
            case 'registration_success':
              const regParams = message.templateParams;
              result = await this.sendRegistrationSuccess(
                message.recipientPhone,
                regParams.get('team_name'),
                regParams.get('tournament_name')
              );
              break;

            case 'verification_approved':
              const approvedParams = message.templateParams;
              result = await this.sendVerificationApproved(
                message.recipientPhone,
                approvedParams.get('team_name'),
                approvedParams.get('tournament_name'),
                {
                  date: approvedParams.get('tournament_date'),
                  time: approvedParams.get('tournament_time')
                }
              );
              break;

            case 'verification_rejected':
              const rejectedParams = message.templateParams;
              result = await this.sendVerificationRejected(
                message.recipientPhone,
                rejectedParams.get('team_name'),
                rejectedParams.get('tournament_name'),
                rejectedParams.get('rejection_reason')
              );
              break;

            default:
              console.warn(`⚠️ Unknown message type: ${message.messageType}`);
              continue;
          }

          // Update message status
          if (result.success) {
            await message.markAsSent(result.messageId);
            processed++;
          } else {
            await message.markAsFailed(result.error);
            failed++;
          }

        } catch (error) {
          console.error(`❌ Failed to process message ${message._id}:`, error);
          await message.markAsFailed(error.message);
          failed++;
        }
      }

      console.log(`📱 Message processing complete: ${processed} sent, ${failed} failed`);
      return { processed, failed };

    } catch (error) {
      console.error('❌ Process queued messages error:', error);
      return { processed: 0, failed: 0 };
    }
  }

  /**
   * Get message delivery statistics
   * @param {Object} filters - Date filters
   * @returns {Object} - Statistics
   */
  async getMessageStats(filters = {}) {
    try {
      const stats = await WhatsAppMessage.getMessageStats(filters);
      
      const summary = {
        total: 0,
        queued: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        avgDeliveryTime: 0
      };

      stats.forEach(stat => {
        summary.total += stat.count;
        summary[stat._id] = stat.count;
        if (stat.avgDeliveryTime) {
          summary.avgDeliveryTime = Math.round(stat.avgDeliveryTime / 1000); // Convert to seconds
        }
      });

      return summary;

    } catch (error) {
      console.error('❌ Get message stats error:', error);
      return null;
    }
  }

  /**
   * Test WhatsApp configuration
   * @param {string} testPhoneNumber - Phone number to test with
   * @returns {Object} - Test result
   */
  async testConfiguration(testPhoneNumber) {
    try {
      console.log('🧪 Testing WhatsApp configuration...');

      if (!this.phoneNumberId || !this.accessToken) {
        return {
          success: false,
          error: 'WhatsApp API credentials not configured',
          details: {
            hasPhoneNumberId: !!this.phoneNumberId,
            hasAccessToken: !!this.accessToken
          }
        };
      }

      // Test phone number validation
      if (!this.isValidPhoneNumber(testPhoneNumber)) {
        return {
          success: false,
          error: 'Invalid test phone number format'
        };
      }

      // Send test message
      const result = await this.sendTextMessage(
        testPhoneNumber,
        '🧪 WhatsApp API Test Message\n\nThis is a test message to verify WhatsApp integration is working correctly.'
      );

      return {
        success: result.success,
        error: result.error,
        messageId: result.messageId,
        details: {
          phoneNumberId: this.phoneNumberId,
          formattedPhone: this.formatPhoneNumber(testPhoneNumber)
        }
      };

    } catch (error) {
      console.error('❌ WhatsApp test error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new WhatsAppService();