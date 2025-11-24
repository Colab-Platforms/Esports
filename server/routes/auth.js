const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   GET /api/auth/test
// @desc    Test route
// @access  Public
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working!',
    timestamp: new Date().toISOString()
  });
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    console.log('📝 Registration attempt:', req.body);
    
    const { username, email, phone, password } = req.body;

    // Basic validation
    if (!username || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'All fields are required',
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

    // Username validation
    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USERNAME',
          message: 'Username must be at least 3 characters and contain only letters, numbers, and underscores',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ Basic validation passed');

    // Check if user already exists
    console.log('🔍 Checking for existing user...');
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { phone }]
    });

    if (existingUser) {
      console.log('❌ User already exists:', existingUser.email);
      let field = 'email';
      if (existingUser.username === username) field = 'username';
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
    const user = new User({
      username,
      email,
      phone,
      passwordHash: password // Will be hashed by pre-save middleware
    });

    console.log('💾 Saving user to database...');
    await user.save();
    console.log('✅ User saved successfully');

    // Generate token
    console.log('🔑 Generating JWT token...');
    const token = generateToken(user._id);
    console.log('✅ Token generated');

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          kycStatus: user.kycStatus,
          role: user.role,
          level: user.level,
          loginStreak: user.loginStreak
        }
      },
      message: '🎉 Welcome to Colab Esports! Your gaming journey begins now.',
      timestamp: new Date().toISOString()
    });

    console.log('🎉 Registration successful for:', username);

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
router.post('/login', [
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

    const { identifier, password } = req.body;
    console.log('🔍 Searching for user with identifier:', identifier);

    // Find user by email, username, or phone
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier },
        { phone: identifier }
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

    // Update login streak
    await user.updateLoginStreak();

    // Generate token
    const token = generateToken(user._id);

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
          kycStatus: user.kycStatus,
          role: user.role,
          level: user.level,
          currentRank: user.currentRank,
          loginStreak: user.loginStreak,
          totalEarnings: user.totalEarnings,
          tournamentsWon: user.tournamentsWon,
          gameIds: user.gameIds,
          achievements: user.achievements.slice(-5) // Last 5 achievements
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
router.put('/profile', auth, [
  body('username')
    .optional()
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-20 characters and contain only letters, numbers, and underscores'),
  body('avatarUrl')
    .optional()
    .isURL()
    .withMessage('Please provide a valid avatar URL')
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

    const { username, avatarUrl, gameIds, preferences } = req.body;
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

    // Check if username is already taken
    if (username && username !== user.username) {
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

    // Update other fields
    if (avatarUrl) user.avatarUrl = avatarUrl;
    if (gameIds) user.gameIds = { ...user.gameIds, ...gameIds };
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    await user.save();

    res.json({
      success: true,
      data: { user },
      message: '✅ Profile updated successfully!',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_UPDATE_FAILED',
        message: 'Failed to update profile. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;