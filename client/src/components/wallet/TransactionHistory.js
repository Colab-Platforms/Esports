import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  FiArrowUpRight, 
  FiArrowDownLeft, 
  FiDollarSign, 
  FiFilter,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import { fetchTransactionHistory } from '../../store/slices/walletSlice';

const TransactionHistory = () => {
  const dispatch = useDispatch();
  const { 
    transactions, 
    transactionsPagination, 
    loading, 
    error 
  } = useSelector((state) => state.wallet);

  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const transactionTypes = [
    { value: 'all', label: 'All Transactions' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'withdrawal', label: 'Withdrawals' },
    { value: 'tournament_fee', label: 'Tournament Fees' },
    { value: 'prize_win', label: 'Prize Winnings' },
    { value: 'refund', label: 'Refunds' },
    { value: 'bonus', label: 'Bonuses' }
  ];

  useEffect(() => {
    const params = {
      page: currentPage,
      limit: 20
    };
    
    if (filterType !== 'all') {
      params.type = filterType;
    }

    dispatch(fetchTransactionHistory(params));
  }, [dispatch, currentPage, filterType]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleFilterChange = (type) => {
    setFilterType(type);
    setCurrentPage(1); // Reset to first page when filter changes
    setShowFilters(false);
  };

  const getTransactionIcon = (type) => {
    const iconConfig = {
      deposit: {
        icon: <FiArrowDownLeft className="h-5 w-5 text-white" />,
        bg: 'bg-gradient-to-br from-green-500 to-emerald-600',
        emoji: '💰'
      },
      withdrawal: {
        icon: <FiArrowUpRight className="h-5 w-5 text-white" />,
        bg: 'bg-gradient-to-br from-red-500 to-pink-600',
        emoji: '💸'
      },
      tournament_fee: {
        icon: <FiArrowUpRight className="h-5 w-5 text-white" />,
        bg: 'bg-gradient-to-br from-blue-500 to-purple-600',
        emoji: '🎮'
      },
      prize_win: {
        icon: <FiArrowDownLeft className="h-5 w-5 text-white" />,
        bg: 'bg-gradient-to-br from-yellow-500 to-orange-600',
        emoji: '🏆'
      },
      bonus: {
        icon: <FiArrowDownLeft className="h-5 w-5 text-white" />,
        bg: 'bg-gradient-to-br from-purple-500 to-indigo-600',
        emoji: '🎁'
      },
      refund: {
        icon: <FiArrowDownLeft className="h-5 w-5 text-white" />,
        bg: 'bg-gradient-to-br from-gray-500 to-slate-600',
        emoji: '↩️'
      }
    };

    const config = iconConfig[type] || {
      icon: <FiDollarSign className="h-5 w-5 text-white" />,
      bg: 'bg-gradient-to-br from-gray-500 to-gray-600',
      emoji: '💳'
    };

    return (
      <div className={`w-12 h-12 rounded-full ${config.bg} flex items-center justify-center shadow-lg relative`}>
        {config.icon}
        <div className="absolute -bottom-1 -right-1 text-xs bg-gaming-dark rounded-full w-5 h-5 flex items-center justify-center">
          {config.emoji}
        </div>
      </div>
    );
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-400/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/20';
      case 'failed':
        return 'text-red-400 bg-red-400/20';
      case 'cancelled':
        return 'text-gray-400 bg-gray-400/20';
      default:
        return 'text-gray-400 bg-gray-400/20';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  const renderPagination = () => {
    if (!transactionsPagination || transactionsPagination.totalPages <= 1) {
      return null;
    }

    const { currentPage, totalPages } = transactionsPagination;
    const pages = [];
    
    // Show first page
    if (currentPage > 2) {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
    }
    
    // Show current page and neighbors
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
      pages.push(i);
    }
    
    // Show last page
    if (currentPage < totalPages - 1) {
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-center space-x-2 mt-6">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiChevronLeft className="h-4 w-4" />
        </button>
        
        {pages.map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && handlePageChange(page)}
            disabled={page === '...' || page === currentPage}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              page === currentPage
                ? 'bg-gaming-accent text-white'
                : page === '...'
                ? 'text-gray-500 cursor-default'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {page}
          </button>
        ))}
        
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-gaming-card rounded-lg p-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Transaction History</h3>
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <FiFilter className="h-4 w-4" />
            <span>{transactionTypes.find(t => t.value === filterType)?.label}</span>
          </button>
          
          {showFilters && (
            <div className="absolute right-0 top-full mt-2 bg-gaming-card border border-gray-600 rounded-lg shadow-xl z-10 min-w-48">
              {transactionTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleFilterChange(type.value)}
                  className={`w-full text-left px-4 py-2 hover:bg-gaming-dark transition-colors ${
                    filterType === type.value ? 'text-gaming-accent' : 'text-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error.transactions && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error.transactions}</p>
        </div>
      )}

      {/* Loading State */}
      {loading.transactions && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-400">Loading transactions...</p>
        </div>
      )}

      {/* Transactions List */}
      {!loading.transactions && transactions.length > 0 && (
        <div className="space-y-4">
          {transactions.map((transaction) => {
            const { date, time } = formatDate(transaction.createdAt);
            
            return (
              <div key={transaction._id} className="flex items-center justify-between p-4 bg-gaming-dark/50 rounded-lg hover:bg-gaming-dark/70 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{transaction.description}</p>
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-gray-400 text-sm">{date} at {time}</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </span>
                    </div>
                    {transaction.reference?.tournamentId && (
                      <p className="text-gray-500 text-xs mt-1">
                        Tournament: {transaction.reference.tournamentId.name || 'Tournament'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-lg ${getTransactionColor(transaction.type)}`}>
                    {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Balance: {formatCurrency(transaction.balanceAfter)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading.transactions && transactions.length === 0 && (
        <div className="text-center py-12">
          <FiDollarSign className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-400 mb-2">No Transactions Found</h4>
          <p className="text-gray-500">
            {filterType === 'all' 
              ? "You haven't made any transactions yet." 
              : `No ${transactionTypes.find(t => t.value === filterType)?.label.toLowerCase()} found.`
            }
          </p>
        </div>
      )}

      {/* Pagination */}
      {renderPagination()}
    </div>
  );
};

export default TransactionHistory;