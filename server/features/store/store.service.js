const StoreItem = require('./store-item.model');
const Order = require('./order.model');
const Wallet = require('../../models/Wallet');
const Notification = require('../../models/Notification');
const { ORDER_CANCEL_WINDOW_MS } = require('./store.constants');

const createError = (code, message, status = 400) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const parsePagination = ({ page = 1, limit = 20 }) => {
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  return {
    pageNum,
    limitNum,
    skip: (pageNum - 1) * limitNum
  };
};

const getStoreItems = async ({ category } = {}) => {
  const query = { isActive: true };
  if (category) {
    query.category = category;
  }

  return StoreItem.find(query).sort({ createdAt: -1 });
};

const buyStoreItem = async ({ userId, itemId, playerID }) => {
  if (!playerID || !playerID.trim()) {
    throw createError('INVALID_PLAYER_ID', 'Player ID is required');
  }

  const item = await StoreItem.findById(itemId);

  if (!item) {
    throw createError('ITEM_NOT_FOUND', 'Item not found', 404);
  }

  if (!item.isActive) {
    throw createError('ITEM_INACTIVE', 'Item is not available');
  }

  if (item.stock !== -1 && item.stock <= 0) {
    throw createError('OUT_OF_STOCK', 'Item is out of stock');
  }

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId });
    await wallet.save();
  }

  if (wallet.balance < item.price) {
    throw createError('INSUFFICIENT_BALANCE', 'Insufficient Colab Coins');
  }

  await wallet.deductCoins(
    item.price,
    `Purchased ${item.name}`,
    { source: 'store_purchase', itemId: item._id }
  );

  if (item.stock !== -1) {
    item.stock -= 1;
    await item.save();
  }

  const order = new Order({
    userId,
    itemId: item._id,
    itemName: item.name,
    price: item.price,
    playerID: playerID.trim(),
    status: 'pending',
    claimStatus: 'pending',
    metadata: item.metadata
  });
  await order.save();

  return {
    order,
    newBalance: wallet.balance
  };
};

const getUserOrders = async ({ userId, page, limit }) => {
  const { pageNum, limitNum, skip } = parsePagination({ page, limit });

  const totalOrders = await Order.countDocuments({ userId });

  const orders = await Order.find({ userId })
    .populate('itemId', 'name image category')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  return {
    orders,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalOrders / limitNum),
      totalOrders,
      hasNextPage: pageNum < Math.ceil(totalOrders / limitNum),
      hasPrevPage: pageNum > 1
    }
  };
};

const getAdminClaims = async ({ page = 1, limit = 8, status = 'all' } = {}) => {
  const { pageNum, limitNum, skip } = parsePagination({ page, limit });

  const query = {};
  if (status === 'cancelled') {
    query.status = 'cancelled';
  } else if (status !== 'all') {
    query.claimStatus = status;
  }

  const totalClaims = await Order.countDocuments(query);

  const claims = await Order.find(query)
    .populate('userId', 'username email')
    .populate('itemId', 'name category metadata')
    .populate('fulfilledBy', 'username')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  return {
    claims,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalClaims / limitNum),
      totalClaims,
      hasNextPage: pageNum < Math.ceil(totalClaims / limitNum),
      hasPrevPage: pageNum > 1
    }
  };
};

const fulfillClaim = async ({ claimId, adminId }) => {
  const claim = await Order.findById(claimId);

  if (!claim) {
    throw createError('CLAIM_NOT_FOUND', 'Claim not found', 404);
  }

  if (claim.claimStatus !== 'pending') {
    throw createError('INVALID_STATUS', `Cannot fulfill claim with status: ${claim.claimStatus}`);
  }

  claim.claimStatus = 'fulfilled';
  claim.status = 'completed';
  claim.fulfilledBy = adminId;
  claim.fulfilledAt = new Date();
  await claim.save();

  const notification = new Notification({
    user: claim.userId,
    type: 'order_fulfilled',
    title: 'Your ordered item is fulfilled successfully',
    message: `Your order for "${claim.itemName}" has been fulfilled. Visit your orders page to collect it.`,
    actionUrl: '/store/orders',
    metadata: {
      orderId: claim._id,
      itemName: claim.itemName,
      itemId: claim.itemId
    }
  });
  await notification.save();

  return claim;
};

const failClaim = async ({ claimId, adminId, reason }) => {
  const claim = await Order.findById(claimId);

  if (!claim) {
    throw createError('CLAIM_NOT_FOUND', 'Claim not found', 404);
  }

  if (claim.claimStatus !== 'pending') {
    throw createError('INVALID_STATUS', `Cannot fail claim with status: ${claim.claimStatus}`);
  }

  claim.claimStatus = 'failed';
  claim.status = 'cancelled';
  claim.fulfilledBy = adminId;
  claim.fulfilledAt = new Date();
  claim.failureReason = reason || 'No reason provided';
  await claim.save();

  const wallet = await Wallet.findOne({ userId: claim.userId });
  if (wallet) {
    await wallet.addCoins(
      claim.price,
      'refund',
      `Refund for failed claim: ${claim.itemName}`,
      { source: 'claim_refund', claimId: claim._id }
    );
  }

  return claim;
};

const cancelOrder = async ({ userId, orderId, reason }) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw createError('ORDER_NOT_FOUND', 'Order not found', 404);
  }

  if (order.userId.toString() !== userId) {
    throw createError('UNAUTHORIZED', 'Not your order', 403);
  }

  if (order.status === 'cancelled' || order.status === 'refunded') {
    throw createError('ALREADY_CANCELLED', 'Order is already cancelled');
  }

  if (order.status === 'completed' || order.claimStatus === 'fulfilled') {
    throw createError('ORDER_FULFILLED', 'Cannot cancel a fulfilled order');
  }

  const elapsed = Date.now() - new Date(order.createdAt).getTime();
  if (elapsed > ORDER_CANCEL_WINDOW_MS) {
    throw createError('CANCELLATION_WINDOW_EXPIRED', 'Cancellation window of 5 hours has passed');
  }

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancellationReason = reason || 'Cancelled by user';
  await order.save();

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId });
  }

  await wallet.addCoins(
    order.price,
    'refund',
    `Refund for cancelled order: ${order.itemName}`,
    { source: 'order_cancellation', orderId: order._id }
  );

  const item = await StoreItem.findById(order.itemId);
  if (item && item.stock !== -1) {
    item.stock += 1;
    await item.save();
  }

  return {
    order,
    refundedCoins: order.price,
    newBalance: wallet.balance
  };
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
