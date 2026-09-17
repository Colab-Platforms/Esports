const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const passport = require('../config/passport');
const emailService = require('../services/emailService');
const { isProviderEnabled, PROVIDERS, providers } = require('../config/providers.config');
const oauthStateService = require('../services/auth/oauth-state.service');
const authCodeService = require('../services/auth/auth-code.service');
const authService = require('../services/auth/auth.service');
const accountLinkingService = require('../services/auth/account-linking.service');
const verifiedGameIdService = require('../services/auth/verified-game-id.service');
const riotProvider = require('../services/auth/providers/riot.provider');

const router = express.Router();

// Middleware to decode sensitive data from client
const decodeSensitiveData = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sensitiveFields = ['password', 'confirmPassword', 'currentPassword', 'newPassword'];

    sensitiveFields.forEach(field => {
      if (req.body[field] && req.body[`${field}_encoded`]) {
        try {
          // Decode base64 encoded sensitive field
          req.body[field] = Buffer.from(req.body[field], 'base64').toString('utf-8');
          delete req.body[`${field}_encoded`];
        } catch (error) {
          console.error(`Failed to decode ${field}:`, error);
        }
      }
    });
  }
  next();
};

// Generate JWT token
// Adds standard iss/aud claims for defense in depth (a token minted for a
// different purpose/audience would carry different claims here) - not yet
// enforced in middleware/auth.js's verify call, since every token already
// issued before this change lacks them and would otherwise be rejected,
// forcing every currently-logged-in user to re-login. Safe to start
// enforcing later once JWT_EXPIRE (7d/30d) has had time to cycle out
// pre-existing tokens.
const generateToken = (userId, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRE || '7d');
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn,
    issuer: 'colab-esports',
    audience: 'colab-esports-client'
  });
};

// @route   GET /api/auth/test
// @desc    Test route
// @access  Public
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working!',
    timestamp: new Date().toISOString(),
    googleOAuth: {
      configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' &&
        process.env.GOOGLE_CLIENT_SECRET !== 'your-google-client-secret'),
      clientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set',
      serverUrl: process.env.SERVER_URL || 'http://localhost:5001',
      callbackUrl: `${process.env.SERVER_URL || 'http://localhost:5001'}/api/auth/google/callback`
    }
  });
});

// @route   GET /api/auth/test-email
// @desc    Test email configuration
// @access  Public
router.get('/test-email', async (req, res) => {
  try {
    console.log('\n🧪 EMAIL SERVICE TEST');
    console.log('📧 Configuration:');
    console.log('  - EMAIL_USER:', process.env.EMAIL_USER || 'Not set');
    console.log('  - EMAIL_PASS:', process.env.EMAIL_PASS ? `Set (${process.env.EMAIL_PASS.length} chars)` : 'Not set');
    console.log('  - EMAIL_HOST:', process.env.EMAIL_HOST || 'Not set');
    console.log('  - EMAIL_PORT:', process.env.EMAIL_PORT || 'Not set');

    // Test sending email
    const testResult = await emailService.sendPasswordResetEmail(
      'test@example.com',
      'test-token-12345',
      'TestUser'
    );

    console.log('📧 Test Result:', testResult);

    res.json({
      success: true,
      message: 'Email test completed',
      config: {
        emailUser: process.env.EMAIL_USER || 'Not set',
        emailPass: process.env.EMAIL_PASS ? `Set (${process.env.EMAIL_PASS.length} chars)` : 'Not set',
        emailHost: process.env.EMAIL_HOST || 'Not set',
        emailPort: process.env.EMAIL_PORT || 'Not set'
      },
      testResult
    });
  } catch (error) {
    console.error('❌ Email test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/auth/validate-referral/:code
// @desc    Validate referral code
// @access  Public
router.get('/validate-referral/:code', async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.length < 3) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Referral code must be at least 3 characters'
        }
      });
    }

    // Find referral record with this code (codes live in the Referral collection)
    const Referral = require('../models/Referral');
    const referral = await Referral.findOne({
      referralCode: code.toUpperCase()
    }).populate('userId', 'fullName username');

    if (!referral) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CODE_NOT_FOUND',
          message: 'Referral code not found'
        }
      });
    }

    if (referral.totalReferrals >= referral.maxUses) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REFERRAL_LIMIT_REACHED',
          message: 'This referral code has reached its maximum usage limit of 10'
        }
      });
    }

    const referrer = referral.userId;

    res.json({
      success: true,
      data: {
        isValid: true,
        referrerName: referrer ? (referrer.fullName || referrer.username) : 'A friend',
        referralCode: referral.referralCode,
        usesRemaining: referral.maxUses - referral.totalReferrals
      }
    });

  } catch (error) {
    console.error('❌ Referral validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to validate referral code'
      }
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    console.log('📧 Forgot password request:', req.body);

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EMAIL',
          message: 'Email address is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Email validation
    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please enter a valid email address',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    console.log('🔍 Forgot password request for:', email);
    console.log('🔍 User found:', !!user);
    if (user) {
      console.log('🔍 User details:', user.username, user.email);
    }

    // Always return success to prevent email enumeration
    if (!user) {
      console.log('❌ User not found for email:', email);
      return res.json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.',
        userFound: false, // Debug info
        timestamp: new Date().toISOString()
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to user using updateOne to avoid validation on other fields
    await User.updateOne(
      { _id: user._id },
      {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetTokenExpiry
      }
    );

    console.log('✅ Reset token generated for user:', user.username);

    // Send password reset email (don't wait for it - send in background)
    emailService.sendPasswordResetEmail(
      email,
      resetToken,
      user.username
    ).catch(error => {
      console.error('❌ Background email send failed:', error.message);
    });

    // Return success immediately without waiting for email
    res.json({
      success: true,
      message: 'Password reset email sent successfully',
      userFound: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FORGOT_PASSWORD_FAILED',
        message: 'Failed to process password reset request. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/auth/verify-reset-token/:token
// @desc    Verify password reset token
// @access  Public
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Reset token is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Password reset token is invalid or has expired',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      message: 'Reset token is valid',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOKEN_VERIFICATION_FAILED',
        message: 'Failed to verify reset token. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset user password with token
// @access  Public
router.post('/reset-password', decodeSensitiveData, async (req, res) => {
  try {
    console.log('🔐 Password reset request');

    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Reset token and new password are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 6 characters long',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Password reset token is invalid or has expired',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Hash the password manually since updateOne bypasses pre-save middleware
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear reset token using updateOne to avoid validation on other fields
    await User.updateOne(
      { _id: user._id },
      {
        passwordHash: hashedPassword,
        resetPasswordToken: undefined,
        resetPasswordExpires: undefined
      }
    );

    console.log('✅ Password reset successful for user:', user.username);

    res.json({
      success: true,
      message: 'Password has been reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PASSWORD_RESET_FAILED',
        message: 'Failed to reset password. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/auth/send-email-otp
// @desc    Generate and send a 6-digit OTP to the given email for verification
// @access  Public
router.post('/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Please provide a valid email address' }
      });
    }

    const OTP = require('../models/OTP');

    // Delete any existing unverified OTP for this email
    await OTP.deleteMany({ email: email.toLowerCase(), verified: false });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await OTP.create({
      email: email.toLowerCase(),
      otp: otpCode,
      expiresAt
    });

    // Optionally get username if user already exists (for email personalisation)
    const user = await User.findOne({ email: email.toLowerCase() });
    const username = user ? user.username : 'User';

    await emailService.sendOTPEmail(email, otpCode, username);

    res.json({
      success: true,
      message: 'OTP sent to your email address. It is valid for 10 minutes.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to send OTP. Please try again.' }
    });
  }
});

// @route   POST /api/auth/verify-email-otp
// @desc    Verify the OTP and mark the email as verified on the user record
// @access  Public
router.post('/verify-email-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and OTP are required' }
      });
    }

    const OTP = require('../models/OTP');
    const record = await OTP.findOne({
      email: email.toLowerCase(),
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_EXPIRED', message: 'OTP has expired or does not exist. Please request a new one.' }
      });
    }

    // Allow at most 3 wrong attempts before invalidating the OTP
    if (record.attempts >= 3) {
      await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_MAX_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new OTP.' }
      });
    }

    if (record.otp !== otp.toString()) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'Incorrect OTP',
          attemptsLeft: 3 - record.attempts
        }
      });
    }

    // OTP correct — mark as verified and clean up
    record.verified = true;
    await record.save();

    // If a user account exists for this email, flip isEmailVerified
    await User.updateOne(
      { email: email.toLowerCase() },
      { isEmailVerified: true }
    );

    res.json({
      success: true,
      message: 'Email verified successfully.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to verify OTP. Please try again.' }
    });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', decodeSensitiveData, async (req, res) => {
  try {
    console.log('📝 Registration attempt:', req.body);
    console.log('🎁 Referral code received:', req.body.referralCode);

    const { username, fullName, email, phone, password, bgmiIgnName, bgmiUid, freeFireIgnName, freeFireUid, gameIds, referralCode } = req.body;

    // Basic validation - fullName, email, phone, and password are required
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Full name, email, phone, and password are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Full name validation
    if (fullName.length < 3) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FULLNAME',
          message: 'Full name must be at least 3 characters',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Email validation
    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please enter a valid email address',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Phone validation - Indian mobile numbers
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PHONE',
          message: 'Please enter a valid 10-digit Indian mobile number',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Generate unique username from full name
    const generateUsername = (fullName) => {
      // Convert to lowercase, replace spaces with underscore, remove special chars
      const baseUsername = fullName
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .substring(0, 20); // Limit to 20 chars

      // Add random 4-digit number for uniqueness
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      return `${baseUsername}_${randomNum}`;
    };

    const generatedUsername = generateUsername(fullName);
    console.log('✅ Generated username:', generatedUsername);

    // [ANTI-BYPASS] Check if email is verified via OTP
    const OTPModel = require('../models/OTP');
    const verifiedOTP = await OTPModel.findOne({
      email: email.toLowerCase(),
      verified: true
    });

    if (!verifiedOTP) {
      console.log('❌ Registration blocked: Email not verified for', email);
      return res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address via OTP before creating an account.',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ Email verification confirmed');
    console.log('✅ Basic validation passed');

    // Check if user already exists
    console.log('🔍 Checking for existing user...');

    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone }
      ]
    });

    if (existingUser) {
      console.log('❌ User already exists:', existingUser.email || existingUser.phone);
      let field = 'phone';
      if (existingUser.email === email.toLowerCase()) field = 'email';
      if (existingUser.phone === phone) field = 'phone';

      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: `User with this ${field} already exists`,
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ No existing user found');

    // Create new user
    console.log('👤 Creating new user...');
    const userData = {
      fullName,
      username: generatedUsername,
      email,
      phone,
      isEmailVerified: true,
      passwordHash: password, // Will be hashed by pre-save middleware
      gameIds: {
        steam: '',
        bgmi: { ign: '', uid: '' },
        freefire: { ign: '', uid: '' },
        valorant: ''
      }
    };

    // Add game-specific data if provided
    if (bgmiIgnName || bgmiUid) {
      userData.gameIds.bgmi = {
        ign: bgmiIgnName || '',
        uid: bgmiUid || ''
      };
      // Also save to legacy fields for backward compatibility
      userData.bgmiIgnName = bgmiIgnName || '';
      userData.bgmiUid = bgmiUid || '';
      console.log('🎮 BGMI data added:', { ign: bgmiIgnName, uid: bgmiUid });
    }

    if (freeFireIgnName || freeFireUid) {
      userData.gameIds.freefire = {
        ign: freeFireIgnName || '',
        uid: freeFireUid || ''
      };
      // Also save to legacy fields for backward compatibility
      userData.freeFireIgnName = freeFireIgnName || '';
      userData.freeFireUid = freeFireUid || '';
      console.log('🔥 Free Fire data added:', { ign: freeFireIgnName, uid: freeFireUid });
    }

    if (gameIds && gameIds.steam) {
      userData.gameIds.steam = gameIds.steam;
      console.log('🎮 Steam ID added:', gameIds.steam);
    }

    const user = new User(userData);
    // Note: We don't save yet, we'll save once at the end after all modifications

    // Give welcome bonus coins
    let welcomeBonusAmount = 0;
    let welcomeBonusSuccess = false;
    try {
      const Wallet = require('../models/Wallet');
      const { CoinConfig } = require('../models/CoinConfig');

      // Get welcome bonus amount from config, default to 100 coins
      const config = await CoinConfig.findOne({ key: 'welcome_bonus' });
      welcomeBonusAmount = config ? config.value : 100;

      // Mark bonus as received on user object (but don't save yet)
      user.welcomeBonusReceived = true;
      user.welcomeBonusDate = new Date();
      welcomeBonusSuccess = true;
    } catch (coinError) {
      console.error('❌ Failed to prepare welcome bonus:', coinError);
    }

    // Handle referral code if provided
    let appliedRefereeReward = 0;
    if (referralCode) {
      console.log(`🎁 Processing referral code: ${referralCode}`);
      try {
        const Referral = require('../models/Referral');
        const referral = await Referral.findOne({ referralCode: referralCode.toUpperCase() });

        if (referral && referral.totalReferrals < referral.maxUses) {
          const { CoinConfig } = require('../models/CoinConfig');
          const referrerConfig = await CoinConfig.findOne({ key: 'referrer_reward' });
          const refereeConfig = await CoinConfig.findOne({ key: 'referee_reward' });
          const referrerReward = referrerConfig ? referrerConfig.value : 200;
          const refereeReward = refereeConfig ? refereeConfig.value : 100;
          appliedRefereeReward = refereeReward;

          // Prepare referral updates (will be saved later)
          user.referralBonusReceived = true;
          user.referralBonusDate = new Date();
          user.referralCode = referralCode.toUpperCase();
          user.referralBonusAmount = refereeReward;

          // Update referral record
          referral.referredUsers.push({
            userId: user._id,
            status: 'completed',
            coinsEarned: referrerReward,
            completedAt: new Date()
          });
          referral.totalReferrals += 1;
          referral.successfulReferrals += 1;
          referral.totalCoinsEarned += referrerReward;
          await referral.save(); // Save referral record

          // Note: Wallet updates for referee and referrer will happen AFTER user is saved successfully
        }
      } catch (referralError) {
        console.error('❌ Failed to process referral:', referralError);
      }
    }

    // FINAL SAVE: Save user once with all fields updated
    console.log('💾 Saving user to database...');
    await user.save();
    console.log('✅ User saved successfully');

    // AFTER SUCCESSFUL USER SAVE: Handle Wallet and Referrer rewards
    try {
      const Wallet = require('../models/Wallet');

      // 1. Give welcome bonus in wallet
      if (welcomeBonusSuccess) {
        let wallet = new Wallet({ userId: user._id });
        await wallet.addCoins(
          welcomeBonusAmount,
          'bonus',
          'Welcome Bonus - Thank you for joining Colab Esports!',
          { source: 'registration' }
        );
        await wallet.save();
      }

      // 2. Give referral bonus in wallet (referee and referrer)
      if (user.referralBonusReceived) {
        const Referral = require('../models/Referral');
        const referral = await Referral.findOne({ referralCode: user.referralCode });

        if (referral) {
          const { CoinConfig } = require('../models/CoinConfig');
          const referrerConfig = await CoinConfig.findOne({ key: 'referrer_reward' });
          const referrerReward = referrerConfig ? referrerConfig.value : 200;

          // Award to new user (referee)
          let newUserWallet = await Wallet.findOne({ userId: user._id });
          if (!newUserWallet) newUserWallet = new Wallet({ userId: user._id });
          await newUserWallet.addCoins(
            user.referralBonusAmount,
            'referral',
            'Referral bonus - Welcome gift',
            { source: 'referral' }
          );
          await newUserWallet.save();

          // Award to referrer
          let referrerWallet = await Wallet.findOne({ userId: referral.userId });
          if (!referrerWallet) referrerWallet = new Wallet({ userId: referral.userId });
          await referrerWallet.addCoins(
            referrerReward,
            'referral',
            `Referral bonus - ${user.username} joined`,
            { source: 'referral' }
          );
          await referrerWallet.save();
        }
      }
    } catch (postSaveError) {
      console.error('❌ Post-registration reward error:', postSaveError);
      // We don't fail registration if rewards fail after user is already saved
    }

    // Generate token
    const token = generateToken(user._id);
    console.log('✅ Token generated');

    // [CLEANUP] Remove the verified OTP record so it can't be reused
    try {
      const OTPModel = require('../models/OTP');
      await OTPModel.deleteMany({ email: email.toLowerCase() });
      console.log('🧹 Verified OTP records cleared for', email);
    } catch (cleanupError) {
      console.error('⚠️ OTP cleanup error (non-fatal):', cleanupError);
    }

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          country: user.country,
          state: user.state,
          favoriteGame: user.favoriteGame,
          profileVisibility: user.profileVisibility,
          socialAccounts: user.socialAccounts,
          kycStatus: user.kycStatus,
          role: user.role,
          level: user.level,
          currentRank: user.currentRank,
          loginStreak: user.loginStreak,
          totalEarnings: user.totalEarnings,
          tournamentsWon: user.tournamentsWon,
          gameIds: user.gameIds,
          bgmiIgnName: user.bgmiIgnName,
          bgmiUid: user.bgmiUid,
          freeFireIgnName: user.freeFireIgnName,
          freeFireUid: user.freeFireUid,
          createdAt: user.createdAt
        },
        welcomeBonus: {
          success: welcomeBonusSuccess,
          amount: welcomeBonusAmount,
          message: welcomeBonusSuccess ? `Welcome to Colab Esports! You have earned ${welcomeBonusAmount} coins. Check out your wallet!` : null
        },
        referralBonus: {
          received: user.referralBonusReceived || false,
          amount: user.referralBonusReceived ? appliedRefereeReward : 0,
          referralCode: user.referralCode || null
        }
      },
      message: '🎉 Welcome to Colab Esports! Your gaming journey begins now.',
      timestamp: new Date().toISOString()
    });

    console.log('🎉 Registration successful for:', fullName, `(${generatedUsername})`);
    console.log('🎁 Welcome bonus data being sent:', {
      success: welcomeBonusSuccess,
      amount: welcomeBonusAmount,
      message: welcomeBonusSuccess ? `Welcome to Colab Esports! You have earned ${welcomeBonusAmount} coins. Check out your wallet!` : null
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_FIELD',
          message: `${field} already exists. Please use a different ${field}.`,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: messages.join(', '),
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to create account. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', decodeSensitiveData, [
  body('identifier')
    .notEmpty()
    .withMessage('Email, username, or phone is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    console.log('🔐 Login attempt received');
    console.log('📧 Identifier:', req.body.identifier);

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide valid login credentials',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { identifier, password, rememberMe } = req.body;
    const trimmedIdentifier = typeof identifier === 'string' ? identifier.trim() : identifier;
    console.log('🔍 Searching for user with trimmed identifier:', trimmedIdentifier);

    // Find user by email, username, phone, or fullName
    const user = await User.findOne({
      $or: [
        { email: trimmedIdentifier.toLowerCase() },
        { username: trimmedIdentifier },
        { phone: trimmedIdentifier },
        { fullName: { $regex: new RegExp(`^${trimmedIdentifier}$`, 'i') } } // Case-insensitive full name
      ]
    });

    if (!user) {
      console.log('❌ User not found for identifier:', identifier);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid login credentials',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ User found:', user.username);

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Your account has been disabled. Please contact support.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify password
    console.log('🔐 Verifying password for user:', user.username);
    const isPasswordValid = await user.comparePassword(password);
    console.log('🔐 Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Invalid password for user:', user.username);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid login credentials',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ Login successful for user:', user.username);

    // Update login streak without triggering validation on other fields
    const now = new Date();
    const lastLogin = new Date(user.lastLogin);

    // Strip time from dates to compare calendar days (Midnight to Midnight)
    const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastAtMidnight = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());

    // Calculate difference in calendar days
    const daysDiff = Math.floor((todayAtMidnight - lastAtMidnight) / (1000 * 60 * 60 * 24));

    let newLoginStreak = user.loginStreak;
    if (newLoginStreak === 0) {
      // Initialize streak for new users or if it was somehow 0
      newLoginStreak = 1;
    } else if (daysDiff === 1) {
      // Logged in on the very next calendar day
      newLoginStreak += 1;
    } else if (daysDiff > 1) {
      // User missed a day or more, reset streak to 1
      newLoginStreak = 1;
    }
    // If daysDiff is 0, they logged in again on the same day, so we leave the streak as is

    // Update login streak and lastLogin using updateOne to avoid validation
    await User.updateOne(
      { _id: user._id },
      {
        loginStreak: newLoginStreak,
        lastLogin: now
      }
    );

    // Update the user object for response
    user.loginStreak = newLoginStreak;
    user.lastLogin = now;

    // Generate token
    const token = generateToken(user._id, rememberMe);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          country: user.country,
          state: user.state,  // ✅ Added missing state field
          favoriteGame: user.favoriteGame,
          profileVisibility: user.profileVisibility,
          socialAccounts: user.socialAccounts,
          kycStatus: user.kycStatus,
          role: user.role,
          level: user.level,
          currentRank: user.currentRank,
          loginStreak: user.loginStreak,
          totalEarnings: user.totalEarnings,
          tournamentsWon: user.tournamentsWon,
          gameIds: user.gameIds,
          steamProfile: user.steamProfile,
          achievements: user.achievements.slice(-5), // Last 5 achievements
          createdAt: user.createdAt
        }
      },
      message: `🎮 Welcome back, ${user.username}! Ready to dominate?`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Login failed. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: { user },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: 'Failed to fetch profile. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    console.log('📝 Profile update request:', req.body);

    const { username, email, phone, bio, country, state, favoriteGame, profileVisibility, avatarUrl, socialAccounts, gameIds, bgmiIgnName, bgmiUid, freeFireIgnName, freeFireUid } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // CRITICAL: Migrate old gameIds format to new format FIRST
    console.log('🔍 Current gameIds before migration:', user.gameIds);

    if (user.gameIds) {
      // Migrate old string format to new object format
      if (typeof user.gameIds.bgmi === 'string') {
        const oldBgmiUid = user.gameIds.bgmi;
        user.gameIds.bgmi = { ign: user.bgmiIgnName || '', uid: oldBgmiUid };
        console.log('🔄 Migrated BGMI from string to object:', user.gameIds.bgmi);
      }

      if (typeof user.gameIds.freefire === 'string') {
        const oldFreefireUid = user.gameIds.freefire;
        user.gameIds.freefire = { ign: user.freeFireIgnName || '', uid: oldFreefireUid };
        console.log('🔄 Migrated Free Fire from string to object:', user.gameIds.freefire);
      }
    }

    // Ensure fullName is always set (preserve existing or use username as fallback)
    if (!user.fullName) {
      user.fullName = user.username || 'User';
    }

    // Check if username is already taken
    if (username && username !== user.username) {
      // Validate username length only
      if (username.length < 3) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USERNAME',
            message: 'Username must be at least 3 characters',
            timestamp: new Date().toISOString()
          }
        });
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'USERNAME_TAKEN',
            message: 'Username is already taken',
            timestamp: new Date().toISOString()
          }
        });
      }
      user.username = username;
    }

    // Update fields (only if provided)
    if (bio !== undefined) user.bio = bio;
    if (country !== undefined) user.country = country;
    if (state !== undefined) user.state = state;
    if (favoriteGame !== undefined) user.favoriteGame = favoriteGame;
    if (profileVisibility !== undefined) user.profileVisibility = profileVisibility;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (phone !== undefined) {
      // If phone is an empty string, set it to undefined to avoid duplicate key errors on the unique/sparse index
      user.phone = (phone && typeof phone === 'string' && phone.trim() !== '') ? phone.trim() : undefined;
    }

    // Update game IDs with new structure
    if (bgmiIgnName !== undefined || bgmiUid !== undefined) {
      if (!user.gameIds) user.gameIds = {};

      // Convert old string format to new object format safely
      let currentBgmi = user.toObject().gameIds?.bgmi;
      if (typeof currentBgmi === 'string') {
        user.set('gameIds.bgmi', { ign: '', uid: currentBgmi });
        console.log('🔄 Migrated old BGMI string to object:', currentBgmi);
      }

      if (!user.gameIds.bgmi || typeof user.gameIds.bgmi !== 'object') {
        user.gameIds.bgmi = { ign: '', uid: '' };
      }

      if (bgmiIgnName !== undefined) user.gameIds.bgmi.ign = bgmiIgnName;
      if (bgmiUid !== undefined) user.gameIds.bgmi.uid = bgmiUid;

      // Mark nested object as modified for Mongoose
      user.markModified('gameIds.bgmi');

      // Also update legacy fields for backward compatibility
      user.bgmiIgnName = user.gameIds.bgmi.ign;
      user.bgmiUid = user.gameIds.bgmi.uid;

      console.log('🎮 BGMI data updated:', user.gameIds.bgmi);
    }

    if (freeFireIgnName !== undefined || freeFireUid !== undefined) {
      if (!user.gameIds) user.gameIds = {};

      // Convert old string format to new object format safely
      let currentFreefire = user.toObject().gameIds?.freefire;
      if (typeof currentFreefire === 'string') {
        user.set('gameIds.freefire', { ign: '', uid: currentFreefire });
        console.log('🔄 Migrated old Free Fire string to object:', currentFreefire);
      }

      if (!user.gameIds.freefire || typeof user.gameIds.freefire !== 'object') {
        user.gameIds.freefire = { ign: '', uid: '' };
      }

      if (freeFireIgnName !== undefined) user.gameIds.freefire.ign = freeFireIgnName;
      if (freeFireUid !== undefined) user.gameIds.freefire.uid = freeFireUid;

      // Mark nested object as modified for Mongoose
      user.markModified('gameIds.freefire');

      // Also update legacy fields for backward compatibility
      user.freeFireIgnName = user.gameIds.freefire.ign;
      user.freeFireUid = user.gameIds.freefire.uid;

      console.log('🔥 Free Fire data updated:', user.gameIds.freefire);
    }

    // Update social accounts
    if (socialAccounts !== undefined) {
      user.socialAccounts = {
        twitter: socialAccounts.twitter !== undefined ? socialAccounts.twitter : (user.socialAccounts?.twitter || ''),
        instagram: socialAccounts.instagram !== undefined ? socialAccounts.instagram : (user.socialAccounts?.instagram || ''),
        github: socialAccounts.github !== undefined ? socialAccounts.github : (user.socialAccounts?.github || ''),
        linkedin: socialAccounts.linkedin !== undefined ? socialAccounts.linkedin : (user.socialAccounts?.linkedin || '')
      };
    }

    // Update game IDs - Handle steam and other games
    if (gameIds !== undefined) {
      if (!user.gameIds) user.gameIds = {};

      if (gameIds.steam !== undefined) {
        user.gameIds.steam = gameIds.steam;
      }

      if (gameIds.valorant !== undefined) {
        const update = {};
        await verifiedGameIdService.applyUntrustedValorantUpdate(req.user.userId, update, gameIds.valorant);
        user.gameIds.valorant = update['gameIds.valorant'];
      }

      // Handle bgmi if passed as object in gameIds
      if (gameIds.bgmi !== undefined) {
        // Convert old string format to new object format safely
        let currentBgmi = user.toObject().gameIds?.bgmi;
        if (typeof currentBgmi === 'string') {
          user.set('gameIds.bgmi', { ign: '', uid: currentBgmi });
          console.log('🔄 Migrated old BGMI string to object (via gameIds):', currentBgmi);
        }

        if (typeof gameIds.bgmi === 'object') {
          if (!user.gameIds.bgmi || typeof user.gameIds.bgmi !== 'object') {
            user.gameIds.bgmi = { ign: '', uid: '' };
          }
          user.gameIds.bgmi = {
            ign: gameIds.bgmi.ign || user.gameIds.bgmi?.ign || '',
            uid: gameIds.bgmi.uid || user.gameIds.bgmi?.uid || ''
          };

          user.markModified('gameIds');
          user.bgmiIgnName = user.gameIds.bgmi.ign;
          user.bgmiUid = user.gameIds.bgmi.uid;

          console.log('🎮 BGMI updated via gameIds:', user.gameIds.bgmi);
        }
      }

      // Handle freefire if passed as object in gameIds
      if (gameIds.freefire !== undefined) {
        // Convert old string format to new object format safely
        let currentFreefire = user.toObject().gameIds?.freefire;
        if (typeof currentFreefire === 'string') {
          user.set('gameIds.freefire', { ign: '', uid: currentFreefire });
          console.log('🔄 Migrated old Free Fire string to object (via gameIds):', currentFreefire);
        }

        if (typeof gameIds.freefire === 'object' && gameIds.freefire !== null) {
          if (!user.gameIds.freefire || typeof user.gameIds.freefire !== 'object') {
            user.gameIds.freefire = { ign: '', uid: '' };
          }
          user.gameIds.freefire = {
            ign: gameIds.freefire.ign || user.gameIds.freefire?.ign || '',
            uid: gameIds.freefire.uid || user.gameIds.freefire?.uid || ''
          };

          user.markModified('gameIds');
          user.freeFireIgnName = user.gameIds.freefire.ign;
          user.freeFireUid = user.gameIds.freefire.uid;

          console.log('🔥 Free Fire updated via gameIds:', user.gameIds.freefire);
        }
      }
    }

    // Ensure gameIds is properly structured before saving
    if (user.gameIds) {
      if (!user.gameIds.bgmi || typeof user.gameIds.bgmi !== 'object') {
        user.gameIds.bgmi = { ign: '', uid: '' };
      }
      if (!user.gameIds.freefire || typeof user.gameIds.freefire !== 'object') {
        user.gameIds.freefire = { ign: '', uid: '' };
      }
      if (!user.gameIds.steam) {
        user.gameIds.steam = '';
      }
    }

    await user.save();

    try {
      const redisService = require('../services/redisService');
      // Clear this user's own teams cache
      await redisService.delete(`teams:v2:my-teams:${user._id}`);
      // Clear ALL player-list caches across all viewers — any cached list could contain this user's stale game IDs
      await redisService.deletePattern('players:v2:*');
    } catch (cacheErr) {
      console.error('Cache invalidation failed:', cacheErr);
    }

    // Return updated user data
    const updatedUser = {
      id: user._id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      country: user.country,
      state: user.state,
      favoriteGame: user.favoriteGame,
      profileVisibility: user.profileVisibility,
      socialAccounts: user.socialAccounts,
      kycStatus: user.kycStatus,
      role: user.role,
      level: user.level,
      currentRank: user.currentRank,
      loginStreak: user.loginStreak,
      totalEarnings: user.totalEarnings,
      tournamentsWon: user.tournamentsWon,
      gameIds: user.gameIds,
      bgmiIgnName: user.bgmiIgnName,
      bgmiUid: user.bgmiUid,
      freeFireIgnName: user.freeFireIgnName,
      freeFireUid: user.freeFireUid,
      steamProfile: user.steamProfile,
      createdAt: user.createdAt
    };

    res.json({
      success: true,
      data: { user: updatedUser },
      message: '✅ Profile updated successfully!',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Profile update error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: messages.join(', '),
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_UPDATE_FAILED',
        message: 'Failed to update profile. Please try again.',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/auth/google
// @desc    Google OAuth login
// @access  Public
router.get('/google', (req, res, next) => {
  if (!isProviderEnabled(PROVIDERS.GOOGLE)) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not properly configured. Please contact support.',
        timestamp: new Date().toISOString()
      }
    });
  }

  // A direct hit here always means "log in with Google" - clear any stale
  // connect-intent from an abandoned settings-page connect attempt (see
  // account-linking.service.js's handleConnectCallback).
  if (req.session) {
    req.session.connectIntent = undefined;
  }

  const state = oauthStateService.issue(req, PROVIDERS.GOOGLE);

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state
  })(req, res, next);
});

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback - resolves the normalized identity from
//          passport to an application User via auth.service.js, then hands
//          the frontend a one-time code (not the JWT itself) to exchange.
// @access  Public
router.get('/google/callback', (req, res, next) => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

  if (!isProviderEnabled(PROVIDERS.GOOGLE)) {
    return res.redirect(`${CLIENT_URL}/auth/error?message=Google OAuth not configured`);
  }

  passport.authenticate('google', { session: false }, async (err, normalizedIdentity) => {
    if (await accountLinkingService.handleConnectCallback(req, res, PROVIDERS.GOOGLE, err, normalizedIdentity)) {
      return;
    }

    try {
      if (err || !normalizedIdentity) {
        console.error('❌ Google OAuth authentication error:', err && err.message);
        return res.redirect(`${CLIENT_URL}/auth/error?message=Authentication failed&reason=PROVIDER_AUTH_FAILED`);
      }

      if (!oauthStateService.verify(req, PROVIDERS.GOOGLE, req.query.state)) {
        console.error('❌ Google OAuth: invalid or expired state');
        return res.redirect(`${CLIENT_URL}/auth/error?message=Your login attempt expired. Please try again.&reason=OAUTH_STATE_INVALID`);
      }

      const { user, isNewUser } = await authService.loginWithIdentity(PROVIDERS.GOOGLE, normalizedIdentity);
      const code = await authCodeService.issueCode({ userId: user._id, provider: PROVIDERS.GOOGLE, isNewUser });

      res.redirect(`${CLIENT_URL}/auth/success?code=${code}&provider=google`);
    } catch (error) {
      if (error.code === 'ACCOUNT_LINK_REQUIRED') {
        return res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent(error.message)}&reason=ACCOUNT_LINK_REQUIRED&email=${encodeURIComponent(error.email || '')}`);
      }
      console.error('❌ Google OAuth callback error:', error);
      res.redirect(`${CLIENT_URL}/auth/error?message=Authentication failed&reason=PROVIDER_AUTH_FAILED`);
    }
  })(req, res, next);
});

// @route   GET /api/auth/facebook
// @desc    Facebook OAuth login
// @access  Public
router.get('/facebook', (req, res, next) => {
  if (!isProviderEnabled(PROVIDERS.FACEBOOK)) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Facebook OAuth is not properly configured. Please contact support.',
        timestamp: new Date().toISOString()
      }
    });
  }

  // A direct hit here always means "log in with Facebook" - clear any stale
  // connect-intent from an abandoned settings-page connect attempt.
  if (req.session) {
    req.session.connectIntent = undefined;
  }

  const state = oauthStateService.issue(req, PROVIDERS.FACEBOOK);

  passport.authenticate('facebook', {
    scope: ['email'],
    state
  })(req, res, next);
});

// @route   GET /api/auth/facebook/callback
// @desc    Facebook OAuth callback - same shape as Google's: resolves the
//          normalized identity to an application User via auth.service.js,
//          then hands the frontend a one-time code to exchange.
// @access  Public
router.get('/facebook/callback', (req, res, next) => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

  if (!isProviderEnabled(PROVIDERS.FACEBOOK)) {
    return res.redirect(`${CLIENT_URL}/auth/error?message=Facebook OAuth not configured`);
  }

  passport.authenticate('facebook', { session: false }, async (err, normalizedIdentity) => {
    if (await accountLinkingService.handleConnectCallback(req, res, PROVIDERS.FACEBOOK, err, normalizedIdentity)) {
      return;
    }

    try {
      if (err || !normalizedIdentity) {
        console.error('❌ Facebook OAuth authentication error:', err && err.message);
        return res.redirect(`${CLIENT_URL}/auth/error?message=Authentication failed&reason=PROVIDER_AUTH_FAILED`);
      }

      if (!oauthStateService.verify(req, PROVIDERS.FACEBOOK, req.query.state)) {
        console.error('❌ Facebook OAuth: invalid or expired state');
        return res.redirect(`${CLIENT_URL}/auth/error?message=Your login attempt expired. Please try again.&reason=OAUTH_STATE_INVALID`);
      }

      const { user, isNewUser } = await authService.loginWithIdentity(PROVIDERS.FACEBOOK, normalizedIdentity);
      const code = await authCodeService.issueCode({ userId: user._id, provider: PROVIDERS.FACEBOOK, isNewUser });

      res.redirect(`${CLIENT_URL}/auth/success?code=${code}&provider=facebook`);
    } catch (error) {
      if (error.code === 'ACCOUNT_LINK_REQUIRED') {
        return res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent(error.message)}&reason=ACCOUNT_LINK_REQUIRED&email=${encodeURIComponent(error.email || '')}`);
      }
      console.error('❌ Facebook OAuth callback error:', error);
      res.redirect(`${CLIENT_URL}/auth/error?message=Authentication failed&reason=PROVIDER_AUTH_FAILED`);
    }
  })(req, res, next);
});

// @route   GET /api/auth/xbox
// @desc    Xbox login. Note this requests only Xbox Live-scoped access (see
//          providers.config.js) - there is no separate "Microsoft login"
//          step, and no email is ever available from this flow.
// @access  Public
router.get('/xbox', (req, res, next) => {
  if (!isProviderEnabled(PROVIDERS.XBOX)) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Xbox login is not properly configured. Please contact support.',
        timestamp: new Date().toISOString()
      }
    });
  }

  // A direct hit here always means "log in with Xbox" - clear any stale
  // connect-intent from an abandoned settings-page connect attempt.
  if (req.session) {
    req.session.connectIntent = undefined;
  }

  const state = oauthStateService.issue(req, PROVIDERS.XBOX);

  passport.authenticate('xbox', {
    scope: providers[PROVIDERS.XBOX].scope,
    state
  })(req, res, next);
});

// @route   GET /api/auth/xbox/callback
// @desc    Xbox OAuth callback. Unlike the other providers, a failure here
//          (err.code === 'XBOX_PROFILE_UNAVAILABLE') usually means the
//          Microsoft account simply has no Xbox profile, not a real error -
//          surfaced with its own reason code so the frontend can show a
//          specific, actionable message instead of a generic failure.
// @access  Public
router.get('/xbox/callback', (req, res, next) => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

  if (!isProviderEnabled(PROVIDERS.XBOX)) {
    return res.redirect(`${CLIENT_URL}/auth/error?message=Xbox login not configured`);
  }

  passport.authenticate('xbox', { session: false }, async (err, normalizedIdentity) => {
    if (await accountLinkingService.handleConnectCallback(req, res, PROVIDERS.XBOX, err, normalizedIdentity)) {
      return;
    }

    try {
      if (err && err.code === 'XBOX_PROFILE_UNAVAILABLE') {
        console.error('❌ Xbox profile unavailable:', err.message);
        return res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent(err.message)}&reason=XBOX_PROFILE_UNAVAILABLE`);
      }

      if (err || !normalizedIdentity) {
        console.error('❌ Xbox OAuth authentication error:', err && err.message);
        return res.redirect(`${CLIENT_URL}/auth/error?message=Authentication failed&reason=PROVIDER_AUTH_FAILED`);
      }

      if (!oauthStateService.verify(req, PROVIDERS.XBOX, req.query.state)) {
        console.error('❌ Xbox OAuth: invalid or expired state');
        return res.redirect(`${CLIENT_URL}/auth/error?message=Your login attempt expired. Please try again.&reason=OAUTH_STATE_INVALID`);
      }

      const { user, isNewUser } = await authService.loginWithIdentity(PROVIDERS.XBOX, normalizedIdentity);
      const code = await authCodeService.issueCode({ userId: user._id, provider: PROVIDERS.XBOX, isNewUser });

      res.redirect(`${CLIENT_URL}/auth/success?code=${code}&provider=xbox`);
    } catch (error) {
      if (error.code === 'ACCOUNT_LINK_REQUIRED') {
        return res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent(error.message)}&reason=ACCOUNT_LINK_REQUIRED&email=${encodeURIComponent(error.email || '')}`);
      }
      console.error('❌ Xbox OAuth callback error:', error);
      res.redirect(`${CLIENT_URL}/auth/error?message=Authentication failed&reason=PROVIDER_AUTH_FAILED`);
    }
  })(req, res, next);
});

// @route   GET /api/auth/riot
// @desc    Riot RSO account verification start. Phase 1 intentionally supports
//          connecting Riot to an already-authenticated platform account only;
//          it is not a website login/signup provider.
// @access  Public (requires a server-side connect intent created by /api/accounts/riot/connect/start)
router.get('/riot', (req, res) => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

  if (!isProviderEnabled(PROVIDERS.RIOT)) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'RIOT_OAUTH_NOT_CONFIGURED',
        message: 'Riot verification is not properly configured. Please contact support.',
        timestamp: new Date().toISOString()
      }
    });
  }

  if (!accountLinkingService.hasValidConnectIntent(req, PROVIDERS.RIOT)) {
    return res.redirect(`${CLIENT_URL}/profile/settings?connect_error=connect_not_started`);
  }

  const state = oauthStateService.issue(req, PROVIDERS.RIOT);
  return res.redirect(riotProvider.buildAuthorizationUrl(state));
});

// @route   GET /api/auth/riot/callback
// @desc    Riot RSO callback for account verification. Does not call
//          loginWithIdentity in Phase 1, so Riot cannot create/login website
//          accounts by hitting this callback.
// @access  Public
router.get('/riot/callback', async (req, res) => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

  if (!isProviderEnabled(PROVIDERS.RIOT)) {
    return res.redirect(`${CLIENT_URL}/profile/settings?connect_error=not_configured`);
  }

  if (!oauthStateService.verify(req, PROVIDERS.RIOT, req.query.state)) {
    return res.redirect(`${CLIENT_URL}/profile/settings?connect_error=state_mismatch`);
  }

  if (!accountLinkingService.hasValidConnectIntent(req, PROVIDERS.RIOT)) {
    return res.redirect(`${CLIENT_URL}/profile/settings?connect_error=connect_expired`);
  }

  try {
    const normalizedIdentity = await riotProvider.getIdentityFromAuthorizationCode(req.query.code);
    await accountLinkingService.handleConnectCallback(
      req,
      res,
      PROVIDERS.RIOT,
      null,
      normalizedIdentity
    );
  } catch (error) {
    console.error('Riot verification callback error:', error.message);
    await accountLinkingService.handleConnectCallback(req, res, PROVIDERS.RIOT, error, null);
  }
});

// @route   POST /api/auth/exchange
// @desc    Trade a one-time OAuth code (from the /auth/success redirect) for
//          the actual JWT + user - keeps the JWT out of the redirect URL.
// @access  Public
router.post('/exchange', async (req, res) => {
  try {
    const { code } = req.body;

    const record = await authCodeService.exchangeCode(code);
    if (!record) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTH_CODE_EXPIRED',
          message: 'This login link has expired or was already used. Please try again.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const user = await User.findById(record.userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'IDENTITY_NOT_FOUND',
          message: 'We could not find your account. Please try again.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const token = generateToken(user._id, false);

    res.json({
      success: true,
      data: {
        token,
        user,
        provider: record.provider,
        isNewUser: record.isNewUser
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Auth code exchange error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROVIDER_AUTH_FAILED',
        message: 'Something went wrong completing sign-in. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', auth, decodeSensitiveData, async (req, res) => {
  try {
    console.log('🔐 Password change request for user:', req.user.userId);

    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Current password and new password are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Password strength validation
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'New password must be at least 6 characters long',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Find user
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save middleware
    await user.save();

    console.log('✅ Password updated successfully for user:', user.username);

    res.json({
      success: true,
      message: 'Password updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PASSWORD_CHANGE_FAILED',
        message: 'Failed to update password. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/auth/steam
// @desc    Steam OAuth login
// @access  Public
router.get('/steam', (req, res, next) => {
  if (!isProviderEnabled(PROVIDERS.STEAM)) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Steam login is not properly configured. Please contact support.',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Steam uses OpenID, not OAuth2 - passport-steam/node-openid already
  // perform their own association/nonce handshake as part of the protocol,
  // so this doesn't need the same app-level `state` param as Google.
  //
  // A direct hit here always means "log in with Steam" - clear any stale
  // connect-intent from an abandoned settings-page connect attempt so it
  // can't get mistakenly consumed by this unrelated login (see the intent
  // branch in /steam/return below).
  if (req.session) {
    req.session.connectIntent = undefined;
  }

  passport.authenticate('steam')(req, res, next);
});

// @route   GET /api/auth/steam/return
// @desc    Steam OAuth callback. passport-steam's returnURL is fixed at
//          strategy-registration time, so this single route is the target
//          for BOTH "log in with Steam" (/api/auth/steam) and "connect Steam"
//          (POST /api/accounts/steam/connect/start) - it branches on whether
//          a connect intent was recorded on the session immediately before
//          this handshake started. Login issues a one-time code the same way
//          Google's callback does; connect attaches the identity to the
//          already-authenticated user and redirects back into the app.
// @access  Public
router.get('/steam/return', (req, res, next) => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

  if (!isProviderEnabled(PROVIDERS.STEAM)) {
    return res.redirect(`${CLIENT_URL}/auth/error?message=Steam login not configured`);
  }

  passport.authenticate('steam', { session: false }, async (err, normalizedIdentity) => {
    if (await accountLinkingService.handleConnectCallback(req, res, PROVIDERS.STEAM, err, normalizedIdentity)) {
      return;
    }

    try {
      if (err || !normalizedIdentity) {
        console.error('❌ Steam OAuth authentication error:', err && err.message);
        return res.redirect(`${CLIENT_URL}/auth/error?message=Authentication failed&reason=PROVIDER_AUTH_FAILED`);
      }

      const { user, isNewUser } = await authService.loginWithIdentity(PROVIDERS.STEAM, normalizedIdentity);
      const code = await authCodeService.issueCode({ userId: user._id, provider: PROVIDERS.STEAM, isNewUser });

      res.redirect(`${CLIENT_URL}/auth/success?code=${code}&provider=steam`);
    } catch (error) {
      console.error('❌ Steam OAuth callback error:', error);
      res.redirect(`${CLIENT_URL}/auth/error?message=Authentication failed&reason=PROVIDER_AUTH_FAILED`);
    }
  })(req, res, next);
});

module.exports = router;

