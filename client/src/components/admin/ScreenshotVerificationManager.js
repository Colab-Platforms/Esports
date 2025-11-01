import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { 
  FiImage, 
  FiCheck, 
  FiX, 
  FiEye, 
  FiFlag,
  FiClock,
  FiAlertTriangle
} from 'react-icons/fi';

const ScreenshotVerificationManager = () => {
  const { user } = useSelector(state => state.auth);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [filters, setFilters] = useState({
    status: 'pending',
    gameType: '',
    severity: ''
  });

  useEffect(() => {
    fetchVerifications();
  }, [filters]);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams(filters);
      const response = await api.get(`/security/screenshot-verifications?${queryParams}`);
      setVerifications(response.data.data.verifications);
    } catch (error) {
      console.error('Error fetching verifications:', error);
      setError('Failed to load screenshot verifications');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (verificationId, reviewData) => {
    try {
      const response = await api.post(`/security/screenshot-verifications/${verificationId}/review`, reviewData);
      
      // Update the verification in the list
      setVerifications(prev => 
        prev.map(verification => 
          verification._id === verificationId 
            ? { ...verification, ...response.data.data.verification }
            : verification
        )
      );

      setReviewModal(false);
      setSelectedVerification(null);
    } catch (error) {
      console.error('Error reviewing screenshot:', error);
      alert('Failed to review screenshot');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-600 text-yellow-100';
      case 'verified': return 'bg-green-600 text-green-100';
      case 'rejected': return 'bg-red-600 text-red-100';
      case 'needs_review': return 'bg-blue-600 text-blue-100';
      case 'suspicious': return 'bg-orange-600 text-orange-100';
      default: return 'bg-gray-600 text-gray-100';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  if (loading && verifications.length === 0) {
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
          <h1 className="text-2xl font-bold text-white">Screenshot Verification</h1>
          <p className="text-gray-400">Review and verify match result screenshots</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="needs_review">Needs Review</option>
            <option value="suspicious">Suspicious</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filters.gameType}
            onChange={(e) => setFilters(prev => ({ ...prev, gameType: e.target.value }))}
            className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2"
          >
            <option value="">All Games</option>
            <option value="bgmi">BGMI</option>
            <option value="valorant">Valorant</option>
            <option value="cs2">CS2</option>
            <option value="freefire">Free Fire</option>
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
          </select>
        </div>
      </div>

      {/* Verifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {verifications.map((verification) => (
          <div key={verification._id} className="bg-gray-800 rounded-lg overflow-hidden">
            {/* Screenshot */}
            <div className="relative h-48 bg-gray-700">
              {verification.screenshotUrl ? (
                <img
                  src={verification.screenshotUrl}
                  alt="Match Screenshot"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className="hidden w-full h-full flex items-center justify-center">
                <FiImage className="w-12 h-12 text-gray-500" />
              </div>
              
              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(verification.verificationStatus)}`}>
                  {verification.verificationStatus.replace('_', ' ')}
                </span>
              </div>

              {/* Flags */}
              {verification.flags && verification.flags.length > 0 && (
                <div className="absolute top-2 left-2">
                  <FiFlag className="w-5 h-5 text-red-400" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              {/* User and Game Info */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-white font-medium">
                    {verification.userId?.username || 'Unknown User'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {verification.gameType?.toUpperCase()} • {verification.tournamentId?.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">
                    {new Date(verification.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Claimed Stats */}
              <div className="bg-gray-700 rounded p-3 mb-3">
                <h4 className="text-white text-sm font-medium mb-2">Claimed Stats</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Kills:</span>
                    <span className="text-white ml-1">{verification.claimedStats.kills}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Deaths:</span>
                    <span className="text-white ml-1">{verification.claimedStats.deaths}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Assists:</span>
                    <span className="text-white ml-1">{verification.claimedStats.assists || 0}</span>
                  </div>
                  {verification.claimedStats.finalPosition && (
                    <div>
                      <span className="text-gray-400">Position:</span>
                      <span className="text-white ml-1">#{verification.claimedStats.finalPosition}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Flags */}
              {verification.flags && verification.flags.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-white text-sm font-medium mb-2">Issues Detected</h4>
                  <div className="space-y-1">
                    {verification.flags.slice(0, 2).map((flag, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <FiAlertTriangle className={`w-3 h-3 ${getSeverityColor(flag.severity)}`} />
                        <span className="text-gray-300 text-xs">{flag.description}</span>
                      </div>
                    ))}
                    {verification.flags.length > 2 && (
                      <p className="text-gray-400 text-xs">+{verification.flags.length - 2} more issues</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedVerification(verification);
                    setReviewModal(true);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm flex items-center justify-center space-x-1"
                >
                  <FiEye className="w-4 h-4" />
                  <span>Review</span>
                </button>
                
                {verification.verificationStatus === 'pending' && (
                  <>
                    <button
                      onClick={() => handleReview(verification._id, { 
                        score: 85, 
                        notes: 'Quick approval - looks valid' 
                      })}
                      className="bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm"
                      title="Quick Approve"
                    >
                      <FiCheck className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleReview(verification._id, { 
                        score: 30, 
                        notes: 'Quick rejection - suspicious',
                        rejectionReason: 'Suspicious screenshot' 
                      })}
                      className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm"
                      title="Quick Reject"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Review Modal */}
      {reviewModal && selectedVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Review Screenshot</h2>
                <button
                  onClick={() => setReviewModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Screenshot */}
                <div>
                  <h3 className="text-white font-medium mb-2">Screenshot</h3>
                  <div className="bg-gray-700 rounded-lg overflow-hidden">
                    {selectedVerification.screenshotUrl ? (
                      <img
                        src={selectedVerification.screenshotUrl}
                        alt="Match Screenshot"
                        className="w-full h-auto"
                      />
                    ) : (
                      <div className="h-64 flex items-center justify-center">
                        <FiImage className="w-12 h-12 text-gray-500" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-2">Match Information</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-400">Player:</span>
                        <span className="text-white ml-2">{selectedVerification.userId?.username}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Game:</span>
                        <span className="text-white ml-2">{selectedVerification.gameType?.toUpperCase()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Tournament:</span>
                        <span className="text-white ml-2">{selectedVerification.tournamentId?.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Submitted:</span>
                        <span className="text-white ml-2">
                          {new Date(selectedVerification.submittedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Claimed Stats */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-2">Claimed Statistics</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-400">Kills:</span>
                        <span className="text-white ml-2 font-medium">{selectedVerification.claimedStats.kills}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Deaths:</span>
                        <span className="text-white ml-2 font-medium">{selectedVerification.claimedStats.deaths}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Assists:</span>
                        <span className="text-white ml-2 font-medium">{selectedVerification.claimedStats.assists || 0}</span>
                      </div>
                      {selectedVerification.claimedStats.finalPosition && (
                        <div>
                          <span className="text-gray-400">Final Position:</span>
                          <span className="text-white ml-2 font-medium">#{selectedVerification.claimedStats.finalPosition}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">K/D Ratio:</span>
                        <span className="text-white ml-2 font-medium">
                          {selectedVerification.claimedStats.deaths > 0 
                            ? (selectedVerification.claimedStats.kills / selectedVerification.claimedStats.deaths).toFixed(2)
                            : selectedVerification.claimedStats.kills
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Flags */}
                  {selectedVerification.flags && selectedVerification.flags.length > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-white font-medium mb-2">Detected Issues</h3>
                      <div className="space-y-2">
                        {selectedVerification.flags.map((flag, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <FiAlertTriangle className={`w-4 h-4 mt-0.5 ${getSeverityColor(flag.severity)}`} />
                            <div>
                              <p className="text-white text-sm font-medium">{flag.type.replace('_', ' ')}</p>
                              <p className="text-gray-300 text-xs">{flag.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review Form */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Review Decision</h3>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const reviewData = {
                          score: parseInt(formData.get('score')),
                          notes: formData.get('notes'),
                          rejectionReason: formData.get('rejectionReason')
                        };
                        handleReview(selectedVerification._id, reviewData);
                      }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">
                          Verification Score (0-100)
                        </label>
                        <input
                          type="number"
                          name="score"
                          min="0"
                          max="100"
                          defaultValue="50"
                          className="w-full bg-gray-600 text-white border border-gray-500 rounded px-3 py-2"
                          required
                        />
                        <p className="text-gray-400 text-xs mt-1">
                          80+ = Verified, 50-79 = Needs Review, &lt;50 = Rejected
                        </p>
                      </div>

                      <div>
                        <label className="block text-gray-300 text-sm mb-1">
                          Review Notes
                        </label>
                        <textarea
                          name="notes"
                          rows="3"
                          className="w-full bg-gray-600 text-white border border-gray-500 rounded px-3 py-2"
                          placeholder="Enter your review notes..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-300 text-sm mb-1">
                          Rejection Reason (if score &lt; 50)
                        </label>
                        <input
                          type="text"
                          name="rejectionReason"
                          className="w-full bg-gray-600 text-white border border-gray-500 rounded px-3 py-2"
                          placeholder="Reason for rejection..."
                        />
                      </div>

                      <div className="flex space-x-3">
                        <button
                          type="submit"
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
                        >
                          Submit Review
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewModal(false)}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && verifications.length === 0 && (
        <div className="text-center py-12">
          <FiImage className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Screenshots to Review</h3>
          <p className="text-gray-400">All screenshot verifications are up to date.</p>
        </div>
      )}
    </div>
  );
};

export default ScreenshotVerificationManager;