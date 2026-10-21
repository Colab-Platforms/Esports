const express = require('express');
const storeController = require('./store.controller');
const { storeAuth, storeAdminAuth } = require('./store.permissions');

const router = express.Router();

// Public
router.get('/', storeController.getStoreItems);

// User
router.post('/buy/:itemId', storeAuth, storeController.buyStoreItem);
router.get('/orders', storeAuth, storeController.getUserOrders);
router.post('/orders/:orderId/cancel', storeAuth, storeController.cancelOrder);

// Admin
router.get('/admin/claims', storeAdminAuth, storeController.getAdminClaims);
router.put('/admin/claims/:claimId/fulfill', storeAdminAuth, storeController.fulfillClaim);
router.put('/admin/claims/:claimId/fail', storeAdminAuth, storeController.failClaim);

module.exports = router;
