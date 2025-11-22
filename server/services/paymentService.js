const Razorpay = require('razorpay');
const crypto = require('crypto');
const WalletService = require('./walletService');
const Transaction = require('../models/Transaction');

class PaymentService {
  constructor() {
    // Make Razorpay optional - only initialize if keys are provided
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      console.log('💳 Razorpay payment gateway initialized');
    } else {
      this.razorpay = null;
      console.log('⚠️  Razorpay not configured - payment features disabled');
    }
  }

  // Create Razorpay order for deposit
  async createDepositOrder(userId, amount) {
    if (!this.razorpay) {
      throw new Error('Payment gateway not configured. Please contact administrator.');
    }
    
    try {
      const options = {
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: `deposit_${userId}_${Date.now()}`,
        notes: {
          userId: userId.toString(),
          type: 'wallet_deposit'
        }
      };

      const order = await this.razorpay.orders.create(options);
      
      // Create pending transaction
      const wallet = await WalletService.getWallet(userId);
      const transaction = new Transaction({
        userId,
        walletId: wallet._id,
        type: 'deposit',
        amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance + amount,
        status: 'pending',
        description: `Wallet deposit of ₹${amount}`,
        reference: {
          orderId: order.id
        }
      });

      await transaction.save();

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        transactionId: transaction._id
      };
    } catch (error) {
      throw new Error(`Failed to create deposit order: ${error.message}`);
    }
  }

  // Verify payment and update wallet
  async verifyPayment(paymentData) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

      // Verify signature
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        throw new Error('Invalid payment signature');
      }

      // Find pending transaction
      const transaction = await Transaction.findOne({
        'reference.orderId': razorpay_order_id,
        status: 'pending'
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Get payment details from Razorpay
      const payment = await this.razorpay.payments.fetch(razorpay_payment_id);

      if (payment.status === 'captured') {
        // Update transaction status
        transaction.status = 'completed';
        transaction.reference.paymentId = razorpay_payment_id;
        transaction.metadata = {
          paymentMethod: payment.method,
          gatewayResponse: payment
        };
        await transaction.save();

        // Add money to wallet
        await WalletService.addMoney(
          transaction.userId,
          transaction.amount,
          'deposit',
          `Wallet deposit of ₹${transaction.amount} via ${payment.method}`,
          {
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id
          }
        );

        return { success: true, transaction };
      } else {
        // Mark transaction as failed
        transaction.status = 'failed';
        transaction.metadata = {
          paymentMethod: payment.method,
          gatewayResponse: payment
        };
        await transaction.save();

        throw new Error('Payment not captured');
      }
    } catch (error) {
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  // Handle failed payments
  async handleFailedPayment(orderId, reason) {
    try {
      const transaction = await Transaction.findOne({
        'reference.orderId': orderId,
        status: 'pending'
      });

      if (transaction) {
        transaction.status = 'failed';
        transaction.metadata = {
          ...transaction.metadata,
          failureReason: reason
        };
        await transaction.save();
      }

      return transaction;
    } catch (error) {
      throw new Error(`Failed to handle payment failure: ${error.message}`);
    }
  }

  // Create withdrawal request (basic implementation)
  async createWithdrawalRequest(userId, amount, bankDetails) {
    try {
      const wallet = await WalletService.getWallet(userId);
      
      if (wallet.balance < amount) {
        throw new Error('Insufficient balance');
      }

      if (amount < 100) {
        throw new Error('Minimum withdrawal amount is ₹100');
      }

      // Create pending withdrawal transaction
      const transaction = new Transaction({
        userId,
        walletId: wallet._id,
        type: 'withdrawal',
        amount: -amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance - amount,
        status: 'pending',
        description: `Withdrawal request of ₹${amount}`,
        reference: {
          withdrawalId: `WD_${Date.now()}_${userId}`
        },
        metadata: {
          bankDetails,
          adminNotes: 'Pending admin approval'
        }
      });

      await transaction.save();

      return transaction;
    } catch (error) {
      throw new Error(`Failed to create withdrawal request: ${error.message}`);
    }
  }

  // Process withdrawal (admin function)
  async processWithdrawal(transactionId, status, adminNotes = '') {
    try {
      const transaction = await Transaction.findById(transactionId);
      
      if (!transaction || transaction.type !== 'withdrawal') {
        throw new Error('Withdrawal transaction not found');
      }

      if (status === 'completed') {
        // Deduct money from wallet
        await WalletService.deductMoney(
          transaction.userId,
          Math.abs(transaction.amount),
          'withdrawal',
          `Withdrawal processed: ₹${Math.abs(transaction.amount)}`,
          { withdrawalId: transaction.reference.withdrawalId }
        );
      }

      transaction.status = status;
      transaction.metadata.adminNotes = adminNotes;
      await transaction.save();

      return transaction;
    } catch (error) {
      throw new Error(`Failed to process withdrawal: ${error.message}`);
    }
  }

  // Distribute prize money
  async distributePrize(userId, amount, tournamentId, description) {
    try {
      return await WalletService.addMoney(
        userId,
        amount,
        'prize_win',
        description,
        { tournamentId }
      );
    } catch (error) {
      throw new Error(`Failed to distribute prize: ${error.message}`);
    }
  }

  // Refund tournament fee
  async refundTournamentFee(userId, amount, tournamentId, reason) {
    try {
      return await WalletService.addMoney(
        userId,
        amount,
        'refund',
        `Tournament fee refund: ${reason}`,
        { tournamentId }
      );
    } catch (error) {
      throw new Error(`Failed to refund tournament fee: ${error.message}`);
    }
  }
}

module.exports = new PaymentService();