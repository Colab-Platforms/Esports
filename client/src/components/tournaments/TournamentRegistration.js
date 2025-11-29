import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { joinTournament } from '../../store/slices/tournamentSlice';
import { selectAuth } from '../../store/slices/authSlice';
import notificationService from '../../services/notificationService';
import SteamConnectionWidget from '../steam/SteamConnectionWidget';
import SteamLinkingModal from './SteamLinkingModal';
import { getSteamAuthUrl } from '../../utils/apiConfig';

const TournamentRegistration = ({ tournament, onClose, onSuccess }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(selectAuth);
  
  const [formData, setFormData] = useState({
    // Leader details
    leaderName: user?.username || '',
    leaderEmail: user?.email || '',
    leaderPhone: user?.phone || '',
    leaderIgn: '',
    leaderUid: '',
    teamName: '',
    // Team members
    teamMembers: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [steamConnected, setSteamConnected] = useState(false);
  const [showSteamModal, setShowSteamModal] = useState(false);
  
  // Get max team size based on mode
  const getMaxTeamSize = () => {
    switch (tournament.mode) {
      case 'solo': return 1;
      case 'duo': return 2;
      case 'squad': return tournament.gameType === 'bgmi' ? 4 : 5;
      case 'team': return 5;
      default: return 4;
    }
  };
  
  const maxTeamSize = getMaxTeamSize();

  const openSteamForConnection = () => {
    setShowSteamModal(true);
  };

  const handleSteamLink = () => {
    const userId = user?.id || user?._id;
    const tournamentId = tournament?._id || tournament?.id;
    
    if (!userId) {
      setError('Please login again to continue');
      return;
    }

    if (!tournamentId) {
      setError('Tournament ID not found. Please try again.');
      console.error('Tournament ID missing:', tournament);
      return;
    }

    console.log('🎮 Redirecting to Steam auth for tournament:', tournamentId);
    setShowSteamModal(false);
    
    // Direct redirect to Steam OAuth - uses dynamic URL
    window.location.href = getSteamAuthUrl(userId, `/tournaments/${tournamentId}`);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleTeamMemberChange = (index, field, value) => {
    setFormData(prev => {
      const newTeamMembers = [...prev.teamMembers];
      newTeamMembers[index] = {
        ...newTeamMembers[index],
        [field]: value
      };
      return {
        ...prev,
        teamMembers: newTeamMembers
      };
    });
  };
  
  const addTeamMember = () => {
    if (formData.teamMembers.length < maxTeamSize - 1) { // -1 because leader is included
      setFormData(prev => ({
        ...prev,
        teamMembers: [...prev.teamMembers, { ign: '', uid: '' }]
      }));
    }
  };
  
  const removeTeamMember = (index) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    // For BGMI squad/team tournaments
    if (tournament.gameType === 'bgmi' && tournament.mode !== 'solo') {
      // Leader details validation
      if (!formData.leaderName.trim()) {
        setError('Leader name is required');
        return false;
      }
      if (!formData.leaderEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.leaderEmail)) {
        setError('Valid leader email is required');
        return false;
      }
      if (!formData.leaderPhone.trim() || !/^[0-9]{10}$/.test(formData.leaderPhone)) {
        setError('Valid 10-digit phone number is required');
        return false;
      }
      if (!formData.leaderIgn.trim()) {
        setError('Leader IGN (In-Game Name) is required');
        return false;
      }
      if (!formData.leaderUid.trim() || !/^[0-9]{9,10}$/.test(formData.leaderUid)) {
        setError('Leader BGMI UID should be 9-10 digits');
        return false;
      }
      if (!formData.teamName.trim()) {
        setError('Team name is required');
        return false;
      }
      
      // Team members validation
      const minMembers = tournament.mode === 'duo' ? 1 : tournament.mode === 'squad' ? 3 : 0;
      if (formData.teamMembers.length < minMembers) {
        setError(`At least ${minMembers + 1} players required (including leader)`);
        return false;
      }
      
      // Validate each team member
      for (let i = 0; i < formData.teamMembers.length; i++) {
        const member = formData.teamMembers[i];
        if (!member.ign || !member.ign.trim()) {
          setError(`Player ${i + 2} IGN is required`);
          return false;
        }
        if (!member.uid || !/^[0-9]{9,10}$/.test(member.uid)) {
          setError(`Player ${i + 2} UID should be 9-10 digits`);
          return false;
        }
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

    // Free tournaments - no balance check needed

    setIsSubmitting(true);

    try {
      // Prepare registration data based on game type
      let registrationData;
      
      if (tournament.gameType === 'bgmi' && tournament.mode !== 'solo') {
        // BGMI Squad/Team registration
        registrationData = {
          teamName: formData.teamName,
          leader: {
            name: formData.leaderName,
            email: formData.leaderEmail,
            phone: formData.leaderPhone,
            ign: formData.leaderIgn,
            uid: formData.leaderUid
          },
          teamMembers: formData.teamMembers.map((member, index) => ({
            playerNumber: index + 2,
            ign: member.ign,
            uid: member.uid
          }))
        };
      } else if (tournament.gameType === 'cs2') {
        // CS2 registration - only Steam ID needed
        const steamId = user?.gameIds?.steam || user?.steamProfile?.steamId;
        
        if (!steamId) {
          throw new Error('Steam account not connected. Please connect your Steam account first.');
        }
        
        registrationData = {
          gameId: steamId,
          teamName: tournament.mode === 'team' ? (formData.teamName || '') : ''
        };
        
        console.log('🎮 CS2 Registration data:', registrationData);
      } else {
        // Other games or solo mode
        registrationData = {
          gameId: formData.leaderUid || formData.gameId,
          teamName: tournament.mode === 'solo' ? '' : formData.teamName,
          playerName: formData.leaderName || formData.playerName,
          contactNumber: formData.leaderPhone || formData.contactNumber
        };
      }

      // Call API directly with full URL for Vercel compatibility
      const token = localStorage.getItem('token');
      const API_BASE_URL = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournament._id}/join`, {
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
      
      // Success - redirect to tournament details
      
      // Show success notification
      notificationService.showRegistrationSuccess(tournament.name);
      
      // For CS2 tournaments, automatically launch game with server connection
      if (tournament.gameType === 'cs2' && data.data?.roomDetails?.cs2?.connectCommand) {
        const connectCommand = data.data.roomDetails.cs2.connectCommand;
        
        // Show success message with game launch info
        const launchGame = window.confirm(
          `✅ Registration Successful!\n\n` +
          `Would you like to launch CS2 and connect to the server now?\n\n` +
          `Server: ${data.data.roomDetails.cs2.serverIp}:${data.data.roomDetails.cs2.serverPort}`
        );
        
        if (launchGame) {
          // Launch CS2 with server connection using steam:// protocol
          window.location.href = connectCommand;
          
          // Small delay before redirecting to tournament page
          setTimeout(() => {
            onSuccess && onSuccess();
            navigate(`/tournaments/${tournament._id}`);
          }, 1000);
        } else {
          onSuccess && onSuccess();
          navigate(`/tournaments/${tournament._id}`);
        }
      } else {
        onSuccess && onSuccess();
        navigate(`/tournaments/${tournament._id}`);
      }
      
    } catch (error) {
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // handleAddMoney removed - free tournaments only

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
                <span className="text-green-400 font-bold">FREE Entry</span>
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
          {/* CS2 Steam Connection */}
          {tournament.gameType === 'cs2' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Steam Account *
              </label>
              <SteamConnectionWidget 
                compact={true}
                actionText="join CS2 tournaments"
                onConnectionSuccess={(steamData) => {
                  console.log('✅ Steam connected successfully:', steamData);
                  setSteamConnected(true);
                  setError('');
                }}
              />
              
              {/* CS2 Tournament Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-400 font-bold mb-2 flex items-center space-x-2">
                  <span>ℹ️</span>
                  <span>How to Join:</span>
                </h4>
                <div className="text-gray-300 text-sm space-y-2">
                  {tournament.status === 'active' ? (
                    <>
                      <p>✅ Tournament is <span className="text-green-400 font-bold">LIVE</span>! Click "Join Server Now" to:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Get server connection details instantly</li>
                        <li>Copy the connect command</li>
                        <li>Launch CS2 and paste in console</li>
                        <li>Start playing immediately!</li>
                      </ul>
                    </>
                  ) : (
                    <>
                      <p>📝 Register now to secure your spot!</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Your Steam profile will be linked automatically</li>
                        <li>Server details will be shared before tournament starts</li>
                        <li>You'll receive notifications about tournament updates</li>
                        <li>No team name or additional info needed!</li>
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BGMI Squad/Team Registration */}
          {tournament.gameType === 'bgmi' && tournament.mode !== 'solo' ? (
            <>
              {/* Team Name */}
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

              {/* Leader Details Section */}
              <div className="bg-gaming-dark rounded-lg p-4 space-y-3">
                <h4 className="text-white font-bold flex items-center space-x-2">
                  <span>👑</span>
                  <span>Leader Details</span>
                </h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="leaderName"
                    value={formData.leaderName}
                    onChange={handleInputChange}
                    placeholder="Leader's full name"
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="leaderEmail"
                    value={formData.leaderEmail}
                    onChange={handleInputChange}
                    placeholder="leader@example.com"
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="leaderPhone"
                    value={formData.leaderPhone}
                    onChange={handleInputChange}
                    placeholder="10-digit mobile number"
                    maxLength="10"
                    pattern="[0-9]{10}"
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    IGN (In-Game Name) *
                  </label>
                  <input
                    type="text"
                    name="leaderIgn"
                    value={formData.leaderIgn}
                    onChange={handleInputChange}
                    placeholder="Your BGMI username"
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    BGMI UID *
                  </label>
                  <input
                    type="text"
                    name="leaderUid"
                    value={formData.leaderUid}
                    onChange={handleInputChange}
                    placeholder="9-10 digit UID"
                    maxLength="10"
                    pattern="[0-9]{9,10}"
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Find your UID in BGMI profile
                  </p>
                </div>
              </div>

              {/* Team Members Section */}
              <div className="bg-gaming-dark rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-bold flex items-center space-x-2">
                    <span>👥</span>
                    <span>Team Members ({formData.teamMembers.length}/{maxTeamSize - 1})</span>
                  </h4>
                  {formData.teamMembers.length < maxTeamSize - 1 && (
                    <button
                      type="button"
                      onClick={addTeamMember}
                      className="px-3 py-1 bg-gaming-neon text-black text-sm font-bold rounded hover:bg-gaming-gold transition-colors"
                    >
                      + Add Player
                    </button>
                  )}
                </div>

                {formData.teamMembers.length === 0 && (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Click "Add Player" to add team members
                  </div>
                )}

                {formData.teamMembers.map((member, index) => (
                  <div key={index} className="bg-gaming-charcoal rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">Player {index + 2}</span>
                      <button
                        type="button"
                        onClick={() => removeTeamMember(index)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        IGN *
                      </label>
                      <input
                        type="text"
                        value={member.ign || ''}
                        onChange={(e) => handleTeamMemberChange(index, 'ign', e.target.value)}
                        placeholder="In-Game Name"
                        className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded text-white text-sm focus:border-gaming-neon focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        BGMI UID *
                      </label>
                      <input
                        type="text"
                        value={member.uid || ''}
                        onChange={(e) => handleTeamMemberChange(index, 'uid', e.target.value)}
                        placeholder="9-10 digit UID"
                        maxLength="10"
                        pattern="[0-9]{9,10}"
                        className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded text-white text-sm focus:border-gaming-neon focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                ))}

                <div className="text-xs text-gray-400 mt-2">
                  {tournament.mode === 'duo' && '⚠️ Minimum 2 players required (including leader)'}
                  {tournament.mode === 'squad' && '⚠️ Minimum 4 players required (including leader)'}
                </div>
              </div>
            </>
          ) : (
            /* Other Games or Solo Mode */
            <>
              {/* CS2 Steam ID - Auto-filled and Read-only */}
              {tournament.gameType === 'cs2' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center space-x-2">
                    <span>Steam ID (Auto-detected)</span>
                    <span className="text-green-400 text-xs">✓ Verified</span>
                  </label>
                  <input
                    type="text"
                    value={user?.gameIds?.steam || 'Not connected'}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white cursor-not-allowed opacity-75"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Your Steam account is automatically linked for CS2 tournaments
                  </p>
                </div>
              )}

              {/* Other Games - Manual Input */}
              {tournament.gameType !== 'cs2' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {tournament.gameType.toUpperCase()} ID *
                  </label>
                  <input
                    type="text"
                    name="gameId"
                    value={formData.gameId}
                    onChange={handleInputChange}
                    placeholder={getGameIdPlaceholder()}
                    className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    required
                  />
                </div>
              )}

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

            </>
          )}

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

          {/* Free Tournament Info */}
          <div className="space-y-3">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <span className="text-green-400">🎉</span>
                <div>
                  <div className="text-green-400 text-sm font-medium">
                    Free Tournament
                  </div>
                  <div className="text-gray-300 text-xs">
                    No entry fee required - just register and play!
                  </div>
                </div>
              </div>
            </div>
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
              <div className="text-gray-300 text-xs space-y-1 mb-3">
                <div>• Server details will be provided before match</div>
                <div>• Connect via Steam using provided command</div>
                <div>• Server-side result tracking enabled</div>
              </div>
              
              {/* Steam Connection Status */}
              {!user?.gameIds?.steam && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-yellow-400 text-xs font-medium">Steam Required</div>
                      <div className="text-gray-300 text-xs">Connect Steam to join CS2 tournaments</div>
                    </div>
                    <button
                      type="button"
                      onClick={openSteamForConnection}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                    >
                      Connect Steam
                    </button>
                  </div>
                </div>
              )}
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
              disabled={isSubmitting}
              className="flex-1 btn-gaming disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{tournament.gameType === 'cs2' && tournament.status === 'active' ? 'Joining...' : 'Registering...'}</span>
                </div>
              ) : (
                <>
                  {tournament.gameType === 'cs2' && tournament.status === 'active' 
                    ? '🎮 Join Server Now' 
                    : tournament.gameType === 'cs2'
                    ? '📝 Register for Tournament'
                    : '🎯 Register for FREE'
                  }
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Steam Linking Modal */}
      <SteamLinkingModal
        isOpen={showSteamModal}
        onClose={() => setShowSteamModal(false)}
        onConfirm={handleSteamLink}
        tournamentName={tournament?.name || 'this tournament'}
      />
    </div>
  );
};

export default TournamentRegistration;