const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Check if email credentials are configured
    const hasEmailConfig = process.env.EMAIL_USER && 
                          process.env.EMAIL_PASS && 
                          process.env.EMAIL_USER !== 'your-gmail@gmail.com';
    
    if (hasEmailConfig) {
      // Use actual SMTP (works in both development and production)
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates
        }
      });
      
      console.log('📧 Email Service: SMTP configured');
      console.log('  - Host:', process.env.EMAIL_HOST);
      console.log('  - Port:', process.env.EMAIL_PORT);
      console.log('  - User:', process.env.EMAIL_USER);
      console.log('  - Password length:', process.env.EMAIL_PASS?.length || 0, 'characters');
      
      // Test connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ SMTP Connection Error:', error.message);
          console.error('  - Code:', error.code);
          console.error('  - Command:', error.command);
        } else {
          console.log('✅ SMTP Connection verified successfully');
        }
      });
    } else {
      // Development mode - log emails to console
      console.log('📧 Email Service: Development mode - emails will be logged to console');
      console.log('📧 To enable actual emails, set EMAIL_USER and EMAIL_PASS in .env');
      console.log('📧 Current EMAIL_USER:', process.env.EMAIL_USER || 'Not set');
      console.log('📧 Current EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
      this.transporter = null;
    }
  }

  async sendPasswordResetEmail(email, resetToken, username = 'User') {
    try {
      console.log('📧 Starting password reset email send...');
      console.log('📧 Email config check:');
      console.log('  - EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Not set');
      console.log('  - EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Not set');
      console.log('  - EMAIL_HOST:', process.env.EMAIL_HOST || 'Not set');
      console.log('  - EMAIL_PORT:', process.env.EMAIL_PORT || 'Not set');
      
      // Auto-detect client URL based on environment
      const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
      const clientUrl = isDevelopment ? 'http://localhost:3000' : 'https://colabesports.in';
      const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

      const emailContent = {
        from: `Colab Esports <${process.env.EMAIL_USER || 'support@colabesports.in'}>`,
        to: email,
        replyTo: 'support@colabesports.in',
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

      if (this.transporter) {
        // SMTP configured: Try to send actual email
        try {
          console.log('📧 Attempting to send via SMTP...');
          const info = await this.transporter.sendMail(emailContent);
          console.log('✅ Password reset email sent via SMTP:', info.messageId);
          console.log('📧 Email sent to:', email);
          return {
            success: true,
            messageId: info.messageId,
            resetUrl: null // Don't return URL when email is actually sent
          };
        } catch (smtpError) {
          console.error('❌ SMTP Error Details:');
          console.error('  - Error Code:', smtpError.code);
          console.error('  - Error Message:', smtpError.message);
          console.error('  - Response:', smtpError.response);
          console.error('  - Command:', smtpError.command);
          console.log('📧 Falling back to console logging...');
          
          // Fall back to console logging if SMTP fails
          console.log('\n📧 =============== PASSWORD RESET EMAIL (SMTP FAILED) ===============');
          console.log('📧 To:', email);
          console.log('📧 Subject:', emailContent.subject);
          console.log('📧 Reset URL:', resetUrl);
          console.log('📧 SMTP Error:', smtpError.message);
          console.log('📧 ================================================================\n');
          
          return {
            success: true,
            messageId: 'fallback-' + Date.now(),
            resetUrl: resetUrl // Return URL as fallback
          };
        }
      } else {
        // Development: Log email content
        console.log('\n📧 =============== PASSWORD RESET EMAIL ===============');
        console.log('📧 To:', email);
        console.log('📧 Subject:', emailContent.subject);
        console.log('📧 Reset URL:', resetUrl);
        console.log('📧 Email would be sent via SMTP if credentials were configured');
        console.log('📧 ================================================\n');
        
        return {
          success: true,
          messageId: 'dev-' + Date.now(),
          resetUrl: resetUrl // Return URL in development for testing
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
    if (!this.transporter) {
      return { success: true, message: 'Development mode - no SMTP connection needed' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection verified' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();