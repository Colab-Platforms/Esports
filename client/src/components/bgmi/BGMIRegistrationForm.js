import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import api from '../../services/api';

const BGMIRegistrationForm = ({ tournament, onClose, onSuccess }) => {
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  const handleInputChange = (section, field, value, index = null) => {
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
    if (!formData.teamLeader.phone.match(/^[6-9]\d{9}$/)) {
      setError('Team leader phone must be a valid Indian number');
      return false;
    }

    // Team members validation
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

    // WhatsApp number will be same as leader's phone (already validated above)

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

    // No phone number validation for team members needed

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
      console.log('🎮 Submitting BGMI registration:', {
        tournamentId: tournament._id,
        teamName: formData.teamName
      });

      // Use leader's phone as WhatsApp number
      const registrationData = {
        ...formData,
        whatsappNumber: formData.teamLeader.phone
      };
      
      const response = await api.post(`/api/bgmi-registration/${tournament._id}/register`, registrationData);

      console.log('📤 Registration API response:', response);
      
      console.log('📤 Full response object:', response);
      
      // Check if response has data property (axios format) or is direct response
      const responseData = response.data || response;
      
      console.log('📤 Response data:', responseData);
      
      // Check for success in multiple ways
      const isSuccess = responseData?.success === true || 
                       (responseData?.registration && !responseData?.error);
      
      if (isSuccess) {
        setSuccess(true);
        console.log('✅ Registration successful:', responseData);
        
        // Show success message for 2 seconds, then call onSuccess
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
        className="bg-gaming-dark border border-gaming-slate rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <span className="text-red-400">⚠️</span>
                <span className="text-red-400 font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Team Name */}
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

          {/* Team Leader */}
          <div className="bg-gaming-charcoal rounded-lg p-6">
            <h3 className="text-lg font-bold text-gaming-neon mb-4">👑 Team Leader</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  IGN Name *
                </label>
                <input
                  type="text"
                  value={formData.teamLeader.name}
                  onChange={(e) => handleInputChange('teamLeader', 'name', e.target.value)}
                  placeholder="Leader IGN name"
                  className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  BGMI UID *
                </label>
                <input
                  type="text"
                  value={formData.teamLeader.bgmiId}
                  onChange={(e) => handleInputChange('teamLeader', 'bgmiId', e.target.value)}
                  placeholder="BGMI UID"
                  className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
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
                  placeholder="10-digit phone number"
                  className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-gaming-charcoal rounded-lg p-6">
            <h3 className="text-lg font-bold text-gaming-neon mb-4">👥 Team Members</h3>
            {formData.teamMembers.map((member, index) => (
              <div key={index} className="mb-6 last:mb-0">
                <h4 className="text-md font-medium text-white mb-3">Member {index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      IGN Name *
                    </label>
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => handleInputChange('teamMembers', 'name', e.target.value, index)}
                      placeholder={`Member ${index + 1} IGN name`}
                      className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      BGMI UID *
                    </label>
                    <input
                      type="text"
                      value={member.bgmiId}
                      onChange={(e) => handleInputChange('teamMembers', 'bgmiId', e.target.value, index)}
                      placeholder="BGMI UID"
                      className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp Info */}
          <div className="bg-gaming-slate rounded-lg p-4">
            <h4 className="text-lg font-bold text-white mb-2">📱 WhatsApp Notifications</h4>
            <p className="text-sm text-gray-300">
              Registration confirmation and tournament updates will be sent to the team leader's phone number: 
              <span className="text-gaming-neon font-bold ml-1">
                {formData.teamLeader.phone || 'Enter leader phone number above'}
              </span>
            </p>
          </div>

          {/* Tournament Info */}
          <div className="bg-gaming-slate rounded-lg p-4">
            <h4 className="text-lg font-bold text-white mb-2">Tournament Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Entry Fee:</span>
                <span className="text-gaming-neon font-bold ml-2">₹{tournament.entryFee}</span>
              </div>
              <div>
                <span className="text-gray-400">Prize Pool:</span>
                <span className="text-gaming-neon font-bold ml-2">₹{tournament.prizePool.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Mode:</span>
                <span className="text-white ml-2">{tournament.mode || 'Squad'}</span>
              </div>
              <div>
                <span className="text-gray-400">Max Teams:</span>
                <span className="text-white ml-2">{tournament.maxParticipants}</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gaming-neon text-gaming-dark font-bold rounded-lg hover:bg-gaming-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gaming-dark"></div>
                  <span>Registering...</span>
                </div>
              ) : (
                'Register Team 🎮'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default BGMIRegistrationForm;