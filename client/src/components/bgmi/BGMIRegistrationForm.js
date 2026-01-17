import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import api from '../../services/api';
import BGMIDynamicPlayerForm from './BGMIDynamicPlayerForm';
import Snackbar from '../common/Snackbar';

const BGMIRegistrationForm = ({ tournament, onClose, onSuccess }) => {
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [snackbar, setSnackbar] = useState({ message: '', type: 'info' });
  const [registrationMode, setRegistrationMode] = useState('manual'); // 'manual' or 'team'
  const [userTeams, setUserTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showDynamicForm, setShowDynamicForm] = useState(false); // Track if using dynamic form

  const [formData, setFormData] = useState({
    teamName: '',
    teamLeader: {
      name: user?.username || '',
      bgmiId: '',
      phone: ''
    },
    teamMembers: [
      { name: '', bgmiId: '' },
      { name: '', bgmiId: '' },
      { name: '', bgmiId: '' }
    ],
    // whatsappNumber will be same as teamLeader.phone
  });

  // Fetch user's eligible teams when component mounts
  const fetchEligibleTeams = useCallback(async () => {
    setLoadingTeams(true);
    try {
      console.log('🔍 Fetching eligible teams for tournament:', tournament._id);
      console.log('🔍 API URL:', `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/tournaments/${tournament._id}/eligible-teams`);

      const response = await api.get(`/api/tournaments/${tournament._id}/eligible-teams`);
      console.log('📤 Teams API response:', response);
      console.log('📤 Response status:', response.status);
      console.log('📤 Response data:', response.data);

      const teams = response.data?.teams || response.data?.data?.teams || [];
      console.log('👥 Found teams:', teams.length, teams);

      setUserTeams(teams);

      // Always show teams, regardless of eligibility
      if (teams.length > 0) {
        console.log('✅ Found teams, setting registration mode to team');
        setRegistrationMode('team');
      } else {
        console.log('ℹ️ No teams found, keeping manual mode');
      }
    } catch (error) {
      console.error('❌ Error fetching eligible teams:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error message:', error.message);
      // If error, keep manual mode as default
    } finally {
      setLoadingTeams(false);
    }
  }, [tournament._id]);

  useEffect(() => {
    if (tournament?._id) {
      fetchEligibleTeams();
    }
  }, [tournament._id, fetchEligibleTeams]);

  const handleTeamSelect = useCallback((team) => {
    if (selectedTeam?._id === team._id) return; // Prevent selecting the same team

    setSelectedTeam(team);
    setError(''); // Clear any previous errors

    // Pre-fill form data with team information
    if (team && team.members) {
      const captain = team.members.find(member => member.role === 'captain');
      const members = team.members.filter(member => member.role !== 'captain');

      // Pad members array to ensure we have 3 entries
      const paddedMembers = [
        { name: members[0]?.username || '', bgmiId: members[0]?.gameId || '' },
        { name: members[1]?.username || '', bgmiId: members[1]?.gameId || '' },
        { name: members[2]?.username || '', bgmiId: members[2]?.gameId || '' }
      ];

      setFormData(prev => ({
        ...prev,
        teamName: team.name,
        teamLeader: {
          ...prev.teamLeader,
          name: captain?.username || '',
          bgmiId: captain?.gameId || ''
        },
        teamMembers: paddedMembers
      }));
    }
  }, [selectedTeam]);

  const handleInputChange = useCallback((section, field, value, index = null) => {
    setFormData(prev => {
      if (section === 'teamLeader') {
        return {
          ...prev,
          teamLeader: {
            ...prev.teamLeader,
            [field]: value
          }
        };
      } else if (section === 'teamMembers') {
        const updatedMembers = [...prev.teamMembers];
        updatedMembers[index] = {
          ...updatedMembers[index],
          [field]: value
        };
        return {
          ...prev,
          teamMembers: updatedMembers
        };
      } else {
        return {
          ...prev,
          [field]: value
        };
      }
    });
  }, []);

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
    
    // Only validate teamLeader.bgmiId if NOT using dynamic form
    // If using dynamic form, validation happens in BGMIDynamicPlayerForm
    if (!showDynamicForm && !formData.teamLeader.bgmiId.trim()) {
      setError('Team leader BGMI ID is required');
      return false;
    }
    
    if (!formData.teamLeader.phone.match(/^[6-9]\d{9}$/)) {
      setError('Team leader phone must be a valid Indian number');
      return false;
    }

    // Team members validation - only if NOT using dynamic form
    if (!showDynamicForm) {
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
      }

      // Check for duplicate BGMI IDs
      const allBgmiIds = [
        formData.teamLeader.bgmiId,
        ...formData.teamMembers.map(m => m.bgmiId)
      ];
      const uniqueBgmiIds = [...new Set(allBgmiIds)];
      if (allBgmiIds.length !== uniqueBgmiIds.length) {
        setError('All team members must have unique BGMI IDs');
        return false;
      }
    }

    return true;
  };

  // Handle dynamic form submission
  const handleDynamicFormSubmit = useCallback(async (players) => {
    setError('');
    setLoading(true);

    try {
      // Extract team leader from first player in the array
      const teamLeader = players[0];
      
      // Prepare registration data from dynamic form
      const registrationData = {
        teamName: formData.teamName,
        teamLeader: {
          name: teamLeader.name,
          bgmiId: teamLeader.bgmiId,
          phone: formData.teamLeader.phone
        },
        teamMembers: players.slice(1).map(p => ({
          name: p.name,
          bgmiId: p.bgmiId
        })),
        whatsappNumber: formData.teamLeader.phone
      };

      console.log('🎮 Submitting dynamic form BGMI registration:', {
        tournamentId: tournament._id,
        teamName: registrationData.teamName,
        teamLeader: registrationData.teamLeader.name,
        teamLeaderUid: registrationData.teamLeader.bgmiId
      });

      const response = await api.post(`/api/bgmi-registration/${tournament._id}/register`, registrationData);

      console.log('📤 Registration API response:', response);

      const responseData = response.data || response;
      console.log('� Response data:', responseData);

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
        console.error('Registration API failed:', responseData);
        setError(responseData?.error?.message || responseData?.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError(
        error.response?.data?.error?.message ||
        error.message ||
        'Failed to register team'
      );
    } finally {
      setLoading(false);
    }
  }, [formData, tournament._id, onSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // If using dynamic form, don't validate here - let dynamic form handle it
    if (!showDynamicForm) {
      if (!validateForm()) {
        return;
      }
    }

    setLoading(true);

    try {
      let response;

      if (registrationMode === 'team' && selectedTeam) {
        // Use team-based registration
        console.log('🎮 Submitting team-based BGMI registration:', {
          tournamentId: tournament._id,
          teamId: selectedTeam._id
        });

        response = await api.post(`/api/tournaments/${tournament._id}/join-with-team`, {
          teamId: selectedTeam._id
        });
      } else {
        // Use manual registration
        console.log('🎮 Submitting manual BGMI registration:', {
          tournamentId: tournament._id,
          teamName: formData.teamName
        });

        const registrationData = {
          ...formData,
          whatsappNumber: formData.teamLeader.phone
        };

        response = await api.post(`/api/bgmi-registration/${tournament._id}/register`, registrationData);
      }

      console.log('📤 Registration API response:', response);

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
      setError(
        error.response?.data?.error?.message ||
        error.message ||
        'Failed to register team'
      );
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
          {/* Error Message - Only show validation errors, not warnings */}
          {error && !error.includes('⚠️') && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <span className="text-red-400">⚠️</span>
                <span className="text-red-400 font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Manual Registration Form */}
          <>
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

            {/* Team Members - Dynamic Form */}
            {!showDynamicForm ? (
              <button
                type="button"
                onClick={() => setShowDynamicForm(true)}
                className="w-full px-4 py-3 bg-gaming-neon/10 border border-gaming-neon text-gaming-neon rounded-lg font-medium hover:bg-gaming-neon/20 transition-colors"
              >
                + Add Team Members
              </button>
            ) : (
              <BGMIDynamicPlayerForm
                teamSize={selectedTeam?.memberCount || 2}
                existingTeamMembers={selectedTeam?.members || []}
                onSubmit={handleDynamicFormSubmit}
                onCancel={() => setShowDynamicForm(false)}
                tournament={tournament}
              />
            )}
          </>
        </form>

        {/* Submit Buttons - Fixed at Bottom - Always Show */}
        <div className="border-t border-gaming-slate bg-gaming-dark p-3 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-gaming-slate text-white rounded hover:bg-gaming-charcoal transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            Cancel
          </button>
          {showDynamicForm ? (
            <button
              type="button"
              onClick={() => {
                // Clear previous error
                window.dynamicFormValidationError = null;
                // Trigger dynamic form submission by finding and clicking its submit button
                const dynamicFormButton = document.querySelector('[data-dynamic-form-submit]');
                if (dynamicFormButton) {
                  dynamicFormButton.click();
                  // Check if validation failed
                  if (window.dynamicFormValidationError) {
                    setSnackbar({ message: window.dynamicFormValidationError, type: 'warning' });
                  }
                }
              }}
              className="px-4 py-1.5 bg-gaming-neon text-gaming-dark font-medium rounded hover:bg-gaming-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs whitespace-nowrap"
              disabled={loading}
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
          ) : (
            <button
              type="submit"
              form="registration-form"
              className="px-4 py-1.5 bg-gaming-neon text-gaming-dark font-medium rounded hover:bg-gaming-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs whitespace-nowrap"
              disabled={loading || (registrationMode === 'team' && !selectedTeam)}
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
          )}
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