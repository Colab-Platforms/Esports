const WalletService = require('./wallet.service');

const errorResponse = (res, status, code, message) => res.status(status).json({
  success: false,
  error: {
    code,
    message,
    timestamp: new Date().toISOString()
  }
});

const getWallet = async (req, res) => {
  try {
    const data = await WalletService.getWalletSummary(req.user.userId);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch wallet');
  }
};

const getTransactions = async (req, res) => {
  try {
    const data = await WalletService.getEmbeddedTransactionHistory(req.user.userId, req.query);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch transactions');
  }
};

const claimDailyLogin = async (req, res) => {
  try {
    const data = await WalletService.claimDailyLoginReward(req.user.userId);

    res.json({
      success: true,
      data,
      message: data.streakBonusCoins > 0
        ? `${data.streakMilestone}-Day Streak Complete! You earned ${data.coinsEarned} coins + ${data.streakBonusCoins} bonus coins!`
        : `You earned ${data.coinsEarned} Colab Coins! ${data.streak} day streak!`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === 'ALREADY_CLAIMED') {
      return errorResponse(res, 400, error.code, error.message);
    }

    console.error('Error claiming daily reward:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to claim daily reward');
  }
};

const getStreakStatus = async (req, res) => {
  try {
    const data = await WalletService.getStreakStatus(req.user.userId);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching streak status:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch streak status');
  }
};

const deductCoins = async (req, res) => {
  try {
    const data = await WalletService.deductCoinsForPurchase(req.user.userId, req.body);

    res.json({
      success: true,
      data,
      message: `Successfully deducted ${data.amountDeducted} coins`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === 'INVALID_AMOUNT' || error.code === 'INSUFFICIENT_BALANCE') {
      return errorResponse(res, 400, error.code, error.message);
    }

    console.error('Error deducting coins:', error);
    errorResponse(res, 500, 'SERVER_ERROR', error.message || 'Failed to deduct coins');
  }
};

module.exports = {
  claimDailyLogin,
  deductCoins,
  getStreakStatus,
  getTransactions,
  getWallet
};
