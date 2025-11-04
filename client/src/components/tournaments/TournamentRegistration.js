import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { joinTournament } from '../../store/slices/tournamentSlice';
import { selectAuth } from '../../store/slices/authSlice';
import { checkBalance, fetchWalletDetails } from '../../store/slices/walletSlice';
import notificationService from '../../services/notificationService';
import SteamConnectionWidget from '../steam/SteamConnectionWidget';

const TournamentRegistration = ({ tournament, onClose, onSuccess }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(selectAuth);
  const { wallet, balanceCheck, loading } = useSelector((state) => state.wallet);
  
  const [formData, setFormData] = useState({
    gameId: '',
    teamName: '',
    playerName: user?.username || '',
    contactNumber: user?.phone || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);
  const [steamConnected, setSteamConnected] = useState(false);

  useEffect(() => {
    // Fetch wallet details when component mounts
    dispatch(fetchWalletDetails());
    // Check balance for tournament entry fee
    dispatch(checkBalance(tournament.entryFee));
  }, [dispatch, tournament.entryFee]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.gameId.trim()) {
      setError('Game ID is required');
      return false;
    }

    if (tournament.mode !== 'solo' && !formData.teamName.trim()) {
      setError('Team name is required for team tournaments');
      return false;
    }

    // Game-specific validations
    if (tournament.gameType === 'bgmi') {
      if (!/^[0-9]{9,10}$/.test(formData.gameId)) {
        setError('BGMI ID should be 9-10 digits');
        return false;
      }
    } else if (tournament.gameType === 'valorant') {
      if (!/^.+#[0-9]{3,5}$/.test(formData.gameId)) {
        setError('Valorant ID should be in format: Username#1234');
        return false;
      }
    } else if (tournament.gameType === 'cs2') {
      if (!user?.gameIds?.steam && !steamConnected) {
        setError('Please connect your Steam account to join CS2 tournaments');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    // Check wallet balance before proceeding
    if (!balanceCheck?.hasSufficientBalance) {
      setShowInsufficientBalance(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const registrationData = {
        gameId: tournament.gameType === 'cs2' ? user.gameIds.steam : formData.gameId,
        teamName: tournament.mode === 'solo' ? '' : formData.teamName,
        playerName: formData.playerName,
        contactNumber: formData.contactNumber
      };

      // Call API directly
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tournaments/${tournament._id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(registrationData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Registration failed');
      }
      
      // Success - refresh wallet and redirect to tournament details
      dispatch(fetchWalletDetails());
      
      // Show success notification
      notificationService.showRegistrationSuccess(tournament.name);
      
      onSuccess && onSuccess();
      navigate(`/tournaments/${tournament._id}`);
      
    } catch (error) {
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMoney = () => {
    onClose();
    navigate('/wallet');
  };

  const getGameIdPlaceholder = () => {
    switch (tournament.gameType) {
      case 'bgmi':
        return 'Enter your BGMI ID (e.g., 123456789)';
      case 'valorant':
        return 'Enter your Valorant ID (e.g., PlayerName#1234)';
      case 'cs2':
        return user?.gameIds?.steam || 'Steam ID required';
      default:
        return 'Enter your Game ID';
    }
  };

  const getGameIcon = () => {
    switch (tournament.gameType) {
      case 'bgmi':
        return '🎮';
      case 'valorant':
        return '🎯';
      case 'cs2':
        return '⚡';
      default:
        return '🎮';
    }
  };

  const getModeIcon = () => {
    switch (tournament.mode) {
      case 'solo':
        return '👤';
      case 'duo':
        return '👥';
      case 'squad':
      case 'team':
        return '👨‍👩‍👧‍👦';
      default:
        return '🎮';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gaming-charcoal rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Tournament Registration</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tournament Info */}
        <div className="bg-gaming-dark rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">{getGameIcon()}</span>
            <div>
              <h4 className="text-white font-bold">{tournament.name}</h4>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <span>{getModeIcon()} {tournament.mode.toUpperCase()}</span>
                <span>•</span>
                <span>₹{tournament.entryFee} Entry</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Prize Pool</div>
              <div className="text-gaming-neon font-bold">₹{tournament.prizePool?.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-400">Players</div>
              <div className="text-white font-bold">
                {tournament.currentParticipants}/{tournament.maxParticipants}
              </div>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Game ID */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {tournament.gameType.toUpperCase()} ID *
            </label>
            {tournament.gameType === 'cs2' ? (
              <SteamConnectionWidget 
                compact={true}
                actionText="join CS2 tournaments"
                onConnectionSuccess={(steamData) => {
                  setSteamConnected(true);
                  setError(''); // Clear any previous errors
                }}
              />
            ) : (
              <input
                type="text"
                name="gameId"
                value={formData.gameId}
                onChange={handleInputChange}
                placeholder={getGameIdPlaceholder()}
                className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                required
              />
            )}
          </div>

          {/* Team Name (if not solo) */}
          {tournament.mode !== 'solo' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Team Name *
              </label>
              <input
                type="text"
                name="teamName"
                value={formData.teamName}
                onChange={handleInputChange}
                placeholder="Enter your team name"
                className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                required
              />
            </div>
          )}

          {/* Player Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Player Name *
            </label>
            <input
              type="text"
              name="playerName"
              value={formData.playerName}
              onChange={handleInputChange}
              placeholder="Enter your display name"
              className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
              required
            />
          </div>

          {/* Contact Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contact Number *
            </label>
            <input
              type="tel"
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleInputChange}
              placeholder="Enter your phone number"
              className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
              required
            />
          </div>

          {/* Wallet Balance & Entry Fee */}
          <div className="space-y-3">
            <div className="bg-gaming-dark/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Wallet Balance:</span>
                <span className="text-white font-medium">
                  ₹{wallet?.balance?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Entry Fee:</span>
                <span className="text-gaming-neon font-medium">
                  ₹{tournament.entryFee}
                </span>
              </div>
            </div>

            {balanceCheck && !balanceCheck.hasSufficientBalance && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-red-400">⚠️</span>
                  <div className="text-red-400 text-sm font-medium">
                    Insufficient Balance
                  </div>
                </div>
                <div className="text-gray-300 text-xs mb-3">
                  You need ₹{tournament.entryFee - (wallet?.balance || 0)} more to register for this tournament.
                </div>
                <button
                  type="button"
                  onClick={handleAddMoney}
                  className="w-full px-3 py-2 bg-gaming-neon text-black text-sm font-medium rounded-lg hover:bg-gaming-neon/90 transition-colors"
                >
                  Add Money to Wallet
                </button>
              </div>
            )}

            {balanceCheck?.hasSufficientBalance && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">✅</span>
                  <div>
                    <div className="text-green-400 text-sm font-medium">
                      Sufficient Balance Available
                    </div>
                    <div className="text-gray-300 text-xs">
                      ₹{tournament.entryFee} will be deducted from your wallet
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Game-specific Instructions */}
          {tournament.gameType === 'bgmi' && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="text-blue-400 text-sm font-medium mb-1">BGMI Instructions:</div>
              <div className="text-gray-300 text-xs space-y-1">
                <div>• Room ID and password will be shared 30 minutes before match</div>
                <div>• Join the custom room on time</div>
                <div>• Screenshots required for result verification</div>
              </div>
            </div>
          )}

          {tournament.gameType === 'cs2' && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="text-blue-400 text-sm font-medium mb-1">CS2 Instructions:</div>
              <div className="text-gray-300 text-xs space-y-1">
                <div>• Server details will be provided before match</div>
                <div>• Connect via Steam using provided command</div>
                <div>• Server-side result tracking enabled</div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="text-red-400 text-sm">{error}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !balanceCheck?.hasSufficientBalance || loading.balanceCheck}
              className="flex-1 btn-gaming disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Registering...</span>
                </div>
              ) : loading.balanceCheck ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Checking Balance...</span>
                </div>
              ) : !balanceCheck?.hasSufficientBalance ? (
                'Insufficient Balance'
              ) : (
                `Register - ₹${tournament.entryFee}`
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default TournamentRegistration;