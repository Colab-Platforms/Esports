import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import axios from 'axios';
import { FiSettings, FiTwitter, FiInstagram, FiGithub, FiLinkedin } from 'react-icons/fi';
import { selectAuth, updateProfile } from '../../store/slices/authSlice';

const ProfileSettingsForm = ({ embedded = false }) => {
  const { user, token } = useSelector(selectAuth);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('account');
  const [isEditing, setIsEditing] = useState(false);

  const getCountryInfo = (countryCode) => {
    const countries = {
      'IN': { flag: '🇮🇳', name: 'India' },
      'India': { flag: '🇮🇳', name: 'India' },
      'US': { flag: '🇺🇸', name: 'United States' },
      'UK': { flag: '🇬🇧', name: 'United Kingdom' },
      'CA': { flag: '🇨🇦', name: 'Canada' },
      'AU': { flag: '🇦🇺', name: 'Australia' },
      'PK': { flag: '🇵🇰', name: 'Pakistan' },
      'BD': { flag: '🇧🇩', name: 'Bangladesh' },
      'LK': { flag: '🇱🇰', name: 'Sri Lanka' },
      'NP': { flag: '🇳🇵', name: 'Nepal' }
    };
    return countries[countryCode] || { flag: '🌍', name: countryCode || 'Not set' };
  };
  
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    country: user?.country || 'India',
    state: user?.state || '',
    favoriteGame: user?.favoriteGame || '',
    profileVisibility: user?.profileVisibility || 'public',
    bio: user?.bio || '',
    bgmiIgnName: user?.gameIds?.bgmi?.ign || user?.bgmiIgnName || '',
    bgmiUid: user?.gameIds?.bgmi?.uid || user?.bgmiUid || '',
    freeFireIgnName: user?.gameIds?.freefire?.ign || user?.freeFireIgnName || '',
    freeFireUid: user?.gameIds?.freefire?.uid || user?.freeFireUid || ''
  });

  const [gameIds, setGameIds] = useState({
    bgmi: {
      ign: user?.gameIds?.bgmi?.ign || user?.bgmiIgnName || '',
      uid: user?.gameIds?.bgmi?.uid || user?.bgmiUid || ''
    },
    freefire: {
      ign: user?.gameIds?.freefire?.ign || user?.freeFireIgnName || '',
      uid: user?.gameIds?.freefire?.uid || user?.freeFireUid || ''
    },
    steam: user?.gameIds?.steam || ''
  });

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];

  const [socialAccounts, setSocialAccounts] = useState({
    twitter: user?.socialAccounts?.twitter || '',
    instagram: user?.socialAccounts?.instagram || '',
    github: user?.socialAccounts?.github || '',
    linkedin: user?.socialAccounts?.linkedin || ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        country: user.country || 'India',
        state: user.state || '',
        favoriteGame: user.favoriteGame || '',
        profileVisibility: user.profileVisibility || 'public',
        bio: user.bio || '',
        bgmiIgnName: user.gameIds?.bgmi?.ign || user.bgmiIgnName || '',
        bgmiUid: user.gameIds?.bgmi?.uid || user.bgmiUid || '',
        freeFireIgnName: user.gameIds?.freefire?.ign || user.freeFireIgnName || '',
        freeFireUid: user.gameIds?.freefire?.uid || user.freeFireUid || ''
      });
      setSocialAccounts({
        twitter: user.socialAccounts?.twitter || '',
        instagram: user.socialAccounts?.instagram || '',
        github: user.socialAccounts?.github || '',
        linkedin: user.socialAccounts?.linkedin || ''
      });
      setGameIds({
        bgmi: {
          ign: user.gameIds?.bgmi?.ign || user.bgmiIgnName || '',
          uid: user.gameIds?.bgmi?.uid || user.bgmiUid || ''
        },
        freefire: {
          ign: user.gameIds?.freefire?.ign || user.freeFireIgnName || '',
          uid: user.gameIds?.freefire?.uid || user.freeFireUid || ''
        },
        steam: user.gameIds?.steam || ''
      });
    }
  }, [user]);

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    
    // Also update gameIds when BGMI/Free Fire fields change
    if (field === 'bgmiIgnName') {
      setGameIds(prev => ({
        ...prev,
        bgmi: { ...prev.bgmi, ign: value }
      }));
    } else if (field === 'bgmiUid') {
      setGameIds(prev => ({
        ...prev,
        bgmi: { ...prev.bgmi, uid: value }
      }));
    } else if (field === 'freeFireIgnName') {
      setGameIds(prev => ({
        ...prev,
        freefire: { ...prev.freefire, ign: value }
      }));
    } else if (field === 'freeFireUid') {
      setGameIds(prev => ({
        ...prev,
        freefire: { ...prev.freefire, uid: value }
      }));
    }
  };

  const handleSocialChange = (platform, value) => {
    setSocialAccounts(prev => ({ ...prev, [platform]: value }));
  };

  const handleGameIdChange = (game, field, value) => {
    setGameIds(prev => ({
      ...prev,
      [game]: typeof prev[game] === 'object' 
        ? { ...prev[game], [field]: value }
        : value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      const response = await axios.put(
        `${API_URL}/api/auth/profile`,
        {
          username: profileData.username,
          phone: profileData.phone,
          country: profileData.country,
          state: profileData.state,
          favoriteGame: profileData.favoriteGame,
          profileVisibility: profileData.profileVisibility,
          bio: profileData.bio,
          bgmiIgnName: profileData.bgmiIgnName,
          bgmiUid: profileData.bgmiUid,
          freeFireIgnName: profileData.freeFireIgnName,
          freeFireUid: profileData.freeFireUid,
          socialAccounts,
          gameIds
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        dispatch(updateProfile(response.data.data.user));
        setSuccess('Profile updated successfully!');
        setIsEditing(false);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Profile update error:', err);
      const errorMessage = err.response?.data?.error?.message 
        || err.response?.data?.message 
        || err.message 
        || 'Failed to update profile';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center space-x-2"
        >
          <span className="text-green-400">✅ {success}</span>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center space-x-2"
        >
          <span className="text-red-400">❌ {error}</span>
        </motion.div>
      )}

      <div className="card-gaming p-6">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">
            {embedded ? 'Profile Settings' : 'Account Information'}
          </h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-gaming flex items-center space-x-2 text-sm"
            >
              <FiSettings className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gaming-border overflow-x-auto">
          <button
            onClick={() => setActiveSection('account')}
            className={`pb-3 px-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base ${
              activeSection === 'account'
                ? 'text-gaming-gold border-b-2 border-gaming-gold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Account Info
          </button>
          <button
            onClick={() => setActiveSection('gameids')}
            className={`pb-3 px-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base ${
              activeSection === 'gameids'
                ? 'text-gaming-gold border-b-2 border-gaming-gold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Game IDs
          </button>
          <button
            onClick={() => setActiveSection('social')}
            className={`pb-3 px-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base ${
              activeSection === 'social'
                ? 'text-gaming-gold border-b-2 border-gaming-gold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Social Media
          </button>
        </div>

        {/* Account Information Section */}
        {activeSection === 'account' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={profileData.username}
                  onChange={(e) => handleProfileChange('username', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                    isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                  }`}
                  placeholder="Username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="w-full px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => handleProfileChange('phone', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                    isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                  }`}
                  placeholder="Phone"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Country
                </label>
                <div className="w-full px-3 py-2 border border-gaming-border rounded-lg bg-gaming-dark text-gray-400 cursor-not-allowed flex items-center space-x-2">
                  <span className="text-2xl">{getCountryInfo(profileData.country).flag}</span>
                  <span>{getCountryInfo(profileData.country).name}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  State
                </label>
                <select
                  value={profileData.state}
                  onChange={(e) => handleProfileChange('state', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                    isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <option value="">Select your state</option>
                  {indianStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Favorite Game
                </label>
                <select
                  value={profileData.favoriteGame}
                  onChange={(e) => handleProfileChange('favoriteGame', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                    isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <option value="">Select your favorite game</option>
                  <option value="bgmi">BGMI</option>
                  <option value="cs2">CS2</option>
                  <option value="valorant">Valorant</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bio
              </label>
              <textarea
                value={profileData.bio}
                onChange={(e) => handleProfileChange('bio', e.target.value)}
                disabled={!isEditing}
                rows={4}
                className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                  isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                }`}
                placeholder="Tell us about yourself..."
              />
            </div>

            {isEditing && (
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                  className="px-6 py-2 bg-gaming-charcoal hover:bg-gaming-border text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="btn-gaming flex items-center space-x-2"
                >
                  <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Game IDs Section */}
        {activeSection === 'gameids' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm mb-4">
              Add your game IDs to participate in tournaments and join teams
            </p>

            {/* BGMI Section */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  BGMI IGN (In-Game Name)
                </label>
                <input
                  type="text"
                  value={gameIds.bgmi.ign}
                  onChange={(e) => handleGameIdChange('bgmi', 'ign', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                    isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                  }`}
                  placeholder="Your BGMI IGN"
                />
                <p className="text-xs text-gray-500 mt-1">Your in-game name for BGMI tournaments</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  BGMI UID (User ID)
                </label>
                <input
                  type="text"
                  value={gameIds.bgmi.uid}
                  onChange={(e) => handleGameIdChange('bgmi', 'uid', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                    isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                  }`}
                  placeholder="Your BGMI UID"
                />
                <p className="text-xs text-gray-500 mt-1">Your unique BGMI user ID for verification</p>
              </div>
            </div>

            {/* Free Fire Section */}
            <div className="border-t border-gaming-border pt-6 mt-6">
              <h4 className="text-white font-medium mb-4 flex items-center space-x-2">
                <span className="text-xl">🔥</span>
                <span>Free Fire</span>
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Free Fire IGN (In-Game Name)
                  </label>
                  <input
                    type="text"
                    value={gameIds.freefire.ign}
                    onChange={(e) => handleGameIdChange('freefire', 'ign', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                      isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                    }`}
                    placeholder="Your Free Fire IGN"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your in-game name for Free Fire tournaments</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Free Fire UID (User ID)
                  </label>
                  <input
                    type="text"
                    value={gameIds.freefire.uid}
                    onChange={(e) => handleGameIdChange('freefire', 'uid', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                      isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                    }`}
                    placeholder="Your Free Fire UID"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your unique Free Fire user ID for verification</p>
                </div>
              </div>
            </div>

            {/* Steam Section */}
            <div className="border-t border-gaming-border pt-6 mt-6">
              <h4 className="text-white font-medium mb-4">Steam ID</h4>
              
              <div>
                <input
                  type="text"
                  value={gameIds.steam}
                  onChange={(e) => handleGameIdChange('steam', null, e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                    isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                  }`}
                  placeholder="Enter your Steam ID (e.g., 76561198123456789)"
                />
                <p className="text-xs text-gray-500 mt-1">Required for CS2 tournament participation</p>
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                  className="px-6 py-2 bg-gaming-charcoal hover:bg-gaming-border text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="btn-gaming flex items-center space-x-2"
                >
                  <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Social Media Section */}
        {activeSection === 'social' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm mb-6">
              Connect your social media accounts to showcase them on your profile
            </p>

            {/* Twitter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center space-x-2">
                <FiTwitter className="text-blue-400 w-5 h-5" />
                <span>Twitter</span>
              </label>
              <input
                type="text"
                value={socialAccounts.twitter}
                onChange={(e) => handleSocialChange('twitter', e.target.value)}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                  isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                }`}
                placeholder="@username"
              />
            </div>

            {/* Instagram */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center space-x-2">
                <FiInstagram className="text-pink-400 w-5 h-5" />
                <span>Instagram</span>
              </label>
              <input
                type="text"
                value={socialAccounts.instagram}
                onChange={(e) => handleSocialChange('instagram', e.target.value)}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                  isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                }`}
                placeholder="@username"
              />
            </div>

            {/* GitHub */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center space-x-2">
                <FiGithub className="text-gray-400 w-5 h-5" />
                <span>GitHub</span>
              </label>
              <input
                type="text"
                value={socialAccounts.github}
                onChange={(e) => handleSocialChange('github', e.target.value)}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                  isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                }`}
                placeholder="username"
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center space-x-2">
                <FiLinkedin className="text-blue-600 w-5 h-5" />
                <span>LinkedIn</span>
              </label>
              <input
                type="text"
                value={socialAccounts.linkedin}
                onChange={(e) => handleSocialChange('linkedin', e.target.value)}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                  isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                }`}
                placeholder="username"
              />
            </div>

            {isEditing && (
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                  className="px-6 py-2 bg-gaming-charcoal hover:bg-gaming-border text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="btn-gaming flex items-center space-x-2"
                >
                  <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSettingsForm;
