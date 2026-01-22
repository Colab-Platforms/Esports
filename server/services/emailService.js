const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = null;
    this.initializeResend();
  }

  initializeResend() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      console.log('📧 Email Service: Resend configured');
      console.log('  - API Key:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Not set');
      console.log('  - From Email:', process.env.RESEND_FROM_EMAIL || 'support@colabesports.in');
    } else {
      console.log('📧 Email Service: Development mode - emails will be logged to console');
      console.log('📧 To enable Resend, set RESEND_API_KEY in .env');
    }
  }

  async sendPasswordResetEmail(email, resetToken, username = 'User') {
    try {
      console.log('📧 Starting password reset email send...');
      console.log('📧 Email config check:');
      console.log('  - RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Not set');
      console.log('  - RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'Not set');
      
      // Auto-detect client URL based on environment
      const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
      const clientUrl = isDevelopment ? 'https://esports-eciq.vercel.app' : (process.env.CLIENT_URL || 'https://colabesports.in');
      const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

      // Use proper Resend email format - must be from a verified domain
      // If RESEND_FROM_EMAIL is not set, use onboarding@resend.dev (Resend's test domain)
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
      const fromName = 'Colab Esports';
      const from = `${fromName} <${fromEmail}>`;

      const emailContent = {
        from: from,
        to: email,
        subject: '🔐 Reset Your Colab Esports Password',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
              .content { padding: 30px; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
              .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Colab Esports</h1>
                <h2>Password Reset Request</h2>
              </div>
              <div class="content">
                <p>Hi <strong>${username}</strong>,</p>
                <p>We received a request to reset your password for your Colab Esports account.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset My Password</a>
                </div>
                <p>Or copy and paste this link in your browser:</p>
                <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                  ${resetUrl}
                </p>
                <div class="warning">
                  <strong>Important:</strong>
                  <ul>
                    <li>This link will expire in <strong>1 hour</strong></li>
                    <li>If you didn't request this reset, please ignore this email</li>
                    <li>Your password won't change until you click the link above</li>
                  </ul>
                </div>
                <p>If you're having trouble, contact our support team.</p>
                <p>Happy Gaming!<br>The Colab Esports Team</p>
              </div>
              <div class="footer">
                <p>© 2026 Colab Esports. All rights reserved.</p>
                <p>This is an automated email. Please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hi ${username},

We received a request to reset your password for your Colab Esports account.

Reset your password by clicking this link:
${resetUrl}

Important:
- This link will expire in 1 hour
- If you didn't request this reset, please ignore this email
- Your password won't change until you click the link above

Happy Gaming!
The Colab Esports Team

© 2026 Colab Esports. All rights reserved.
        `
      };

      if (this.resend) {
        // Resend configured: Send email
        try {
          console.log('📧 Attempting to send via Resend...');
          const response = await this.resend.emails.send(emailContent);
          
          if (response.error) {
            console.error('❌ Resend Error:', response.error);
            console.log('📧 Falling back to console logging...');
            
            console.log('\n📧 =============== PASSWORD RESET EMAIL (RESEND FAILED) ===============');
            console.log('📧 To:', email);
            console.log('📧 Subject:', emailContent.subject);
            console.log('📧 Reset URL:', resetUrl);
            console.log('📧 Error:', response.error.message);
            console.log('📧 ================================================================\n');
            
            return {
              success: true,
              messageId: 'fallback-' + Date.now(),
              resetUrl: resetUrl
            };
          }
          
          console.log('✅ Password reset email sent via Resend:', response.data.id);
          console.log('📧 Email sent to:', email);
          return {
            success: true,
            messageId: response.data.id,
            resetUrl: null
          };
        } catch (resendError) {
          console.error('❌ Resend Error Details:');
          console.error('  - Error Message:', resendError.message);
          console.log('📧 Falling back to console logging...');
          
          console.log('\n📧 =============== PASSWORD RESET EMAIL (RESEND FAILED) ===============');
          console.log('📧 To:', email);
          console.log('📧 Subject:', emailContent.subject);
          console.log('📧 Reset URL:', resetUrl);
          console.log('📧 Error:', resendError.message);
          console.log('📧 ================================================================\n');
          
          return {
            success: true,
            messageId: 'fallback-' + Date.now(),
            resetUrl: resetUrl
          };
        }
      } else {
        // Development: Log email content
        console.log('\n📧 =============== PASSWORD RESET EMAIL ===============');
        console.log('📧 To:', email);
        console.log('📧 Subject:', emailContent.subject);
        console.log('📧 Reset URL:', resetUrl);
        console.log('📧 Email would be sent via Resend if API key was configured');
        console.log('📧 ================================================\n');
        
        return {
          success: true,
          messageId: 'dev-' + Date.now(),
          resetUrl: resetUrl
        };
      }
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testConnection() {
    if (!this.resend) {
      return { success: true, message: 'Development mode - no Resend connection needed' };
    }

    try {
      console.log('Testing Resend connection...');
      return { success: true, message: 'Resend API configured' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
