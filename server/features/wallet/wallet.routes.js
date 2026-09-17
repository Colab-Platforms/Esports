const express = require('express');
const walletController = require('./wallet.controller');
const { walletAuth } = require('./wallet.permissions');

const router = express.Router();

router.get('/', walletAuth, walletController.getWallet);
router.get('/transactions', walletAuth, walletController.getTransactions);
router.post('/daily-login', walletAuth, walletController.claimDailyLogin);
router.get('/streak-status', walletAuth, walletController.getStreakStatus);
router.post('/deduct-coins', walletAuth, walletController.deductCoins);

module.exports = router;
