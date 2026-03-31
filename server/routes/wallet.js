const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');
const auth = require('../middleware/auth');

// @route   GET /api/wallet
// @desc    Get user's wallet balance and recent transactions
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    let wallet = await Wallet.findOne({ userId });

    // Create wallet if doesn't exist
    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }

    // Get recent 10 transactions
    const recentTransactions = wallet.transactions
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);
    
    // Calculate last 7 days + today + next 2 days = 9 days total
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Past 6 days + today + future 2 days
    for (let i = 6; i >= -2; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Check if claimed on this date (only for past/today)
      const claimed = i >= 0 ? (wallet.dailyLoginHistory?.some(entry => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === date.getTime();
      }) || false) : false;
      
      const isFuture = i < 0;
      const isToday = i === 0;
      
      days.push({
        date: date.toISOString(),
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        claimed: claimed,
        isToday: isToday,
        isFuture: isFuture,
        isPast: i > 0
      });
    }

    // Calculate streak status
    const todayAtMidnight = new Date();
    todayAtMidnight.setHours(0, 0, 0, 0);
    
    const yesterdayAtMidnight = new Date(todayAtMidnight);
    yesterdayAtMidnight.setDate(yesterdayAtMidnight.getDate() - 1);
    
    // Streak is valid only if last login was today OR yesterday
    const isStreakValid = wallet.lastDailyLogin && wallet.lastDailyLogin >= yesterdayAtMidnight;
    const currentStreak = isStreakValid ? (wallet.streak || 0) : 0;

    res.json({
      success: true,
      data: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalSpent: wallet.totalSpent,
        streak: currentStreak,
        lastDailyLogin: wallet.lastDailyLogin,
        last7Days: days.filter(d => !d.isFuture), // Keep backward compatibility
        days: days, // New field with all 9 days
        recentTransactions
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch wallet',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/wallet/transactions
// @desc    Get paginated transaction history
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, type } = req.query;

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.json({
        success: true,
        data: {
          transactions: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalTransactions: 0
          }
        }
      });
    }

    let transactions = wallet.transactions;

    // Filter by type if provided
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => b.createdAt - a.createdAt);

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        transactions: paginatedTransactions,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(transactions.length / limitNum),
          totalTransactions: transactions.length,
          hasNextPage: endIndex < transactions.length,
          hasPrevPage: pageNum > 1
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch transactions',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/wallet/daily-login
// @desc    Claim daily login reward
// @access  Private
router.post('/daily-login', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { CoinConfig } = require('../models/CoinConfig');

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({ userId });
    }

    // Check if already claimed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (wallet.lastDailyLogin && wallet.lastDailyLogin >= today) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_CLAIMED',
          message: 'Daily reward already claimed today',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Calculate streak - check if last login was yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (wallet.lastDailyLogin && wallet.lastDailyLogin >= yesterday && wallet.lastDailyLogin < today) {
      // Consecutive day - increment streak
      wallet.streak = (wallet.streak || 0) + 1;
    } else {
      // Streak broken or first time - reset to 1
      wallet.streak = 1;
    }

    console.log('🔥 Streak updated:', wallet.streak);

    // Get daily login reward amount from config
    const config = await CoinConfig.findOne({ key: 'daily_login_reward' });
    const rewardAmount = config ? config.value : 10;

    // Add coins
    await wallet.addCoins(
      rewardAmount,
      'earn',
      'Daily Login Reward',
      { source: 'daily_login' }
    );

    wallet.lastDailyLogin = new Date();
    
    // Add to daily login history
    if (!wallet.dailyLoginHistory) {
      wallet.dailyLoginHistory = [];
    }
    
    // Add today's login
    wallet.dailyLoginHistory.push({
      date: new Date(),
      claimed: true,
      coinsEarned: rewardAmount
    });
    
    // Keep only last 30 days of history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    wallet.dailyLoginHistory = wallet.dailyLoginHistory.filter(
      entry => entry.date >= thirtyDaysAgo
    );
    
    await wallet.save();

    // Check if streak is a multiple of 7 (7, 14, 21, 28, etc.)
    let streakBonusCoins = 0;
    let streakMilestone = 0;
    
    if (wallet.streak > 0 && wallet.streak % 7 === 0) {
      streakMilestone = wallet.streak;
      console.log(`🎉 ${streakMilestone}-day streak completed! Awarding 30 bonus coins`);
      streakBonusCoins = 30;
      
      // Award 30 coins for every 7-day milestone
      await wallet.addCoins(
        streakBonusCoins,
        'bonus',
        `${streakMilestone}-Day Streak Bonus`,
        { source: 'streak_bonus', streakDays: streakMilestone }
      );
      
      await wallet.save();
    }

    res.json({
      success: true,
      data: {
        coinsEarned: rewardAmount,
        streakBonusCoins: streakBonusCoins,
        totalCoinsEarned: rewardAmount + streakBonusCoins,
        newBalance: wallet.balance,
        streak: wallet.streak,
        streakCompleted: streakBonusCoins > 0,
        streakMilestone: streakMilestone
      },
      message: streakBonusCoins > 0 
        ? `🎉 ${streakMilestone}-Day Streak Complete! You earned ${rewardAmount} coins + ${streakBonusCoins} bonus coins!`
        : `You earned ${rewardAmount} Colab Coins! 🔥 ${wallet.streak} day streak!`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error claiming daily reward:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to claim daily reward',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/wallet/streak-status
// @desc    Check if user can claim daily streak today
// @access  Private
router.get('/streak-status', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alreadyClaimed = wallet.lastDailyLogin && wallet.lastDailyLogin >= today;

    // Calculate virtual streak-status
    const yesterdayAtMidnight = new Date(today);
    yesterdayAtMidnight.setDate(yesterdayAtMidnight.getDate() - 1);
    
    // Streak is only valid if they claimed today or yesterday
    const isStreakValid = wallet.lastDailyLogin && wallet.lastDailyLogin >= yesterdayAtMidnight;
    const currentStreak = isStreakValid ? (wallet.streak || 0) : 0;

    // Calculate what coins they'd earn (base 10, or from config)
    let rewardAmount = 10;
    try {
      const { CoinConfig } = require('../models/CoinConfig');
      const config = await CoinConfig.findOne({ key: 'daily_login_reward' });
      if (config) rewardAmount = config.value;
    } catch (e) { /* use default */ }

    res.json({
      success: true,
      data: {
        canClaim: !alreadyClaimed,
        currentStreak: currentStreak,
        coinsToEarn: rewardAmount,
        lastClaimed: wallet.lastDailyLogin || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching streak status:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch streak status' }
    });
  }
});

// @route   POST /api/wallet/deduct-coins
// @desc    Deduct coins from wallet for store purchases
// @access  Private
router.post('/deduct-coins', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, description, category } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Amount must be greater than 0',
          timestamp: new Date().toISOString()
        }
      });
    }

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }

    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: `Insufficient coins. You need ${amount - wallet.balance} more coins.`,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Deduct coins
    await wallet.deductCoins(
      amount,
      description || 'Store Purchase',
      { source: category || 'store_purchase' }
    );

    res.json({
      success: true,
      data: {
        newBalance: wallet.balance,
        amountDeducted: amount,
        description: description || 'Store Purchase'
      },
      message: `Successfully deducted ${amount} coins`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deducting coins:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to deduct coins',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
