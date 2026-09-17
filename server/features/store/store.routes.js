const express = require('express');
const storeController = require('./store.controller');
const { storeAuth } = require('./store.permissions');

const router = express.Router();

// Public
router.get('/', storeController.getStoreItems);

// User
router.post('/buy/:itemId', storeAuth, storeController.buyStoreItem);
router.get('/orders', storeAuth, storeController.getUserOrders);
router.post('/orders/:orderId/cancel', storeAuth, storeController.cancelOrder);

// Admin
router.get('/admin/claims', storeAuth, storeController.getAdminClaims);
router.put('/admin/claims/:claimId/fulfill', storeAuth, storeController.fulfillClaim);
router.put('/admin/claims/:claimId/fail', storeAuth, storeController.failClaim);

module.exports = router;
