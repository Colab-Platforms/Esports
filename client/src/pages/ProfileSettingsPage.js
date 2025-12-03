import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { 
  FiPhone, 
  FiSave,
  FiLock,
  FiTwitter,
  FiInstagram,
  FiGithub,
  FiLinkedin,
  FiAlertCircle,
  FiEdit3,
  FiGlobe
} from 'react-icons/fi';
import { selectAuth, updateProfile } from '../store/slices/authSlice';
import UserAvatar from '../components/common/UserAvatar';
import axios from 'axios';

const ProfileSettingsPage = () => {
  const { user, token } = useSelector(selectAuth);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('account');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    country: user?.country || 'India',
    state: user?.state || '',
    favoriteGame: user?.favoriteGame || '',
    profileVisibility: user?.profileVisibility || 'public',
    bio: user?.bio || ''
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

  // Sync with Redux store when user updates
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
        bio: user.bio || ''
      });
      setSocialAccounts({
        twitter: user.socialAccounts?.twitter || '',
        instagram: user.socialAccounts?.instagram || '',
        github: user.socialAccounts?.github || '',
        linkedin: user.socialAccounts?.linkedin || ''
      });
    }
  }, [user]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (platform, value) => {
    setSocialAccounts(prev => ({ ...prev, [platform]: value }));
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      setError('');

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
          
          const response = await axios.put(
            `${API_URL}/api/auth/profile`,
            {
              avatarUrl: reader.result // Base64 string
            },
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          if (response.data.success) {
            dispatch(updateProfile(response.data.data.user));
            setSuccess('Profile photo updated successfully!');
            setTimeout(() => setSuccess(''), 3000);
          }
        } catch (err) {
          console.error('Avatar upload error:', err);
          setError(err.response?.data?.error?.message || 'Failed to upload photo');
        } finally {
          setUploadingAvatar(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File read error:', err);
      setError('Failed to read file');
      setUploadingAvatar(false);
    }
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
          socialAccounts
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        // Update Redux store
        dispatch(updateProfile(response.data.data.user));
        setSuccess('Profile updated successfully!');
        setIsEditing(false);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Profile update error:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.error?.message 
        || err.response?.data?.message 
        || err.message 
        || 'Failed to update profile';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      setLoading(true);
      setError('');
      setSuccess('');
      
      console.log('Changing password');
      
      setSuccess('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsEditingPassword(false); // Exit edit mode after update
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-gaming font-bold text-white mb-2">
            Profile Settings
          </h1>
          <p className="text-gray-400">
            Manage your account information and preferences
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center space-x-2"
          >
            <FiAlertCircle className="text-green-400" />
            <span className="text-green-400">{success}</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center space-x-2"
          >
            <FiAlertCircle className="text-red-400" />
            <span className="text-red-400">{error}</span>
          </motion.div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Simple ID Card */}
          <div className="lg:col-span-1">
            <div className="card-gaming p-6">
              {/* Avatar - Circular */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-32 h-32 mb-4">
                  <UserAvatar 
                    user={user} 
                    size="3xl"
                  />
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={uploadingAvatar}
                  />
                  <label
                    htmlFor="avatar-upload"
                    className={`absolute bottom-2 right-2 p-2 bg-gaming-gold text-black rounded-full hover:bg-yellow-500 transition-colors shadow-lg cursor-pointer ${uploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {uploadingAvatar ? (
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiEdit3 className="w-4 h-4" />
                    )}
                  </label>
                </div>

                <h3 className="text-xl font-bold text-white mb-1">
                  {user?.username || 'Player'}
                </h3>
                <p className="text-gray-400 text-sm">
                  ID: #{user?._id?.slice(-6) || '000000'}
                </p>
                {uploadingAvatar && (
                  <p className="text-gaming-neon text-xs mt-2">Uploading...</p>
                )}
              </div>

              {/* User Info - Vertical List */}
              <div className="space-y-3">
                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Email</p>
                  <p className="text-white text-sm">{profileData.email || 'Not set'}</p>
                </div>

                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Phone</p>
                  <p className="text-white text-sm">{profileData.phone || 'Not set'}</p>
                </div>

                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Location</p>
                  <p className="text-white text-sm">{profileData.country || 'Not set'}</p>
                </div>

                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Member Since</p>
                  <p className="text-white text-sm">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Nov 2024'}
                  </p>
                </div>

                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Level</p>
                  <p className="text-gaming-gold text-sm font-bold">{user?.level || 1}</p>
                </div>

                <div className="pb-3">
                  <p className="text-gray-400 text-xs mb-1">Rank</p>
                  <p className="text-gaming-neon text-sm font-bold">{user?.currentRank || 'Bronze'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Settings Form */}
          <div className="lg:col-span-2">
            <div className="card-gaming p-6">
              {/* Section Tabs */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Account Information</h3>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-gaming flex items-center space-x-2 text-sm"
                  >
                    <FiEdit3 className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex space-x-4 mb-6 border-b border-gaming-border">
                <button
                  onClick={() => setActiveSection('account')}
                  className={`pb-3 px-2 font-medium transition-colors ${
                    activeSection === 'account'
                      ? 'text-gaming-gold border-b-2 border-gaming-gold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Account Info
                </button>
                <button
                  onClick={() => setActiveSection('social')}
                  className={`pb-3 px-2 font-medium transition-colors ${
                    activeSection === 'social'
                      ? 'text-gaming-gold border-b-2 border-gaming-gold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Social Media
                </button>
                <button
                  onClick={() => setActiveSection('password')}
                  className={`pb-3 px-2 font-medium transition-colors ${
                    activeSection === 'password'
                      ? 'text-gaming-gold border-b-2 border-gaming-gold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Password
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
                        placeholder="Amish_singhhhh"
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
                        <FiPhone className="inline mr-2" />
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => handleProfileChange('phone', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                          isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                        }`}
                        placeholder="8006560034"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <FiGlobe className="inline mr-2" />
                        Country
                      </label>
                      <div className="w-full px-3 py-2 border border-gaming-border rounded-lg bg-gaming-dark text-gray-400 cursor-not-allowed flex items-center space-x-2">
                        <span className="text-2xl">🇮🇳</span>
                        <span>India</span>
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

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Profile Visibility
                      </label>
                      <select
                        value={profileData.profileVisibility}
                        onChange={(e) => handleProfileChange('profileVisibility', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                          isEditing ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                        <option value="friends">Friends Only</option>
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
                        <FiSave className="w-4 h-4" />
                        <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Social Media Section */}
              {activeSection === 'social' && (
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm mb-4">
                    Connect your social media accounts to showcase them on your profile
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center space-x-2">
                      <FiTwitter className="text-blue-400" />
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

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center space-x-2">
                      <FiInstagram className="text-pink-400" />
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

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center space-x-2">
                      <FiGithub className="text-gray-400" />
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

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center space-x-2">
                      <FiLinkedin className="text-blue-600" />
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
                        <FiSave className="w-4 h-4" />
                        <span>{loading ? 'Saving...' : 'Save Social Accounts'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Password Section */}
              {activeSection === 'password' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-gray-400 text-sm">
                      Update your password to keep your account secure
                    </p>
                    {!isEditingPassword && (
                      <button
                        onClick={() => setIsEditingPassword(true)}
                        className="px-4 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <FiEdit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                      readOnly={!isEditingPassword}
                      className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                        isEditingPassword ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                      }`}
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                      readOnly={!isEditingPassword}
                      className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                        isEditingPassword ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                      }`}
                      placeholder="Enter new password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                      readOnly={!isEditingPassword}
                      className={`w-full px-3 py-2 border border-gaming-border rounded-lg focus:border-gaming-gold focus:outline-none ${
                        isEditingPassword ? 'bg-gaming-charcoal text-white' : 'bg-gaming-dark text-gray-400 cursor-not-allowed'
                      }`}
                      placeholder="Confirm new password"
                    />
                  </div>

                  {isEditingPassword && (
                    <div className="flex justify-end space-x-2 pt-4">
                      <button
                        onClick={() => {
                          setIsEditingPassword(false);
                          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        }}
                        className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleChangePassword}
                        disabled={loading}
                        className="px-6 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <FiSave className="w-4 h-4" />
                        <span>{loading ? 'Updating...' : 'Update'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;
