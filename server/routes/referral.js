const express = require('express');
const router = express.Router();
const Referral = require('../models/Referral');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   GET /api/referral/my-code
// @desc    Get user's referral code and link
// @access  Private
router.get('/my-code', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    let referral = await Referral.findOne({ userId });

    // Create referral code if doesn't exist
    if (!referral) {
      const code = await Referral.generateCode(userId);
      referral = new Referral({
        userId,
        referralCode: code
      });
      await referral.save();
    }

    const referralLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${referral.referralCode}`;

    res.json({
      success: true,
      data: {
        referralCode: referral.referralCode,
        referralLink,
        totalReferrals: referral.totalReferrals,
        successfulReferrals: referral.successfulReferrals,
        totalCoinsEarned: referral.totalCoinsEarned
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching referral code:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch referral code',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/referral/history
// @desc    Get successful referrals only
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const referral = await Referral.findOne({ userId })
      .populate('referredUsers.userId', 'username email avatarUrl createdAt');

    if (!referral) {
      return res.json({
        success: true,
        data: {
          referrals: []
        }
      });
    }

    // Filter only completed referrals
    const successfulReferrals = referral.referredUsers
      .filter(ref => ref.status === 'completed')
      .map(ref => ({
        user: {
          username: ref.userId?.username,
          email: ref.userId?.email,
          avatarUrl: ref.userId?.avatarUrl
        },
        coinsEarned: ref.coinsEarned,
        joinedAt: ref.joinedAt,
        completedAt: ref.completedAt
      }));

    res.json({
      success: true,
      data: {
        referrals: successfulReferrals
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching referral history:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch referral history',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/referral/apply
// @desc    Apply referral code during registration (called from auth route)
// @access  Public (but used internally)
router.post('/apply', async (req, res) => {
  try {
    const { referralCode, newUserId } = req.body;

    if (!referralCode || !newUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Referral code and user ID required'
        }
      });
    }

    const referral = await Referral.findOne({ referralCode: referralCode.toUpperCase() });

    if (!referral) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid referral code'
        }
      });
    }

    // Add to referred users
    referral.referredUsers.push({
      userId: newUserId,
      status: 'pending'
    });
    referral.totalReferrals += 1;
    await referral.save();

    res.json({
      success: true,
      message: 'Referral applied successfully'
    });

  } catch (error) {
    console.error('Error applying referral:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to apply referral'
      }
    });
  }
});

// @route   POST /api/referral/complete
// @desc    Mark referral as completed and reward coins (called when user completes first action)
// @access  Private
router.post('/complete', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { CoinConfig } = require('../models/CoinConfig');

    // Find referral where this user was referred
    const referral = await Referral.findOne({
      'referredUsers.userId': userId,
      'referredUsers.status': 'pending'
    });

    if (!referral) {
      return res.json({
        success: true,
        message: 'No pending referral found'
      });
    }

    const referrerConfig = await CoinConfig.findOne({ key: 'referral_reward' });
    const refereeConfig = await CoinConfig.findOne({ key: 'referee_referral_bonus' });
    const referrerRewardAmount = referrerConfig ? referrerConfig.value : 50;
    const refereeRewardAmount = refereeConfig ? refereeConfig.value : 50;

    // Update referral status
    const referredUser = referral.referredUsers.find(
      ref => ref.userId.toString() === userId && ref.status === 'pending'
    );

    if (referredUser) {
      referredUser.status = 'completed';
      referredUser.coinsEarned = referrerRewardAmount;
      referredUser.completedAt = new Date();
      referral.successfulReferrals += 1;
      referral.totalCoinsEarned += referrerRewardAmount;
      await referral.save();

      // Reward coins to referrer
      let referrerWallet = await Wallet.findOne({ userId: referral.userId });
      if (!referrerWallet) {
        referrerWallet = new Wallet({ userId: referral.userId });
      }

      await referrerWallet.addCoins(
        referrerRewardAmount,
        'referral',
        'Referral Bonus (Referrer)',
        { source: 'referral', referredUserId: userId }
      );

      // Reward coins to referee
      let refereeWallet = await Wallet.findOne({ userId: userId });
      if (!refereeWallet) {
        refereeWallet = new Wallet({ userId: userId });
      }

      await refereeWallet.addCoins(
        refereeRewardAmount,
        'referral',
        'Referral Bonus (Referee)',
        { source: 'referral', referrerId: referral.userId }
      );

      res.json({
        success: true,
        message: 'Referral completed successfully',
        data: {
          referrerReward: referrerRewardAmount,
          refereeReward: refereeRewardAmount
        }
      });
    }

  } catch (error) {
    console.error('Error completing referral:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to complete referral'
      }
    });
  }
});

module.exports = router;
