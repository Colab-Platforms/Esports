import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiDownload, FiCheck, FiX, FiChevronDown } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ClaimsManager = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [failureReason, setFailureReason] = useState('');
  const [showFailModal, setShowFailModal] = useState(null);

  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    fetchClaims();
  }, [currentPage, statusFilter]);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/store/admin/claims', {
        params: {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          status: statusFilter
        }
      });

      if (response.success) {
        setClaims(response.data.claims);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
      toast.error('Failed to fetch claims');
    } finally {
      setLoading(false);
    }
  };

  const handleFulfill = async (claimId) => {
    try {
      const response = await api.put(`/api/store/admin/claims/${claimId}/fulfill`);
      if (response.success) {
        toast.success('✅ Claim marked as fulfilled');
        fetchClaims();
        setExpandedId(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to fulfill claim');
    }
  };

  const handleFail = async (claimId) => {
    if (!failureReason.trim()) {
      toast.error('Please enter a failure reason');
      return;
    }

    try {
      const response = await api.put(`/api/store/admin/claims/${claimId}/fail`, {
        reason: failureReason
      });
      if (response.success) {
        toast.success('❌ Claim marked as failed and coins refunded');
        fetchClaims();
        setShowFailModal(null);
        setFailureReason('');
        setExpandedId(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to fail claim');
    }
  };

  const exportToCSV = () => {
    const headers = ['Claim ID', 'Player ID', 'Item', 'Type', 'Coins', 'Time', 'Status'];
    const rows = claims.map(claim => [
      claim._id.slice(-8),
      claim.playerID,
      claim.itemName,
      claim.itemId?.category || 'N/A',
      claim.price,
      new Date(claim.createdAt).toLocaleString(),
      claim.claimStatus
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claims-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('📥 CSV exported successfully');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'fulfilled':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'fulfilled':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '•';
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg-primary py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-theme-text-primary mb-2">
              📋 Claims Manager
            </h1>
            <p className="text-theme-text-secondary">
              Track and manage UC claim fulfillment
            </p>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-theme-accent text-black rounded-lg font-semibold hover:bg-theme-accent/80 transition-colors"
          >
            <FiDownload className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-3 mb-8">
          {['all', 'pending', 'fulfilled', 'failed'].map(status => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors capitalize ${
                statusFilter === status
                  ? 'bg-theme-accent text-black'
                  : 'bg-theme-bg-card text-theme-text-secondary hover:text-theme-text-primary border border-theme-border'
              }`}
            >
              {status === 'all' ? 'All Claims' : status}
            </button>
          ))}
        </div>

        {/* Claims Table */}
        {loading ? (
          <div className="text-center py-12 text-theme-text-secondary">Loading claims...</div>
        ) : claims.length === 0 ? (
          <div className="text-center py-12 text-theme-text-secondary">
            No claims found
          </div>
        ) : (
          <div className="bg-theme-bg-card border border-theme-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-theme-border bg-theme-bg-hover">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-theme-text-primary">
                      Claim ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-theme-text-primary">
                      Player ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-theme-text-primary">
                      Item
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-theme-text-primary">
                      Coins
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-theme-text-primary">
                      Time
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-theme-text-primary">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-theme-text-primary">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim, index) => (
                    <React.Fragment key={claim._id}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-theme-border hover:bg-theme-bg-hover transition-colors cursor-pointer"
                        onClick={() => setExpandedId(expandedId === claim._id ? null : claim._id)}
                      >
                        <td className="px-6 py-4">
                          <code className="text-xs font-mono bg-theme-bg-hover px-2 py-1 rounded text-theme-accent">
                            {claim._id.slice(-8)}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-3 py-1 bg-theme-bg-hover rounded font-mono text-sm text-theme-text-primary">
                            {claim.playerID}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-theme-text-primary">
                          <span className="truncate max-w-xs">{claim.itemName}</span>
                        </td>
                        <td className="px-6 py-4 text-theme-accent font-semibold">
                          {claim.price} CC
                        </td>
                        <td className="px-6 py-4 text-sm text-theme-text-secondary">
                          {new Date(claim.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(claim.claimStatus)}`}>
                            {getStatusIcon(claim.claimStatus)} {claim.claimStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {claim.claimStatus === 'pending' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedId(expandedId === claim._id ? null : claim._id);
                              }}
                              className="text-theme-accent hover:text-theme-accent/80 transition-colors"
                            >
                              <FiChevronDown className="w-5 h-5" />
                            </button>
                          ) : (
                            <span className="text-theme-text-muted text-sm">Done</span>
                          )}
                        </td>
                      </motion.tr>

                      {/* Expanded Detail Panel */}
                      <AnimatePresence>
                        {expandedId === claim._id && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-theme-bg-hover border-b border-theme-border"
                          >
                            <td colSpan="7" className="px-6 py-6">
                              <div className="space-y-4">
                                {/* Detail Fields */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs text-theme-text-muted mb-1">Claim ID</p>
                                    <code className="text-sm font-mono text-theme-accent">{claim._id}</code>
                                  </div>
                                  <div>
                                    <p className="text-xs text-theme-text-muted mb-1">Player ID</p>
                                    <code className="text-sm font-mono text-theme-text-primary">{claim.playerID}</code>
                                  </div>
                                  <div>
                                    <p className="text-xs text-theme-text-muted mb-1">Item</p>
                                    <p className="text-sm text-theme-text-primary">{claim.itemName}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-theme-text-muted mb-1">Category</p>
                                    <p className="text-sm text-theme-text-primary capitalize">{claim.itemId?.category || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-theme-text-muted mb-1">Coins Deducted</p>
                                    <p className="text-sm font-semibold text-theme-accent">{claim.price} CC</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-theme-text-muted mb-1">Claimed At</p>
                                    <p className="text-sm text-theme-text-primary">{new Date(claim.createdAt).toLocaleString()}</p>
                                  </div>
                                  {claim.fulfilledAt && (
                                    <div>
                                      <p className="text-xs text-theme-text-muted mb-1">Fulfilled At</p>
                                      <p className="text-sm text-theme-text-primary">{new Date(claim.fulfilledAt).toLocaleString()}</p>
                                    </div>
                                  )}
                                  {claim.failureReason && (
                                    <div>
                                      <p className="text-xs text-theme-text-muted mb-1">Failure Reason</p>
                                      <p className="text-sm text-red-400">{claim.failureReason}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Action Buttons */}
                                {claim.claimStatus === 'pending' && (
                                  <div className="flex gap-3 pt-4 border-t border-theme-border">
                                    <button
                                      onClick={() => handleFulfill(claim._id)}
                                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/50 rounded-lg font-semibold hover:bg-green-500/30 transition-colors"
                                    >
                                      <FiCheck className="w-4 h-4" />
                                      Mark Fulfilled
                                    </button>
                                    <button
                                      onClick={() => setShowFailModal(claim._id)}
                                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg font-semibold hover:bg-red-500/30 transition-colors"
                                    >
                                      <FiX className="w-4 h-4" />
                                      Mark Failed
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>

                      {/* Fail Modal */}
                      <AnimatePresence>
                        {showFailModal === claim._id && (
                          <motion.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="bg-red-500/10 border-b border-red-500/30"
                          >
                            <td colSpan="7" className="px-6 py-4">
                              <div className="space-y-3">
                                <p className="text-sm text-theme-text-secondary">Enter failure reason:</p>
                                <input
                                  type="text"
                                  value={failureReason}
                                  onChange={(e) => setFailureReason(e.target.value)}
                                  placeholder="e.g., Invalid Player ID, Account not found"
                                  className="w-full px-4 py-2 bg-theme-bg-hover border border-theme-border rounded-lg text-theme-text-primary placeholder-theme-text-muted focus:outline-none focus:border-red-500"
                                  autoFocus
                                />
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => {
                                      setShowFailModal(null);
                                      setFailureReason('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-theme-bg-hover text-theme-text-primary rounded-lg font-semibold hover:bg-theme-border transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleFail(claim._id)}
                                    className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg font-semibold hover:bg-red-500/30 transition-colors"
                                  >
                                    Confirm Failure
                                  </button>
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-theme-border bg-theme-bg-hover">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-3 py-2 text-theme-text-secondary hover:text-theme-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FiChevronLeft className="w-4 h-4" />
                Prev
              </button>

              <div className="flex gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
                      currentPage === page
                        ? 'bg-theme-accent text-black'
                        : 'text-theme-text-secondary hover:text-theme-text-primary'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-3 py-2 text-theme-text-secondary hover:text-theme-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimsManager;
