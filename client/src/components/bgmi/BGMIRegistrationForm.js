import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import api from '../../services/api';
import PlayerSearchAndAdd from './PlayerSearchAndAdd';
import Snackbar from '../common/Snackbar';

const BGMIRegistrationForm = ({ tournament, selectedTeam, onClose, onSuccess }) => {
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [snackbar, setSnackbar] = useState({ message: '', type: 'info' });

  const [formData, setFormData] = useState({
    teamName: selectedTeam?.name || '',
    teamLeader: {
      name: user?.gameIds?.bgmi?.ign || user?.bgmiIgnName || user?.username || '',
      bgmiId: user?.gameIds?.bgmi?.uid || user?.bgmiUid || '',
      phone: user?.phone || ''
    },
    teamMembers: [],
    substitute: null,
    selectedLeaderIndex: null
  });

  useEffect(() => {
    if (!selectedTeam?.members || selectedTeam.members.length === 0) return;

    const currentUserId = user?._id || user?.id || localStorage.getItem('userId');
    const otherMembers = selectedTeam.members.filter(m => {
      if (!m.userId) return false;
      const memberId = m.userId._id || m.userId;
      return memberId.toString() !== currentUserId?.toString();
    });

    // Separate regular members and substitute
    const regularMembers = [];
    let substituteData = null;

    otherMembers.forEach(m => {
      const u = m.userId;
      const memberData = {
        name: u?.gameIds?.bgmi?.ign || u?.bgmiIgnName || u?.username || '',
        bgmiId: u?.gameIds?.bgmi?.uid || u?.bgmiUid || '',
        playerId: u?._id || ''
      };

      if (m.isSubstitute) {
        substituteData = memberData;
      } else {
        regularMembers.push(memberData);
      }
    });

    if (regularMembers.length > 0 || substituteData) {
      setFormData(prev => ({
        ...prev,
        teamMembers: regularMembers,
        substitute: substituteData
      }));
    }
  }, [selectedTeam, user]);

  const handleInputChange = useCallback((section, field, value) => {
    setFormData(prev => {
      if (section === 'teamLeader') {
        return {
          ...prev,
          teamLeader: {
            ...prev.teamLeader,
            [field]: value
          }
        };
      } else {
        return {
          ...prev,
          [field]: value
        };
      }
    });
  }, []);

  // Add player from search
  const handleAddPlayerFromSearch = useCallback((player) => {
    setFormData(prev => {
      // Check if player already added (in teamMembers or as substitute)
      const alreadyInTeam = prev.teamMembers.some(m => m.name.toLowerCase() === player.name.toLowerCase());
      const alreadyAsSubstitute = prev.substitute && prev.substitute.name.toLowerCase() === player.name.toLowerCase();
      
      if (alreadyInTeam || alreadyAsSubstitute) {
        setSnackbar({ message: 'Player already added', type: 'warning' });
        return prev;
      }

      // If we have 3 members and no substitute, add as substitute
      if (prev.teamMembers.length === 3 && !prev.substitute) {
        setSnackbar({ message: `${player.name} added as substitute`, type: 'success' });
        return {
          ...prev,
          substitute: {
            name: player.name,
            bgmiId: player.bgmiId,
            playerId: player.playerId
          }
        };
      }

      // Check team size limit (3 regular members)
      if (prev.teamMembers.length >= 3) {
        setSnackbar({ message: 'Team is full (3 members + 1 substitute max)', type: 'warning' });
        return prev;
      }

      return {
        ...prev,
        teamMembers: [
          ...prev.teamMembers,
          {
            name: player.name,
            bgmiId: player.bgmiId,
            playerId: player.playerId
          }
        ]
      };
    });
  }, []);

  // Remove player from team
  const handleRemovePlayer = useCallback((index) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        teamMembers: prev.teamMembers.filter((_, i) => i !== index)
      };
      // If removed player was selected as leader, reset selection
      if (prev.selectedLeaderIndex === index) {
        newFormData.selectedLeaderIndex = null;
      } else if (prev.selectedLeaderIndex > index) {
        // Adjust index if a player before the selected leader was removed
        newFormData.selectedLeaderIndex = prev.selectedLeaderIndex - 1;
      }
      return newFormData;
    });
  }, []);

  // Handle leader selection
  const handleSelectLeader = useCallback((index) => {
    setFormData(prev => {
      return {
        ...prev,
        selectedLeaderIndex: prev.selectedLeaderIndex === index ? null : index
      };
    });
  }, []);

  // Check if user has BGMI UID and IGN set
  const hasBgmiCredentials = user?.bgmiUid && user?.bgmiIgnName;

  const validateUID = (uid) => {
    if (!uid) return { valid: true, message: '' };
    if (!/^\d+$/.test(uid)) {
      return { valid: false, message: 'UID must contain only numbers' };
    }
    if (uid.length !== 11) {
      return { valid: false, message: 'UID must be exactly 11 digits' };
    }
    return { valid: true, message: '' };
  };

  const validateForm = () => {
    // Team name validation
    if (!formData.teamName.trim() || formData.teamName.length < 3) {
      setError('Team name must be at least 3 characters long');
      return false;
    }

    // Team leader validation
    if (!formData.teamLeader.name.trim()) {
      setError('Team leader name is required');
      return false;
    }

    if (!formData.teamLeader.bgmiId.trim()) {
      setError('Team leader BGMI ID is required');
      return false;
    }

    // Validate team leader BGMI UID
    const leaderUidValidation = validateUID(formData.teamLeader.bgmiId);
    if (!leaderUidValidation.valid) {
      setError(`Team leader BGMI ID: ${leaderUidValidation.message}`);
      return false;
    }

    if (!formData.teamLeader.phone.match(/^[6-9]\d{9}$/)) {
      setError('Team leader phone must be a valid Indian number');
      return false;
    }

    // Team members validation - must have exactly 3 members (+ leader = 4 total)
    if (formData.teamMembers.length < 3) {
      setError(`Please add ${3 - formData.teamMembers.length} more player(s)`);
      return false;
    }

    for (let i = 0; i < formData.teamMembers.length; i++) {
      const member = formData.teamMembers[i];
      if (!member.name.trim()) {
        setError(`Team member ${i + 1} name is required`);
        return false;
      }
      if (!member.bgmiId.trim()) {
        setError(`Team member ${i + 1} BGMI ID is required`);
        return false;
      }

      // Validate team member BGMI UID
      const memberUidValidation = validateUID(member.bgmiId);
      if (!memberUidValidation.valid) {
        setError(`Team member ${i + 1} BGMI ID: ${memberUidValidation.message}`);
        return false;
      }
    }

    // Validate substitute UID if present
    if (formData.substitute) {
      const substituteUidValidation = validateUID(formData.substitute.bgmiId);
      if (!substituteUidValidation.valid) {
        setError(`Substitute BGMI ID: ${substituteUidValidation.message}`);
        return false;
      }
    }

    // Check for duplicate BGMI IDs (including substitute)
    const allBgmiIds = [
      formData.teamLeader.bgmiId,
      ...formData.teamMembers.map(m => m.bgmiId),
      ...(formData.substitute ? [formData.substitute.bgmiId] : [])
    ];
    const uniqueBgmiIds = [...new Set(allBgmiIds)];
    if (allBgmiIds.length !== uniqueBgmiIds.length) {
      setError('All team members must have unique BGMI IDs');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Determine actual team leader
      let actualTeamLeader;
      if (formData.selectedLeaderIndex === null) {
        // Original user is the leader (default)
        actualTeamLeader = formData.teamLeader;
        var otherMembers = formData.teamMembers;
      } else {
        // A team member was selected as leader
        actualTeamLeader = formData.teamMembers[formData.selectedLeaderIndex];
        // Other members include the original leader + remaining members
        otherMembers = [
          formData.teamLeader,
          ...formData.teamMembers.filter((_, i) => i !== formData.selectedLeaderIndex)
        ];
      }

      // Validate team members exist in Users collection
      console.log('🔍 Validating team members...');

      const teamMembersToValidate = [
        { name: actualTeamLeader.name, bgmiId: actualTeamLeader.bgmiId },
        ...otherMembers,
        ...(formData.substitute ? [{ name: formData.substitute.name, bgmiId: formData.substitute.bgmiId }] : [])  // ✅ Include substitute
      ];

      // Get API URL with smart detection
      let API_URL = process.env.REACT_APP_API_URL;
      if (!API_URL && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
          API_URL = 'http://127.0.0.1:5001';
        } else {
          const protocol = window.location.protocol;
          API_URL = `${protocol}//${hostname}`;
        }
      }
      if (!API_URL) {
        API_URL = 'http://127.0.0.1:5001';
      }

      // Validate each team member
      const validationPromises = teamMembersToValidate.map(member =>
        fetch(`${API_URL}/api/tournaments/validate-player`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            bgmiUid: member.bgmiId,
            ignName: member.name
          })
        }).then(res => res.json())
      );

      const validationResults = await Promise.all(validationPromises);

      // Check if all members are registered
      const unregisteredMembers = [];
      validationResults.forEach((result, index) => {
        if (!result.data?.isRegistered) {
          let memberName = `Team Member ${index}`;
          if (index === 0) {
            memberName = 'Team Leader';
          } else if (index === teamMembersToValidate.length - 1 && formData.substitute) {
            memberName = 'Substitute';
          }
          unregisteredMembers.push(`${memberName} (${teamMembersToValidate[index].name})`);
        }
      });

      if (unregisteredMembers.length > 0) {
        setError(`⚠️ The following players are not registered on our platform:\n${unregisteredMembers.join('\n')}\n\nAll team membeers must be registered before tournament registration.`);
        setLoading(false);
        return;
      }

      console.log('✅ All team members validated successfully');

      // Submit registration
      console.log('🎮 Submitting BGMI registration:', {
        tournamentId: tournament._id,
        teamName: formData.teamName
      });

      const registrationData = {
        teamName: formData.teamName,
        teamLeader: {
          name: actualTeamLeader.name,
          bgmiId: actualTeamLeader.bgmiId,
          phone: formData.teamLeader.phone
        },
        teamMembers: otherMembers.map((m) => ({
          name: m.name,
          bgmiId: m.bgmiId
        })),
        ...(formData.substitute && {
          substitute: {
            name: formData.substitute.name,
            bgmiId: formData.substitute.bgmiId
          }
        }),
        whatsappNumber: formData.teamLeader.phone
      };

      console.log('📤 Sending registration data:', JSON.stringify(registrationData, null, 2));

      const response = await api.post(`/api/bgmi-registration/${tournament._id}/register`, registrationData);

      console.log('� Registration API response:', response);

      const responseData = response.data || response;
      console.log('📤 Response data:', responseData);

      const isSuccess = responseData?.success === true ||
        (responseData?.registration && !responseData?.error);

      if (isSuccess) {
        setSuccess(true);
        console.log('✅ Registration successful:', responseData);

        setTimeout(() => {
          const registrationData = responseData.data?.registration ||
            responseData.registration ||
            responseData;
          console.log('🔄 Passing registration data to onSuccess:', registrationData);
          onSuccess && onSuccess(registrationData);
        }, 2000);
      } else {
        console.error('❌ Registration API failed:', responseData);
        setError(responseData?.error?.message || responseData?.message || 'Registration failed');
      }
    } catch (error) {
      console.error('❌ Registration error:', error);
      console.error('❌ Error response:', error.response?.data);
      
      // Get detailed error message
      let errorMessage = 'Failed to register team';
      
      if (error.response?.data?.error?.details) {
        // Show validation errors
        const details = error.response.data.error.details;
        errorMessage = details.map(d => `${d.param}: ${d.msg}`).join('\n');
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      >
        <div className="bg-gaming-dark border border-gaming-neon rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gaming-neon mb-4">Registration Successful!</h2>
          <p className="text-gray-300 mb-4">
            Team <span className="text-gaming-neon font-bold">{formData.teamName}</span> has been registered for {tournament.name}.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            📱 WhatsApp confirmation sent to {formData.teamLeader.phone}
          </p>
          <div className="bg-gaming-charcoal rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-white mb-2">Next Steps:</h3>
            <div className="text-sm text-gray-300 space-y-1">
              <div>1. 📱 Send 8 verification images via WhatsApp (2 per player)</div>
              <div>2. ⏳ Wait for admin verification</div>
              <div>3. 🎮 Receive tournament details via WhatsApp</div>
            </div>
            <div className="mt-3 p-3 bg-gaming-neon/10 border border-gaming-neon/20 rounded-lg">
              <div className="text-sm text-gaming-neon font-medium">
                📸 Send images to: {formData.teamLeader.phone}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                ID proof + BGMI screenshot for each player
              </div>
            </div>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gaming-neon mx-auto"></div>
          <p className="text-sm text-gray-400 mt-2">Redirecting...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gaming-dark border border-gaming-slate rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gaming-dark border-b border-gaming-slate p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Register Team</h2>
            <p className="text-gray-400">{tournament.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form - Scrollable */}
        <form id="registration-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* BGMI Credentials Warning */}
          {!hasBgmiCredentials && (
            <div className="bg-red-500/15 border border-red-500/40 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <span className="text-red-400 text-xl mt-0.5">⚠️</span>
                <div>
                  <h3 className="text-red-400 font-semibold text-sm mb-1">BGMI Profile Incomplete</h3>
                  <p className="text-red-300 text-sm">Please set your BGMI UID and IGN in your profile settings before registering for tournaments.</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <span className="text-red-400">⚠️</span>
                <span className="text-red-400 font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Team Name + Phone Number - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Team Name *
              </label>
              <input
                type="text"
                value={formData.teamName}
                onChange={(e) => handleInputChange('', 'teamName', e.target.value)}
                placeholder="Enter your team name"
                className="w-full px-4 py-3 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.teamLeader.phone}
                onChange={(e) => handleInputChange('teamLeader', 'phone', e.target.value)}
                placeholder="10-digit phone"
                className="w-full px-4 py-3 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Search and Add Players */}
          <PlayerSearchAndAdd
            onAddPlayer={handleAddPlayerFromSearch}
            currentTeamMembers={[formData.teamLeader, ...formData.teamMembers]}
            maxPlayers={5}
            currentUserData={user}
          />

          {/* Team Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="block text-sm font-medium text-gray-300">
                  👥 Team Members ({(hasBgmiCredentials ? 1 : 0) + formData.teamMembers.length}{ formData.substitute ? '+1 SUB' : ''}/4-5)
                </label>
              </div>
            </div>

            {/* Team Leader - Only show if BGMI credentials are set */}
            {hasBgmiCredentials && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`rounded-lg p-3 flex items-center justify-between transition-all ${
                  formData.selectedLeaderIndex === null
                    ? 'bg-gaming-charcoal border border-gaming-neon/30'
                    : 'bg-gaming-charcoal border border-gaming-slate'
                }`}
              >
                <div className="flex items-center space-x-2 flex-1">
                  <span className="text-gaming-neon font-bold text-sm">#1</span>
                  <div>
                    <h4 className="text-white font-medium text-sm">{formData.teamLeader.name}</h4>
                    <p className="text-gaming-neon text-xs">UID: {formData.teamLeader.bgmiId}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-gaming-neon/20 border border-gaming-neon/40 text-gaming-neon text-xs font-semibold rounded shrink-0">
                  LEADER
                </span>
                <div className="flex items-center space-x-2 ml-2">
                  <button
                    type="button"
                    onClick={() => handleSelectLeader(-1)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                      formData.selectedLeaderIndex === null
                        ? 'bg-gaming-neon/30 border border-gaming-neon text-gaming-neon'
                        : 'bg-gaming-slate/50 border border-gaming-slate text-gray-400 hover:border-gaming-neon/50'
                    }`}
                  >
                    {formData.selectedLeaderIndex === null ? '✓ Leader' : 'Set Leader'}
                  </button>
                </div>
              </motion.div>
            )}

            {formData.teamMembers.length === 0 ? (
              <div className="bg-gaming-charcoal border border-gaming-slate rounded-lg p-4 text-center text-gray-400">
                <p className="text-sm">Search and add players above to build your team</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.teamMembers.map((member, index) => {
                  const isSelectedLeader = formData.selectedLeaderIndex === index;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className={`rounded-lg p-3 flex items-center justify-between transition-all ${
                        isSelectedLeader
                          ? 'bg-gaming-charcoal border border-gaming-neon/50'
                          : 'bg-gaming-charcoal border border-gaming-slate'
                      }`}
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <span className="text-gaming-neon font-bold text-sm">#{index + 2}</span>
                        <div>
                          <h4 className="text-white font-medium text-sm">{member.name}</h4>
                          <p className="text-gaming-neon text-xs">UID: {member.bgmiId}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-gaming-slate/50 border border-gaming-slate text-gray-300 text-xs font-semibold rounded shrink-0">
                        MEMBER
                      </span>
                      <div className="flex items-center space-x-2 ml-2">
                        <button
                          type="button"
                          onClick={() => handleSelectLeader(index)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                            isSelectedLeader
                              ? 'bg-gaming-neon/30 border border-gaming-neon text-gaming-neon'
                              : 'bg-gaming-slate/50 border border-gaming-slate text-gray-400 hover:border-gaming-neon/50'
                          }`}
                        >
                          {isSelectedLeader ? '✓ Leader' : 'Set Leader'}
                        </button>
                        <motion.button
                          type="button"
                          onClick={() => handleRemovePlayer(index)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/20 transition-colors"
                        >
                          Remove
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Substitute Member Display */}
                {formData.substitute && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-lg p-3 flex items-center justify-between transition-all bg-gaming-charcoal border border-gaming-slate"
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-gaming-neon font-bold text-sm">🔄</span>
                      <div>
                        <h4 className="text-white font-medium text-sm">{formData.substitute.name}</h4>
                        <p className="text-gaming-neon text-xs">UID: {formData.substitute.bgmiId}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-gaming-neon/20 border border-gaming-neon/40 text-gaming-neon text-xs font-semibold rounded shrink-0">
                      SUBSTITUTE
                    </span>
                    <motion.button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, substitute: null }))}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/20 transition-colors ml-2"
                    >
                      Remove
                    </motion.button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Submit Buttons - Fixed at Bottom */}
        <div className="border-t border-gaming-slate bg-gaming-dark p-3 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-gaming-slate text-white rounded hover:bg-gaming-charcoal transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="registration-form"
            className="px-4 py-1.5 bg-gaming-neon text-gaming-dark font-medium rounded hover:bg-gaming-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs whitespace-nowrap"
            disabled={loading || formData.teamMembers.length < 3}
          >
            {loading ? (
              <span className="flex items-center justify-center space-x-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gaming-dark"></div>
                <span>Registering...</span>
              </span>
            ) : (
              'Register Team'
            )}
          </button>
        </div>
      </motion.div>

      {/* Snackbar Notification */}
      <Snackbar
        message={snackbar.message}
        type={snackbar.type}
        onClose={() => setSnackbar({ message: '', type: 'info' })}
      />
    </motion.div>
  );
};

export default BGMIRegistrationForm;