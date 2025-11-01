const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
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
}

module.exports = WalletService;