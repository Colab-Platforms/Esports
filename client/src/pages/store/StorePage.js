import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { FiShoppingCart, FiDollarSign, FiPackage, FiCheck } from 'react-icons/fi';
import { selectAuth } from '../../store/slices/authSlice';
import api from '../../services/api';

const StorePage = () => {
  const { user } = useSelector(selectAuth);
  const [items, setItems] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [purchasing, setPurchasing] = useState(null);

  const categories = [
    { id: 'all', label: 'All Items', icon: '🎁' },
    { id: 'avatar', label: 'Avatars', icon: '👤' },
    { id: 'badge', label: 'Badges', icon: '🏆' },
    { id: 'theme', label: 'Themes', icon: '🎨' },
    { id: 'boost', label: 'Boosts', icon: '⚡' },
    { id: 'other', label: 'Other', icon: '📦' }
  ];

  useEffect(() => {
    fetchStoreItems();
    fetchWallet();
  }, [selectedCategory]);

  const fetchStoreItems = async () => {
    try {
      setLoading(true);
      const params = selectedCategory !== 'all' ? { category: selectedCategory } : {};
      const response = await api.get('/api/store', { params });
      if (response.success) {
        setItems(response.data.items);
      }
    } catch (error) {
      console.error('Error fetching store items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const response = await api.get('/api/wallet');
      if (response.success) {
        setWallet(response.data);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const handlePurchase = async (itemId, itemName, price) => {
    if (!window.confirm(`Purchase ${itemName} for ${price} Colab Coins?`)) {
      return;
    }

    try {
      setPurchasing(itemId);
      const response = await api.post(`/api/store/buy/${itemId}`);
      if (response.success) {
        alert(`✅ ${response.message}`);
        fetchWallet();
        fetchStoreItems();
      }
    } catch (error) {
      alert(error.response?.data?.error?.message || 'Failed to purchase item');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-gaming font-bold text-white mb-2">
              🛍️ Colab Store
            </h1>
            <p className="text-gray-400">
              Redeem your Colab Coins for exclusive items
            </p>
          </div>

          {/* Balance Display */}
          <div className="card-gaming p-4">
            <div className="flex items-center space-x-3">
              <FiDollarSign className="text-gaming-gold w-6 h-6" />
              <div>
                <p className="text-sm text-gray-400">Your Balance</p>
                <p className="text-2xl font-bold text-white">
                  {wallet?.balance || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex items-center space-x-4 mb-8">
          <Link
            to="/wallet"
            className="px-4 py-2 bg-gaming-charcoal hover:bg-gaming-border text-white rounded-lg transition-colors"
          >
            View Wallet
          </Link>
          <Link
            to="/store/orders"
            className="px-4 py-2 bg-gaming-charcoal hover:bg-gaming-border text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <FiPackage className="w-4 h-4" />
            <span>My Orders</span>
          </Link>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-3 mb-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === category.id
                  ? 'bg-gaming-gold text-black'
                  : 'bg-gaming-charcoal text-gray-400 hover:text-white hover:bg-gaming-border'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </div>

        {/* Store Items Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading items...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No items available</p>
            <p className="text-sm text-gray-500">Check back later for new items!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, index) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card-gaming overflow-hidden hover:border-gaming-gold/50 transition-colors"
              >
                {/* Item Image */}
                {item.image && (
                  <div className="h-48 bg-gaming-charcoal flex items-center justify-center">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}

                <div className="p-6">
                  {/* Category Badge */}
                  <span className="inline-block px-3 py-1 bg-gaming-neon/20 text-gaming-neon text-xs rounded-full mb-3">
                    {item.category}
                  </span>

                  {/* Item Name */}
                  <h3 className="text-xl font-bold text-white mb-2">
                    {item.name}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {item.description}
                  </p>

                  {/* Stock Info */}
                  {item.stock !== -1 && (
                    <p className="text-sm text-gray-500 mb-4">
                      {item.stock > 0 ? (
                        <span>Stock: {item.stock} left</span>
                      ) : (
                        <span className="text-red-400">Out of Stock</span>
                      )}
                    </p>
                  )}

                  {/* Price & Purchase */}
                  <div className="flex items-center justify-between pt-4 border-t border-gaming-border">
                    <div className="flex items-center space-x-2">
                      <FiDollarSign className="text-gaming-gold" />
                      <span className="text-2xl font-bold text-white">
                        {item.price}
                      </span>
                    </div>

                    <button
                      onClick={() => handlePurchase(item._id, item.name, item.price)}
                      disabled={
                        purchasing === item._id ||
                        (item.stock !== -1 && item.stock <= 0) ||
                        (wallet?.balance || 0) < item.price
                      }
                      className="btn-gaming flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {purchasing === item._id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Buying...</span>
                        </>
                      ) : (wallet?.balance || 0) < item.price ? (
                        <>
                          <span>Insufficient Coins</span>
                        </>
                      ) : (
                        <>
                          <FiShoppingCart className="w-4 h-4" />
                          <span>Buy Now</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StorePage;
