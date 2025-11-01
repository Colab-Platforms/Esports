import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  FiCreditCard, 
  FiDollarSign, 
  FiArrowUpRight, 
  FiArrowDownLeft, 
  FiPlus,
  FiMinus,
  FiRefreshCw,
  FiEye,
  FiEyeOff
} from 'react-icons/fi';
import { 
  fetchWalletDetails, 
  fetchTransactionHistory,
  clearWalletError 
} from '../store/slices/walletSlice';
import DepositModal from '../components/wallet/DepositModal';
import WithdrawModal from '../components/wallet/WithdrawModal';
import TransactionHistory from '../components/wallet/TransactionHistory';
import OptimizedImage from '../components/common/OptimizedImage';

const WalletPage = () => {
  const dispatch = useDispatch();
  const { 
    wallet, 
    stats, 
    transactions, 
    transactionsPagination,
    loading, 
    error 
  } = useSelector((state) => state.wallet);
  const { user } = useSelector((state) => state.auth);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    dispatch(fetchWalletDetails());
    dispatch(fetchTransactionHistory({ page: 1, limit: 10 }));
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchWalletDetails());
    dispatch(fetchTransactionHistory({ page: 1, limit: 10 }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
      case 'prize_win':
      case 'bonus':
      case 'refund':
        return <FiArrowDownLeft className="h-4 w-4 text-green-400" />;
      case 'withdrawal':
      case 'tournament_fee':
        return <FiArrowUpRight className="h-4 w-4 text-red-400" />;
      default:
        return <FiDollarSign className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'deposit':
      case 'prize_win':
      case 'bonus':
      case 'refund':
        return 'text-green-400';
      case 'withdrawal':
      case 'tournament_fee':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading.wallet) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Wallet Hero Section */}
      <div className="relative h-64 overflow-hidden">
        <OptimizedImage
          src="https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=400&fit=crop&crop=center"
          alt="Wallet Background"
          className="w-full h-full"
          fallbackSrc="https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1920&h=400&fit=crop&crop=center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/80" />
        
        <div className="absolute inset-0 flex items-center">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-gaming font-bold text-white mb-2">My Wallet</h1>
                <p className="text-gray-300 text-lg">Manage your gaming funds and transactions</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleRefresh}
                  className="flex items-center space-x-2 px-4 py-2 bg-gaming-accent/20 text-gaming-accent rounded-lg hover:bg-gaming-accent/30 transition-colors backdrop-blur-sm"
                  disabled={loading.wallet}
                >
                  <FiRefreshCw className={`h-4 w-4 ${loading.wallet ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                
                <div className="text-right">
                  <div className="text-gaming-gold text-sm font-medium">Total Balance</div>
                  <div className="text-white text-2xl font-bold">
                    {showBalance ? formatCurrency(wallet?.balance || 0) : '••••••'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">

        {/* Error Display */}
        {error.wallet && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error.wallet}</p>
            <button
              onClick={() => dispatch(clearWalletError('wallet'))}
              className="text-red-300 hover:text-red-200 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-r from-gaming-primary to-gaming-secondary rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <FiCreditCard className="h-6 w-6 text-white" />
              <h2 className="text-xl font-semibold text-white">Wallet Balance</h2>
            </div>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="text-white/70 hover:text-white transition-colors"
            >
              {showBalance ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
            </button>
          </div>
          
          <div className="mb-6">
            <div className="text-4xl font-bold text-white mb-2">
              {showBalance ? formatCurrency(wallet?.balance || 0) : '••••••'}
            </div>
            <p className="text-white/70">Available Balance</p>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setShowDepositModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <FiPlus className="h-4 w-4" />
              <span>Add Money</span>
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <FiMinus className="h-4 w-4" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gaming-card rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-3">
                <FiArrowDownLeft className="h-5 w-5 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Total Earnings</h3>
              </div>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(stats.totalEarnings || 0)}
              </p>
            </div>

            <div className="bg-gaming-card rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-3">
                <FiArrowUpRight className="h-5 w-5 text-red-400" />
                <h3 className="text-lg font-semibold text-white">Total Spent</h3>
              </div>
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(stats.totalSpent || 0)}
              </p>
            </div>

            <div className="bg-gaming-card rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-3">
                <FiDollarSign className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Total Withdrawn</h3>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(stats.totalWithdrawn || 0)}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-gaming-card rounded-lg p-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-gaming-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'transactions'
                ? 'bg-gaming-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Transactions
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="bg-gaming-card rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Recent Transactions</h3>
            {transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction._id} className="flex items-center justify-between p-4 bg-gaming-dark/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getTransactionIcon(transaction.type)}
                      <div>
                        <p className="text-white font-medium">{transaction.description}</p>
                        <p className="text-gray-400 text-sm">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                        {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                      </p>
                      <p className="text-gray-400 text-sm capitalize">{transaction.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FiDollarSign className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No transactions yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionHistory />
        )}

        {/* Modals */}
        {showDepositModal && (
          <DepositModal
            isOpen={showDepositModal}
            onClose={() => setShowDepositModal(false)}
          />
        )}

        {showWithdrawModal && (
          <WithdrawModal
            isOpen={showWithdrawModal}
            onClose={() => setShowWithdrawModal(false)}
            currentBalance={wallet?.balance || 0}
          />
        )}
      </div>
    </div>
  );
};

export default WalletPage;