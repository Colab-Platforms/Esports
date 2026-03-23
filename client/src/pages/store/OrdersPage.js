import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiPackage, FiArrowLeft, FiCheck, FiClock } from 'react-icons/fi';
import api from '../../services/api';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/store/orders', {
        params: { page, limit: 20 }
      });
      if (response.success) {
        setOrders(response.data.orders);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <FiCheck className="w-4 h-4" />;
      case 'pending':
        return <FiClock className="w-4 h-4" />;
      default:
        return <FiPackage className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/store"
            className="inline-flex items-center space-x-2 text-gaming-gold hover:text-yellow-400 mb-4"
          >
            <FiArrowLeft />
            <span>Back to Store</span>
          </Link>
          <h1 className="text-3xl font-gaming font-bold text-white mb-2">
            📦 My Orders
          </h1>
          <p className="text-gray-400">
            View your purchase history and order status
          </p>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <FiPackage className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No orders yet</p>
            <Link to="/store" className="btn-gaming">
              Browse Store
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card-gaming p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    {/* Item Image */}
                    {order.itemId?.image && (
                      <div className="w-20 h-20 bg-gaming-charcoal rounded-lg flex items-center justify-center flex-shrink-0">
                        <img
                          src={order.itemId.image}
                          alt={order.itemName}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}

                    {/* Order Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            {order.itemName}
                          </h3>
                          {order.itemId?.category && (
                            <span className="inline-block px-2 py-1 bg-gaming-neon/20 text-gaming-neon text-xs rounded">
                              {order.itemId.category}
                            </span>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          <span>{order.status}</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-gray-400">
                          <p>Order Date: {new Date(order.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</p>
                          <p className="mt-1">Order ID: #{order._id.slice(-8)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gaming-gold">
                            {order.price}
                          </p>
                          <p className="text-sm text-gray-400">Colab Coins</p>
                        </div>
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
          <div className="flex items-center justify-center space-x-2 mt-8">
            <button
              onClick={() => setPage(page - 1)}
              disabled={!pagination.hasPrevPage}
              className="px-4 py-2 bg-gaming-charcoal text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gaming-border transition-colors"
            >
              Previous
            </button>
            <span className="text-gray-400">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!pagination.hasNextPage}
              className="px-4 py-2 bg-gaming-charcoal text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gaming-border transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
