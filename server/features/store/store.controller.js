const storeService = require('./store.service');

const errorResponse = (res, status, code, message) => res.status(status).json({
  success: false,
  error: {
    code,
    message,
    timestamp: new Date().toISOString()
  }
});

const handleKnownError = (res, error, fallbackMessage) => {
  if (error.code && error.status) {
    return errorResponse(res, error.status, error.code, error.message);
  }

  return errorResponse(res, 500, 'SERVER_ERROR', error.message || fallbackMessage);
};

const getStoreItems = async (req, res) => {
  try {
    const items = await storeService.getStoreItems(req.query);

    res.json({
      success: true,
      data: { items },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching store items:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch store items');
  }
};

const buyStoreItem = async (req, res) => {
  try {
    const data = await storeService.buyStoreItem({
      userId: req.user.userId,
      itemId: req.params.itemId,
      playerID: req.body.playerID
    });

    res.json({
      success: true,
      data,
      message: 'Item claimed! Admin will fulfill your order shortly.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error purchasing item:', error);
    handleKnownError(res, error, 'Failed to purchase item');
  }
};

const getUserOrders = async (req, res) => {
  try {
    const data = await storeService.getUserOrders({
      userId: req.user.userId,
      ...req.query
    });

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch orders');
  }
};

const getAdminClaims = async (req, res) => {
  try {
    const data = await storeService.getAdminClaims(req.query);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching claims:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch claims');
  }
};

const fulfillClaim = async (req, res) => {
  try {
    const claim = await storeService.fulfillClaim({
      claimId: req.params.claimId,
      adminId: req.user.userId
    });

    res.json({
      success: true,
      data: { claim },
      message: 'Claim marked as fulfilled',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fulfilling claim:', error);
    handleKnownError(res, error, 'Failed to fulfill claim');
  }
};

const failClaim = async (req, res) => {
  try {
    const claim = await storeService.failClaim({
      claimId: req.params.claimId,
      adminId: req.user.userId,
      reason: req.body.reason
    });

    res.json({
      success: true,
      data: { claim },
      message: 'Claim marked as failed and coins refunded',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error failing claim:', error);
    handleKnownError(res, error, 'Failed to mark claim as failed');
  }
};

const cancelOrder = async (req, res) => {
  try {
    const data = await storeService.cancelOrder({
      userId: req.user.userId,
      orderId: req.params.orderId,
      reason: req.body.reason
    });

    res.json({
      success: true,
      data,
      message: `Order cancelled. ${data.refundedCoins} coins refunded to your wallet.`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    handleKnownError(res, error, 'Failed to cancel order');
  }
};

module.exports = {
  buyStoreItem,
  cancelOrder,
  failClaim,
  fulfillClaim,
  getAdminClaims,
  getStoreItems,
  getUserOrders
};
