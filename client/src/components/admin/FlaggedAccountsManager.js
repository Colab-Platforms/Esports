import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { 
  FiFlag, 
  FiUser, 
  FiCalendar, 
  FiAlertTriangle, 
  FiCheck, 
  FiX, 
  FiEye,
  FiFilter,
  FiSearch
} from 'react-icons/fi';

const FlaggedAccountsManager = () => {
  const { user } = useSelector(state => state.auth);
  const [flaggedAccounts, setFlaggedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    flagReason: '',
    isResolved: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchFlaggedAccounts();
  }, [filters, pagination.page]);

  const fetchFlaggedAccounts = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });

      const response = await api.get(`/security/flagged-accounts?${queryParams}`);
      setFlaggedAccounts(response.data.data.flaggedAccounts);
      setPagination(prev => ({
        ...prev,
        ...response.data.data.pagination
      }));
    } catch (error) {
      console.error('Error fetching flagged accounts:', error);
      setError('Failed to load flagged accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAccount = async (accountId, action, notes) => {
    try {
      const response = await api.post(`/security/flagged-accounts/${accountId}/review`, {
        action,
        notes
      });

      // Update the account in the list
      setFlaggedAccounts(prev => 
        prev.map(account => 
          account._id === accountId 
            ? { ...account, ...response.data.data.flaggedAccount }
            : account
        )
      );

      setReviewModal(false);
      setSelectedAccount(null);
    } catch (error) {
      console.error('Error reviewing account:', error);
      alert('Failed to review account');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-red-100';
      case 'high': return 'bg-orange-600 text-orange-100';
      case 'medium': return 'bg-yellow-600 text-yellow-100';
      case 'low': return 'bg-green-600 text-green-100';
      default: return 'bg-gray-600 text-gray-100';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-600 text-yellow-100';
      case 'under_review': return 'bg-blue-600 text-blue-100';
      case 'verified': return 'bg-red-600 text-red-100';
      case 'dismissed': return 'bg-gray-600 text-gray-100';
      case 'resolved': return 'bg-green-600 text-green-100';
      default: return 'bg-gray-600 text-gray-100';
    }
  };

  if (loading && flaggedAccounts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Flagged Accounts</h1>
          <p className="text-gray-400">Review and manage flagged user accounts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="verified">Verified</option>
            <option value="dismissed">Dismissed</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            value={filters.severity}
            onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
            className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={filters.flagReason}
            onChange={(e) => setFilters(prev => ({ ...prev, flagReason: e.target.value }))}
            className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2"
          >
            <option value="">All Reasons</option>
            <option value="suspicious_performance">Suspicious Performance</option>
            <option value="duplicate_account">Duplicate Account</option>
            <option value="cheating_suspected">Cheating Suspected</option>
            <option value="multiple_ip_addresses">Multiple IP Addresses</option>
            <option value="unusual_activity_pattern">Unusual Activity</option>
          </select>

          <select
            value={filters.isResolved}
            onChange={(e) => setFilters(prev => ({ ...prev, isResolved: e.target.value }))}
            className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2"
          >
            <option value="">All</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
        </div>
      </div>

      {/* Flagged Accounts List */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Flagged Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {flaggedAccounts.map((account) => (
                <tr key={account._id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center">
                          <FiUser className="w-5 h-5 text-gray-300" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-white">
                          {account.userId?.username || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-400">
                          {account.userId?.email || 'No email'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-300 capitalize">
                      {account.flagReason.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(account.severity)}`}>
                      {account.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(account.status)}`}>
                      {account.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(account.flaggedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAccount(account);
                          setReviewModal(true);
                        }}
                        className="text-blue-400 hover:text-blue-300"
                        title="Review Account"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                      
                      {!account.isResolved && (
                        <>
                          <button
                            onClick={() => handleReviewAccount(account._id, 'dismissed', 'Account reviewed and dismissed')}
                            className="text-green-400 hover:text-green-300"
                            title="Dismiss Flag"
                          >
                            <FiCheck className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleReviewAccount(account._id, 'temporary_ban', 'Temporary ban issued')}
                            className="text-red-400 hover:text-red-300"
                            title="Temporary Ban"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-300">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 bg-gray-600 text-white rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
              disabled={pagination.page === pagination.pages}
              className="px-3 py-1 bg-gray-600 text-white rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {reviewModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Review Flagged Account</h2>
              <button
                onClick={() => setReviewModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Account Info */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-2">Account Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Username:</span>
                    <span className="text-white ml-2">{selectedAccount.userId?.username}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Email:</span>
                    <span className="text-white ml-2">{selectedAccount.userId?.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Flag Reason:</span>
                    <span className="text-white ml-2 capitalize">{selectedAccount.flagReason.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Severity:</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded ${getSeverityColor(selectedAccount.severity)}`}>
                      {selectedAccount.severity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                <p className="text-gray-300">{selectedAccount.description}</p>
              </div>

              {/* Evidence */}
              {selectedAccount.evidence && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Evidence</h3>
                  <pre className="text-gray-300 text-sm bg-gray-800 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedAccount.evidence, null, 2)}
                  </pre>
                </div>
              )}

              {/* Review History */}
              {selectedAccount.reviewHistory && selectedAccount.reviewHistory.length > 0 && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Review History</h3>
                  <div className="space-y-2">
                    {selectedAccount.reviewHistory.map((review, index) => (
                      <div key={index} className="bg-gray-800 p-3 rounded">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{review.action}</span>
                          <span className="text-gray-400 text-sm">
                            {new Date(review.reviewedAt).toLocaleString()}
                          </span>
                        </div>
                        {review.notes && (
                          <p className="text-gray-300 text-sm mt-1">{review.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!selectedAccount.isResolved && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      const notes = prompt('Enter review notes:');
                      if (notes) {
                        handleReviewAccount(selectedAccount._id, 'dismissed', notes);
                      }
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                  >
                    Dismiss Flag
                  </button>
                  
                  <button
                    onClick={() => {
                      const notes = prompt('Enter ban reason:');
                      if (notes) {
                        handleReviewAccount(selectedAccount._id, 'temporary_ban', notes);
                      }
                    }}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg"
                  >
                    Temporary Ban
                  </button>
                  
                  <button
                    onClick={() => {
                      const notes = prompt('Enter permanent ban reason:');
                      if (notes && confirm('Are you sure you want to permanently ban this user?')) {
                        handleReviewAccount(selectedAccount._id, 'permanent_ban', notes);
                      }
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg"
                  >
                    Permanent Ban
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlaggedAccountsManager;