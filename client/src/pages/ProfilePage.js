import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiPhone, FiCamera, FiSave, FiEdit3, FiUpload } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { selectAuth } from '../store/slices/authSlice';
import UserAvatar from '../components/common/UserAvatar';
import CustomDropdown from '../components/common/CustomDropdown';
import api from '../services/api';

const ProfilePage = () => {
  const { user } = useSelector(selectAuth);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    bio: '',
    country: '',
    favoriteGame: '',
    profileVisibility: 'public'
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        country: user.country || '',
        favoriteGame: user.favoriteGame || '',
        profileVisibility: user.profileVisibility || 'public'
      });
      setAvatarPreview(user.avatarUrl || '');
    }
  }, [user]);

  const countryOptions = [
    { value: 'IN', label: 'India', icon: '🇮🇳' },
    { value: 'US', label: 'United States', icon: '🇺🇸' },
    { value: 'UK', label: 'United Kingdom', icon: '🇬🇧' },
    { value: 'CA', label: 'Canada', icon: '🇨🇦' },
    { value: 'AU', label: 'Australia', icon: '🇦🇺' },
    { value: 'DE', label: 'Germany', icon: '🇩🇪' },
    { value: 'FR', label: 'France', icon: '🇫🇷' },
    { value: 'JP', label: 'Japan', icon: '🇯🇵' },
    { value: 'KR', label: 'South Korea', icon: '🇰🇷' },
    { value: 'BR', label: 'Brazil', icon: '🇧🇷' }
  ];

  const gameOptions = [
    { value: 'bgmi', label: 'BGMI', icon: '🎮' },
    { value: 'cs2', label: 'Counter-Strike 2', icon: '⚡' },
    { value: 'valorant', label: 'Valorant', icon: '🎯' },
    { value: 'pubg', label: 'PUBG', icon: '🔫' },
    { value: 'cod', label: 'Call of Duty', icon: '💥' },
    { value: 'apex', label: 'Apex Legends', icon: '🏆' }
  ];

  const visibilityOptions = [
    { value: 'public', label: 'Public', description: 'Visible to everyone' },
    { value: 'friends', label: 'Friends Only', description: 'Visible to friends only' },
    { value: 'private', label: 'Private', description: 'Only visible to you' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Avatar file size must be less than 5MB');
        return;
      }
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setAvatarPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData = new FormData();
      
      // Add form data
      Object.keys(formData).forEach(key => {
        updateData.append(key, formData[key]);
      });

      // Add avatar if selected
      if (avatarFile) {
        updateData.append('avatar', avatarFile);
      }

      const response = await api.updateProfile(updateData);
      
      if (response.success) {
        setSuccess('Profile updated successfully!');
        setIsEditing(false);
        setAvatarFile(null);
        
        // Refresh user data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg-primary py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-gaming font-bold text-theme-text-primary mb-4">
            Profile Settings
          </h1>
          <p className="text-xl text-theme-text-secondary max-w-2xl mx-auto">
            Manage your account information and preferences
          </p>
        </motion.div>

        {/* Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6"
          >
            <div className="flex items-center text-red-400">
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6"
          >
            <div className="flex items-center text-green-400">
              <span>{success}</span>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Avatar Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6 text-center">
              <h2 className="text-xl font-bold text-theme-text-primary mb-6">Profile Picture</h2>
              
              <div className="relative inline-block mb-6">
                <div className="w-32 h-32 mx-auto">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover border-4 border-gaming-gold"
                    />
                  ) : (
                    <UserAvatar user={user} size="2xl" />
                  )}
                </div>
                
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-gaming-gold hover:bg-gaming-gold/80 text-gaming-dark p-2 rounded-full cursor-pointer transition-colors">
                    <FiCamera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-theme-text-secondary">Level:</span>
                  <span className="text-gaming-gold font-semibold">{user?.level || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-text-secondary">Rank:</span>
                  <span className="text-theme-text-primary">{user?.currentRank || 'Unranked'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-text-secondary">Earnings:</span>
                  <span className="text-green-400">₹{user?.totalEarnings || 0}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Profile Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-theme-text-primary">Account Information</h2>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gaming-gold hover:bg-gaming-gold/80 text-gaming-dark rounded-lg transition-colors"
                >
                  <FiEdit3 className="h-4 w-4" />
                  <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                      Username *
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-muted h-5 w-5" />
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full pl-10 pr-4 py-3 bg-theme-bg-primary border border-theme-border rounded-lg text-theme-text-primary focus:border-gaming-gold focus:outline-none disabled:opacity-50"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                      Email *
                    </label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-muted h-5 w-5" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full pl-10 pr-4 py-3 bg-theme-bg-primary border border-theme-border rounded-lg text-theme-text-primary focus:border-gaming-gold focus:outline-none disabled:opacity-50"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-muted h-5 w-5" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full pl-10 pr-4 py-3 bg-theme-bg-primary border border-theme-border rounded-lg text-theme-text-primary focus:border-gaming-gold focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Country */}
                  <div>
                    <CustomDropdown
                      label="Country"
                      options={countryOptions}
                      value={formData.country}
                      onChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                      placeholder="Select your country"
                      disabled={!isEditing}
                      searchable
                    />
                  </div>

                  {/* Favorite Game */}
                  <div>
                    <CustomDropdown
                      label="Favorite Game"
                      options={gameOptions}
                      value={formData.favoriteGame}
                      onChange={(value) => setFormData(prev => ({ ...prev, favoriteGame: value }))}
                      placeholder="Select your favorite game"
                      disabled={!isEditing}
                    />
                  </div>

                  {/* Profile Visibility */}
                  <div>
                    <CustomDropdown
                      label="Profile Visibility"
                      options={visibilityOptions}
                      value={formData.profileVisibility}
                      onChange={(value) => setFormData(prev => ({ ...prev, profileVisibility: value }))}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                    Bio
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    rows={4}
                    className="w-full px-4 py-3 bg-theme-bg-primary border border-theme-border rounded-lg text-theme-text-primary focus:border-gaming-gold focus:outline-none disabled:opacity-50 resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                {/* Submit Button */}
                {isEditing && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center space-x-2 px-6 py-3 bg-gaming-gold hover:bg-gaming-gold/80 text-gaming-dark rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gaming-dark"></div>
                      ) : (
                        <FiSave className="h-4 w-4" />
                      )}
                      <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                )}
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;