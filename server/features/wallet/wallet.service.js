const Wallet = require('./wallet.model');
const Transaction = require('./transaction.model');
const mongoose = require('mongoose');

class WalletService {
  // Create wallet for new user
  static async createWallet(userId) {
    try {
      const existingWallet = await Wallet.findOne({ userId });
      if (existingWallet) {
        return existingWallet;
      }

      const wallet = new Wallet({ userId });
      await wallet.save();
      return wallet;
    } catch (error) {
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  // Get wallet by user ID
  static async getWallet(userId) {
    try {
      let wallet = await Wallet.findOne({ userId }).populate('userId', 'username email');
      if (!wallet) {
        wallet = await this.createWallet(userId);
      }
      return wallet;
    } catch (error) {
      throw new Error(`Failed to get wallet: ${error.message}`);
    }
  }

  // Add money to wallet (deposit/prize/bonus)
  static async addMoney(userId, amount, type, description, reference = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      // Update wallet balance
      wallet.balance = balanceAfter;
      wallet.lastTransactionAt = new Date();
      
      if (type === 'prize_win' || type === 'bonus') {
        wallet.totalEarnings += amount;
      }

      await wallet.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        userId,
        walletId: wallet._id,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        status: 'completed',
        description,
        reference
      });

      await transaction.save({ session });
      await session.commitTransaction();

      return { wallet, transaction };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to add money: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  // Deduct money from wallet (tournament fee/withdrawal)
  static async deductMoney(userId, amount, type, description, reference = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.balance < amount) {
        throw new Error('Insufficient balance');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - amount;

      // Update wallet balance
      wallet.balance = balanceAfter;
      wallet.lastTransactionAt = new Date();
      
      if (type === 'tournament_fee') {
        wallet.totalSpent += amount;
      } else if (type === 'withdrawal') {
        wallet.totalWithdrawn += amount;
      }

      await wallet.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        userId,
        walletId: wallet._id,
        type,
        amount: -amount, // Negative for deductions
        balanceBefore,
        balanceAfter,
        status: 'completed',
        description,
        reference
      });

      await transaction.save({ session });
      await session.commitTransaction();

      return { wallet, transaction };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to deduct money: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  // Get transaction history
  static async getTransactionHistory(userId, page = 1, limit = 20, type = null) {
    try {
      const query = { userId };
      if (type) {
        query.type = type;
      }

      const transactions = await Transaction.find(query)
        .populate('reference.tournamentId', 'name gameType')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Transaction.countDocuments(query);

      return {
        transactions,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      };
    } catch (error) {
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }

  // Check if user has sufficient balance
  static async hasSufficientBalance(userId, amount) {
    try {
      const wallet = await Wallet.findOne({ userId });
      return wallet && wallet.balance >= amount;
    } catch (error) {
      return false;
    }
  }

  // Get wallet statistics
  static async getWalletStats(userId) {
    try {
      const wallet = await this.getWallet(userId);
      
      const stats = await Transaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      return {
        balance: wallet.balance,
        totalEarnings: wallet.totalEarnings,
        totalSpent: wallet.totalSpent,
        totalWithdrawn: wallet.totalWithdrawn,
        transactionStats: stats
      };
    } catch (error) {
      throw new Error(`Failed to get wallet stats: ${error.message}`);
    }
  }

  static async getWalletSummary(userId) {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }

    const recentTransactions = wallet.transactions
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);

    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= -2; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const claimed = i >= 0 ? (wallet.dailyLoginHistory?.some(entry => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === date.getTime();
      }) || false) : false;

      days.push({
        date: date.toISOString(),
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        claimed,
        isToday: i === 0,
        isFuture: i < 0,
        isPast: i > 0
      });
    }

    const todayAtMidnight = new Date();
    todayAtMidnight.setHours(0, 0, 0, 0);

    const yesterdayAtMidnight = new Date(todayAtMidnight);
    yesterdayAtMidnight.setDate(yesterdayAtMidnight.getDate() - 1);

    const isStreakValid = wallet.lastDailyLogin && wallet.lastDailyLogin >= yesterdayAtMidnight;
    const currentStreak = isStreakValid ? (wallet.streak || 0) : 0;

    return {
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      streak: currentStreak,
      lastDailyLogin: wallet.lastDailyLogin,
      last7Days: days.filter(d => !d.isFuture),
      days,
      recentTransactions
    };
  }

  static async getEmbeddedTransactionHistory(userId, { page = 1, limit = 20, type } = {}) {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return {
        transactions: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalTransactions: 0
        }
      };
    }

    let transactions = wallet.transactions;

    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }

    transactions.sort((a, b) => b.createdAt - a.createdAt);

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    return {
      transactions: transactions.slice(startIndex, endIndex),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(transactions.length / limitNum),
        totalTransactions: transactions.length,
        hasNextPage: endIndex < transactions.length,
        hasPrevPage: pageNum > 1
      }
    };
  }

  static async claimDailyLoginReward(userId) {
    const { CoinConfig } = require('../../models/CoinConfig');

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({ userId });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (wallet.lastDailyLogin && wallet.lastDailyLogin >= today) {
      const error = new Error('Daily reward already claimed today');
      error.code = 'ALREADY_CLAIMED';
      throw error;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (wallet.lastDailyLogin && wallet.lastDailyLogin >= yesterday && wallet.lastDailyLogin < today) {
      wallet.streak = (wallet.streak || 0) + 1;
    } else {
      wallet.streak = 1;
    }

    const config = await CoinConfig.findOne({ key: 'daily_login_reward' });
    const rewardAmount = config ? config.value : 10;

    await wallet.addCoins(
      rewardAmount,
      'earn',
      'Daily Login Reward',
      { source: 'daily_login' }
    );

    wallet.lastDailyLogin = new Date();

    if (!wallet.dailyLoginHistory) {
      wallet.dailyLoginHistory = [];
    }

    wallet.dailyLoginHistory.push({
      date: new Date(),
      claimed: true,
      coinsEarned: rewardAmount
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    wallet.dailyLoginHistory = wallet.dailyLoginHistory.filter(
      entry => entry.date >= thirtyDaysAgo
    );

    await wallet.save();

    let streakBonusCoins = 0;
    let streakMilestone = 0;

    if (wallet.streak > 0 && wallet.streak % 7 === 0) {
      streakMilestone = wallet.streak;
      streakBonusCoins = 30;

      await wallet.addCoins(
        streakBonusCoins,
        'bonus',
        `${streakMilestone}-Day Streak Bonus`,
        { source: 'streak_bonus', streakDays: streakMilestone }
      );

      await wallet.save();
    }

    return {
      coinsEarned: rewardAmount,
      streakBonusCoins,
      totalCoinsEarned: rewardAmount + streakBonusCoins,
      newBalance: wallet.balance,
      streak: wallet.streak,
      streakCompleted: streakBonusCoins > 0,
      streakMilestone
    };
  }

  static async getStreakStatus(userId) {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alreadyClaimed = wallet.lastDailyLogin && wallet.lastDailyLogin >= today;

    const yesterdayAtMidnight = new Date(today);
    yesterdayAtMidnight.setDate(yesterdayAtMidnight.getDate() - 1);

    const isStreakValid = wallet.lastDailyLogin && wallet.lastDailyLogin >= yesterdayAtMidnight;
    const currentStreak = isStreakValid ? (wallet.streak || 0) : 0;

    let rewardAmount = 10;
    try {
      const { CoinConfig } = require('../../models/CoinConfig');
      const config = await CoinConfig.findOne({ key: 'daily_login_reward' });
      if (config) rewardAmount = config.value;
    } catch (e) { /* use default */ }

    return {
      canClaim: !alreadyClaimed,
      currentStreak,
      coinsToEarn: rewardAmount,
      lastClaimed: wallet.lastDailyLogin || null
    };
  }

  static async deductCoinsForPurchase(userId, { amount, description, category }) {
    if (!amount || amount <= 0) {
      const error = new Error('Amount must be greater than 0');
      error.code = 'INVALID_AMOUNT';
      throw error;
    }

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }

    if (wallet.balance < amount) {
      const error = new Error(`Insufficient coins. You need ${amount - wallet.balance} more coins.`);
      error.code = 'INSUFFICIENT_BALANCE';
      throw error;
    }

    await wallet.deductCoins(
      amount,
      description || 'Store Purchase',
      { source: category || 'store_purchase' }
    );

    return {
      newBalance: wallet.balance,
      amountDeducted: amount,
      description: description || 'Store Purchase'
    };
  }
}

module.exports = WalletService;
