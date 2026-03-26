import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FiPackage, FiArrowLeft, FiCheck, FiClock, FiX, FiAlertTriangle } from 'react-icons/fi';
import api from '../../services/api';
import { updateProfile } from '../../store/slices/authSlice';

const CANCEL_WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours

// Returns { hours, minutes, seconds, expired } from order createdAt
const getTimeLeft = (createdAt) => {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  const remaining = CANCEL_WINDOW_MS - elapsed;
  if (remaining <= 0) return { expired: true, hours: 0, minutes: 0, seconds: 0 };
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return { expired: false, hours, minutes, seconds };
};

// Live countdown for a single order
const CancelCountdown = ({ createdAt }) => {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(createdAt));

  useEffect(() => {
    if (timeLeft.expired) return;
    const id = setInterval(() => setTimeLeft(getTimeLeft(createdAt)), 1000);
    return () => clearInterval(id);
  }, [createdAt, timeLeft.expired]);

  if (timeLeft.expired) return null;

  return (
    <span className="text-xs text-gray-500">
      Cancel window:{' '}
      <span className="text-yellow-400 font-mono">
        {String(timeLeft.hours).padStart(2, '0')}:
        {String(timeLeft.minutes).padStart(2, '0')}:
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </span>
  );
};

// Confirmation modal
const CancelModal = ({ order, onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-gaming-charcoal border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
          <FiAlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white">Cancel Order?</h3>
      </div>
      <p className="text-gray-400 text-sm mb-2">
        You're about to cancel <span className="text-white font-medium">{order.itemName}</span>.
      </p>
      <p className="text-sm mb-6">
        <span className="text-gaming-gold font-bold">{order.price} coins</span>
        <span className="text-gray-400"> will be refunded to your wallet immediately.</span>
      </p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors text-sm font-medium"
        >
          Keep Order
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-bold disabled:opacity-60"
        >
          {loading ? 'Cancelling...' : 'Yes, Cancel'}
        </button>
      </div>
    </motion.div>
  </div>
);

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'refunded': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'completed': return <FiCheck className="w-3.5 h-3.5" />;
    case 'pending': return <FiClock className="w-3.5 h-3.5" />;
    case 'cancelled': return <FiX className="w-3.5 h-3.5" />;
    default: return <FiPackage className="w-3.5 h-3.5" />;
  }
};

const OrdersPage = () => {
  const dispatch = useDispatch();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null); // order to cancel
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState(null); // { type, message }

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/store/orders', { params: { page, limit: 20 } });
      if (response.success) {
        setOrders(response.data.orders);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const response = await api.post(`/api/store/orders/${cancelTarget._id}/cancel`, {
        reason: 'Cancelled by user'
      });

      if (response.success) {
        // Update order in local state
        setOrders(prev =>
          prev.map(o => o._id === cancelTarget._id
            ? { ...o, status: 'cancelled', cancelledAt: new Date().toISOString() }
            : o
          )
        );
        // Sync wallet balance in Redux so navbar updates
        if (response.data?.newBalance !== undefined) {
          dispatch(updateProfile({ walletBalance: response.data.newBalance }));
        }
        showToast('success', `${response.data.refundedCoins} coins refunded to your wallet`);
      }
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const msgs = {
        CANCELLATION_WINDOW_EXPIRED: 'Cancellation window has expired (5 hours)',
        ORDER_FULFILLED: 'Cannot cancel a fulfilled order',
        ALREADY_CANCELLED: 'Order is already cancelled',
      };
      showToast('error', msgs[code] || 'Failed to cancel order');
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const canCancel = (order) => {
    if (order.status === 'cancelled' || order.status === 'completed' ||
        order.status === 'refunded' || order.claimStatus === 'fulfilled') return false;
    const elapsed = Date.now() - new Date(order.createdAt).getTime();
    return elapsed < CANCEL_WINDOW_MS;
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <Link to="/store" className="inline-flex items-center gap-2 text-gaming-gold hover:text-yellow-400 mb-4 text-sm">
            <FiArrowLeft />
            Back to Store
          </Link>
          <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            My Orders
          </h1>
          <p className="text-gray-400 text-sm">Orders can be cancelled within 5 hours of purchase</p>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
                toast.type === 'success'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {toast.type === 'success' ? <FiCheck /> : <FiX />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orders */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <FiPackage className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No orders yet</p>
            <Link to="/store" className="btn-gaming">Browse Store</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="card-gaming p-5"
              >
                <div className="flex items-start gap-4">
                  {/* Image */}
                  {order.itemId?.image && (
                    <div className="w-16 h-16 bg-gaming-charcoal rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-700">
                      <img src={order.itemId.image} alt={order.itemName} className="max-w-full max-h-full object-contain" />
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-base font-bold text-white">{order.itemName}</h3>
                        {order.itemId?.category && (
                          <span className="text-xs text-gaming-gold bg-gaming-gold/10 px-2 py-0.5 rounded mt-1 inline-block">
                            {order.itemId.category}
                          </span>
                        )}
                      </div>
                      {/* Status badge */}
                      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </div>

                    <div className="flex items-end justify-between mt-3">
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p>
                          {new Date(order.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                        <p>Order #{order._id.slice(-8)}</p>
                        {/* Live countdown */}
                        {order.status === 'pending' && (
                          <CancelCountdown createdAt={order.createdAt} />
                        )}
                        {/* Cancelled info */}
                        {order.status === 'cancelled' && order.cancelledAt && (
                          <span className="text-red-400">
                            Cancelled · {order.price} coins refunded
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xl font-bold text-gaming-gold">{order.price}</p>
                          <p className="text-xs text-gray-500">Colab Coins</p>
                        </div>

                        {/* Cancel button */}
                        {canCancel(order) && (
                          <button
                            onClick={() => setCancelTarget(order)}
                            className="px-3 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 transition-all text-xs font-medium flex items-center gap-1"
                          >
                            <FiX className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        )}

                        {/* Expired — cannot cancel */}
                        {order.status === 'pending' && !canCancel(order) && (
                          <span className="px-3 py-2 rounded-lg border border-gray-700 text-gray-600 text-xs">
                            Cannot Cancel
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={!pagination.hasPrevPage}
              className="px-4 py-2 bg-gaming-charcoal text-white rounded-lg disabled:opacity-40 hover:bg-gaming-border transition-colors text-sm"
            >
              Previous
            </button>
            <span className="text-gray-400 text-sm">
              {pagination.currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!pagination.hasNextPage}
              className="px-4 py-2 bg-gaming-charcoal text-white rounded-lg disabled:opacity-40 hover:bg-gaming-border transition-colors text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      <AnimatePresence>
        {cancelTarget && (
          <CancelModal
            order={cancelTarget}
            onConfirm={handleCancelConfirm}
            onClose={() => setCancelTarget(null)}
            loading={cancelling}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrdersPage;
