import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import {
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiClock,
  FiFilter,
  FiCheck,
  FiShare2,
} from "react-icons/fi";
import { TbBrandCoinbase } from "react-icons/tb";

import { selectAuth } from "../../store/slices/authSlice";
import api from "../../services/api";

const WalletPage = () => {
  const { user } = useSelector(selectAuth);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedToday, setClaimedToday] = useState(false);
  const [last7Days, setLast7Days] = useState([]); // Date-wise streak data
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
  }, [page, filterType]);

  const fetchReferralCode = async () => {
    try {
      const response = await api.get('/api/referral/my-code');
      console.log('🎁 Referral API Response:', response);
      console.log('🎁 Response Data:', response.data);
      
      if (response.success) {
        console.log('✅ Success! Code:', response.data.referralCode);
        setReferralCode(response.data.referralCode);
        setReferralLink(response.data.referralLink);
        setShowReferralModal(true);
      } else {
        console.warn('⚠️ Response not successful:', response.data);
        alert('Failed to fetch referral code');
      }
    } catch (error) {
      console.error('❌ Error fetching referral code:', error);
      console.error('Error response:', error.response?.data);
      alert('Failed to fetch referral code'); 
    }
  };

  const handleCopyCode = () => {
    // Check if Clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(referralCode)
        .then(() => {
          setCopiedCode(true);
          setTimeout(() => setCopiedCode(false), 2000);
        })
        .catch((err) => {
          console.error('Failed to copy:', err);
          // Fallback to old method
          fallbackCopyToClipboard(referralCode);
        });
    } else {
      // Fallback for older browsers or insecure contexts
      fallbackCopyToClipboard(referralCode);
    }
  };

  // Fallback copy method for browsers that don't support Clipboard API
  const fallbackCopyToClipboard = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy. Please try again.');
    }
    document.body.removeChild(textArea);
  };

  const handleShareCode = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Colab Esports',
          text: `Join me on Colab Esports using my referral code: ${referralCode}`,
          url: referralLink
        });
      } catch (error) {
        console.log('Share cancelled or failed');
      }
    } else {
      handleCopyCode();
    }
  };

  const fetchWallet = async () => {
    try {
      const response = await api.get("/api/wallet");
      if (response.success) {
        setWallet(response.data);
        
        // Set 9 days data (7 past + today + 2 future)
        if (response.data.days) {
          setLast7Days(response.data.days);
        } else if (response.data.last7Days) {
          // Fallback for backward compatibility
          setLast7Days(response.data.last7Days);
        }
        
        // Check if already claimed today    
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (response.data.lastDailyLogin) {
          const lastLogin = new Date(response.data.lastDailyLogin);
          lastLogin.setHours(0, 0, 0, 0);
          setClaimedToday(lastLogin >= today);
        }
      }
    } catch (error) {
      console.error("Error fetching wallet:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (filterType !== "all") {
        params.type = filterType;
      }

      const response = await api.get("/api/wallet/transactions", { params });
      if (response.success) {
        setTransactions(response.data.transactions);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimDaily = async () => {
    try {
      setClaiming(true);
      const response = await api.post("/api/wallet/daily-login");
      if (response.success) {
        // Show special notification for 7-day, 14-day, 21-day, etc. milestones
        if (response.data.streakCompleted) {
          alert(`🎉🎉🎉 ${response.message}\n\nYou earned:\n✅ ${response.data.coinsEarned} coins (Daily)\n🏆 ${response.data.streakBonusCoins} coins (${response.data.streakMilestone}-Day Bonus)\n\nTotal: ${response.data.totalCoinsEarned} coins!`);
        } else {
          alert(`🎉 ${response.message}`);
        }
        setClaimedToday(true); // Mark as claimed
        fetchWallet();
        fetchTransactions();
      }
    } catch (error) {
      alert(error.response?.data?.error?.message || "Failed to claim reward");
    } finally {
      setClaiming(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case "earn":
      case "bonus":
      case "referral":
        return <FiTrendingUp className="text-green-400" />;
      case "spend":
        return <FiTrendingDown className="text-red-400" />;
      default:
        return <FiDollarSign className="text-gray-400" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case "earn":
      case "bonus":
      case "referral":
        return "text-green-400";
      case "spend":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          {/* Top Row - Title and Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-3">
            {/* LEFT SIDE */}
            <div>
              <h1 className="text-3xl font-gaming font-bold text-white mb-2">
                💰 Colab Coin Wallet
              </h1>
              <p className="text-gray-400">
                Earn coins, redeem rewards, and track your transactions
              </p>
            </div>

            {/* RIGHT SIDE - Buttons Only */}
            <div className="flex flex-row items-center gap-3">
              {/* Referral Code Button */}
              <button
                onClick={fetchReferralCode}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold transition-all duration-300 border-2 border-gaming-neon/60 bg-gaming-neon/10 text-gaming-neon hover:border-gaming-neon hover:bg-gaming-neon/20 hover:shadow-[0_0_8px_rgba(0,255,200,0.6)]"
              >
                <FiShare2 className="w-4 h-4" />
                <span>Referral Code</span>
              </button>
              
              {/* Claim Button */}
              <button
                onClick={handleClaimDaily}
                disabled={claiming || claimedToday}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-bold transition-all duration-300 ${
                  claimedToday
                    ? "border-2 border-green-400 bg-green-400/20 text-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"
                    : "btn-gaming"
                }`}
              >
                {claimedToday ? (
                  <>
                    <FiCheck className="w-4 h-4" />
                    <span>Claimed Today</span>
                  </>
                ) : (
                  <>
                    <FiClock className="w-4 h-4" />
                    <span>{claiming ? "Claiming..." : "Claim Now"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 9-Day Streak View - 7 Past + Today + 2 Future */}
          <div className="flex justify-center lg:justify-end">
            <div className="flex flex-col items-center gap-2">
              {/* <span className="text-xs text-gray-400 font-medium">Your Streak Journey</span> */}
              
              <div className="flex gap-1.5">
                {last7Days.map((day, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center gap-1"
                  >
                    {/* Day Circle */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        day.isFuture
                          ? "border-2 border-dashed border-gray-600 bg-gray-800/30 text-gray-500"
                          : day.claimed
                          ? "border-2 border-green-400 bg-green-400/20 text-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"
                          : day.isToday
                          ? "border-2 border-gaming-gold bg-gaming-gold/10 text-gaming-gold animate-pulse"
                          : "border-2 border-gray-600 bg-gray-700/50 text-gray-400"
                      }`}
                      title={`${day.dayName}, ${day.dayNumber}${
                        day.isFuture 
                          ? ' - Upcoming' 
                          : day.claimed 
                          ? ' - Claimed ✓' 
                          : day.isToday 
                          ? ' - Claim Today!' 
                          : ' - Missed'
                      }`}
                    >
                      {day.isFuture ? (
                        <span className="text-[10px]">{day.dayNumber}</span>
                      ) : day.claimed ? (
                        <FiCheck className="w-4 h-4" />
                      ) : (
                        <span className="text-[10px]">{day.dayNumber}</span>
                      )}
                    </div>
                    
                    {/* Day Name */}
                    <span className={`text-[9px] font-medium ${
                      day.isFuture 
                        ? 'text-gray-600' 
                        : day.isToday 
                        ? 'text-gaming-gold font-bold' 
                        : 'text-gray-500'
                    }`}>
                      {day.dayName}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Streak Count */}
              <div className="text-center mt-1">
                <span className="text-xs text-gray-400">
                  {last7Days.filter(d => d.claimed && !d.isFuture).length} / 7 Days Claimed
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Cards */}
        
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Current Balance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-gaming p-6 bg-gradient-to-br from-gaming-gold/20 to-gaming-neon/20"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm">Current Balance</h3>
              <TbBrandCoinbase className="text-gaming-gold w-6 h-6" />
            </div>
            <p className="text-4xl font-bold text-white mb-2">
              {wallet?.balance || 0}
            </p>
            <p className="text-gaming-gold text-sm">Colab Coins</p>
          </motion.div>


          {/* Total Earned */}
          {/* <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-gaming p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm">Total Earned</h3>
              <FiTrendingUp className="text-green-400 w-6 h-6" />
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {wallet?.totalEarned || 0}
            </p>
            <p className="text-green-400 text-sm">All Time</p>
          </motion.div> */}

          {/* Total Spent */}
          {/* <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-gaming p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm">Total Spent</h3>
              <FiTrendingDown className="text-red-400 w-6 h-6" />
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {wallet?.totalSpent || 0}
            </p>
            <p className="text-red-400 text-sm">All Time</p>
          </motion.div> */}

          {/* Streak */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.1 }}
  whileHover={{ scale: 1.02 }}
  className="relative card-gaming p-6 col-span-2 overflow-hidden"
>

  {/* glowing background */}
  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-red-500/10 to-yellow-500/10 blur-2xl"></div>

  <div className="relative flex items-center justify-between">

    {/* LEFT SIDE */}
    <div>

      <p className="text-gray-400 text-sm mb-1">
        7 Day Login Streak
      </p>

      <div className="flex items-end space-x-2">
        <span className="text-6xl font-extrabold text-white">
          {wallet?.streak || 0}
        </span>

        <span className="text-orange-400 font-semibold mb-2">
          / 7
        </span>
      </div>

      {/* motivational label */}
      <p className="text-sm mt-2 text-orange-400 font-semibold">
        {(wallet?.streak || 0) >= 6
          ? "🔥 Legendary Streak"
          : (wallet?.streak || 0) >= 4
          ? "⚡ Hot Streak"
          : (wallet?.streak || 0) >= 2
          ? "🚀 Building Momentum"
          : "🎯 Start Your Streak"}
      </p>

    </div>

    {/* RIGHT SIDE ICON */}
    <motion.div
      animate={{ scale: [1, 1.15, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="text-8xl"
    >
      🔥
    </motion.div>

  </div>


  {/* PROGRESS BAR */}
  <div className="mt-6">

    <div className="flex justify-between text-xs text-gray-400 mb-1">
      <span>Weekly Progress</span>
      <span>{wallet?.streak || 0}/7</span>
    </div>

    <div className="w-full bg-gaming-dark rounded-full h-3 overflow-hidden">

      <motion.div
        initial={{ width: 0 }}
        animate={{
          width: `${((wallet?.streak || 0) / 7) * 100}%`
        }}
        transition={{ duration: 1 }}
        className="h-3 rounded-full bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-300"
      />

    </div>

  </div>

</motion.div>
        </div>

        {/* Daily Reward */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-gaming p-6 mb-8 bg-gradient-to-r from-gaming-neon/10 to-gaming-gold/10"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                🎁 Daily Login Reward
              </h3>
              <p className="text-gray-400">
                Claim your daily coins and keep your streak going!
              </p>
            </div>
            <button
              onClick={handleClaimDaily}
              disabled={claiming}
              className="btn-gaming flex items-center space-x-2"
            >
              <FiClock className="w-4 h-4" />
              <span>{claiming ? "Claiming..." : "Claim Now"}</span>
            </button>
          </div>
        </motion.div> */}

        {/* Transactions */}
        <div className="card-gaming p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              Transaction History
            </h3>

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <FiFilter className="text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
              >
                <option value="all">All Transactions</option>
                <option value="earn">Earned</option>
                <option value="spend">Spent</option>
                <option value="bonus">Bonus</option>
                <option value="referral">Referral</option>
              </select>
            </div>
          </div>

          {/* Transaction List */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">No transactions yet</p>
              <p className="text-sm text-gray-500">
                Start earning coins by participating in tournaments!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction, index) => (
                <motion.div
                  key={transaction._id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-gaming-charcoal rounded-lg hover:bg-gaming-border transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gaming-dark rounded-lg">
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {transaction.description}
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(transaction.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-xl font-bold ${getTransactionColor(transaction.type)}`}
                  >
                    {transaction.amount > 0 ? "+" : ""}
                    {transaction.amount}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-6">
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

        {/* Referral Code Modal */}
        {showReferralModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-gaming p-8 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-white mb-6">
                🎁 Your Referral Code
              </h3>

              {/* Referral Code Display */}
              <div className="mb-6 p-4 bg-gaming-charcoal rounded-lg border-2 border-gaming-neon/40">
                <p className="text-gray-400 text-sm mb-2">Your Code:</p>
                <p className="text-2xl font-mono font-bold text-gaming-neon">
                  {referralCode}
                </p>
              </div>

              {/* Desktop: Copy Button */}
              <button
                onClick={handleCopyCode}
                className="hidden sm:flex w-full items-center justify-center space-x-2 px-4 py-3 mb-3 bg-gaming-gold/20 border-2 border-gaming-gold text-gaming-gold rounded-lg font-bold hover:bg-gaming-gold/30 transition-all duration-300"
              >
                {copiedCode ? (
                  <>
                    <FiCheck className="w-5 h-5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <FiShare2 className="w-5 h-5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              {/* Mobile: Share Button */}
              <button
                onClick={handleShareCode}
                className="sm:hidden w-full flex items-center justify-center space-x-2 px-4 py-3 mb-3 bg-gaming-neon/20 border-2 border-gaming-neon text-gaming-neon rounded-lg font-bold hover:bg-gaming-neon/30 transition-all duration-300"
              >
                <FiShare2 className="w-5 h-5" />
                <span>Share Code</span>
              </button>

              {/* Close Button */}
              <button
                onClick={() => setShowReferralModal(false)}
                className="w-full px-4 py-2 bg-gaming-charcoal border border-gaming-border text-white rounded-lg font-bold hover:bg-gaming-border transition-all duration-300"
              >
                Close
              </button>

              {/* Info Text */}
              <p className="text-xs text-gray-400 text-center mt-4">
                Share this code with friends to earn rewards!
              </p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
