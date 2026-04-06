import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useClan } from '../../contexts/ClanContext';

const ClanCreate = () => {
  const navigate = useNavigate();
  const { refreshMyClan, myClan, isLoading } = useClan();
  const fileInputRef = useRef(null);
  
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState({});

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
    reset
  } = useForm({
    defaultValues: {
      name: '',
      tag: '',
      game: 'Other',
      description: '',
      visibility: 'public',
      maxMembers: 100
    }
  });

  const descriptionValue = watch('description');
  const tagValue = watch('tag');

  // Handle avatar file selection
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Remove avatar
  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload avatar to server
  const uploadAvatar = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.url || response.data?.url;
    } catch (error) {
      console.error('Avatar upload error:', error);
      throw new Error('Failed to upload avatar');
    }
  };

  // Handle form submission
  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      setApiErrors({});

      // Prepare clan data
      const clanData = {
        name: data.name.trim(),
        tag: data.tag.trim().toUpperCase() || null,
        game: data.game,
        description: data.description.trim(),
        visibility: data.visibility,
        maxMembers: parseInt(data.maxMembers)
      };

      // Upload avatar if provided
      if (avatarFile) {
        try {
          const avatarUrl = await uploadAvatar(avatarFile);
          clanData.avatar = avatarUrl;
        } catch (error) {
          toast.error('Failed to upload avatar. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      // Create clan
      const response = await api.post('/api/clans', clanData);

      if (response.success) {
        const newClanId = response.data.clan._id;
        toast.success('🎉 Clan created successfully!');
        
        // Reset form
        reset();
        handleRemoveAvatar();
        
        // Refresh clan context BEFORE navigating so navbar updates immediately
        await refreshMyClan();
        
        // Small delay to ensure context is updated before navigating
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to clan chat after context is updated
        navigate(`/clans/${newClanId}/chat`);
      }
    } catch (error) {
      console.error('Clan creation error:', error);

      // Handle API errors
      if (error.response?.data?.details) {
        const fieldErrors = {};
        error.response.data.details.forEach((err) => {
          fieldErrors[err.param] = err.msg;
        });
        setApiErrors(fieldErrors);
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to create clan. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return null;

  if (myClan) {
    const clanData = myClan.clan || myClan;
    return (
      <div className="min-h-screen bg-gaming-dark py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-gaming-charcoal rounded-xl border border-gaming-border p-8 shadow-2xl text-center">
          <div className="text-6xl mb-6">🛡️</div>
          <h1 className="text-2xl font-gaming font-bold text-white mb-4">Already in a Clan</h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            You are already a member of <span className="text-gaming-gold font-bold">{clanData.name}</span>. 
            You must leave your current clan before you can create a new one.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/clans/${clanData._id}`)}
              className="w-full px-6 py-3 bg-gaming-gold hover:bg-yellow-500 text-black font-bold rounded-lg transition-all"
            >
              View My Clan
            </button>
            <button
              onClick={() => navigate('/clans')}
              className="w-full px-6 py-3 bg-gaming-dark border border-gaming-border text-white font-bold rounded-lg hover:border-gaming-gold transition-all"
            >
              Browse Other Clans
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Create Your Clan</h1>
          <p className="text-slate-400">Build your gaming community and recruit the best players</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Clan Name & Tag Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-white mb-2">
                  Clan Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter clan name"
                  {...register('name', {
                    required: 'Clan name is required',
                    minLength: { value: 3, message: 'Name must be at least 3 characters' },
                    maxLength: { value: 50, message: 'Name cannot exceed 50 characters' },
                    pattern: {
                      value: /^[a-zA-Z0-9\s\-_]+$/,
                      message: 'Name can only contain letters, numbers, spaces, hyphens, and underscores'
                    }
                  })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
                {errors.name && (
                  <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>
                )}
                {apiErrors.name && (
                  <p className="text-red-400 text-sm mt-1">{apiErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Tag <span className="text-slate-400 text-xs">(Max 5)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., APEX"
                  maxLength="5"
                  {...register('tag', {
                    minLength: { value: 2, message: 'Tag must be 2-5 characters' },
                    maxLength: { value: 5, message: 'Tag cannot exceed 5 characters' },
                    pattern: {
                      value: /^[a-zA-Z0-9]*$/,
                      message: 'Tag can only contain letters and numbers'
                    }
                  })}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setValue('tag', value);
                  }}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition uppercase"
                />
                {errors.tag && (
                  <p className="text-red-400 text-sm mt-1">{errors.tag.message}</p>
                )}
                {tagValue && (
                  <p className="text-slate-400 text-xs mt-1">Preview: [{tagValue}]</p>
                )}
              </div>
            </div>

            {/* Game Focus */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Game Focus <span className="text-red-500">*</span>
              </label>
              <select
                {...register('game', { required: 'Please select a game' })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              >
                <option value="Valorant">🎯 Valorant</option>
                <option value="CS2">🔫 CS2</option>
                <option value="Apex">🎮 Apex Legends</option>
                <option value="Other">🌐 Other</option>
              </select>
              {errors.game && (
                <p className="text-red-400 text-sm mt-1">{errors.game.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Description <span className="text-slate-400 text-xs">(Max 300 chars)</span>
              </label>
              <textarea
                placeholder="Tell us about your clan, playstyle, and what you're looking for in members..."
                rows="4"
                {...register('description', {
                  maxLength: { value: 300, message: 'Description cannot exceed 300 characters' }
                })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none"
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-slate-400 text-xs">
                  {descriptionValue.length}/300 characters
                </p>
                {errors.description && (
                  <p className="text-red-400 text-sm">{errors.description.message}</p>
                )}
              </div>
            </div>

            {/* Avatar Upload */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Clan Avatar <span className="text-slate-400 text-xs">(Optional)</span>
              </label>
              <div className="flex items-center gap-4">
                {/* Preview */}
                {avatarPreview ? (
                  <div className="relative">
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-16 h-16 rounded-full object-cover border-2 border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600 transition"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-700 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-400">
                    📷
                  </div>
                )}

                {/* Upload Button */}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white hover:bg-slate-600 transition font-medium"
                  >
                    {avatarPreview ? 'Change Image' : 'Upload Image'}
                  </button>
                  <p className="text-slate-400 text-xs mt-1">PNG, JPG, GIF up to 5MB</p>
                </div>
              </div>
            </div>

            {/* Visibility Options */}
            <div>
              <label className="block text-sm font-semibold text-white mb-3">
                Visibility <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3">
                {[
                  {
                    value: 'public',
                    label: '🌍 Public',
                    description: 'Anyone can find and join'
                  },
                  {
                    value: 'private',
                    label: '🔒 Private',
                    description: 'Visible but requires approval to join'
                  },
                  {
                    value: 'invite',
                    label: '🔐 Invite Only',
                    description: 'Hidden — join via invite link only'
                  }
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700 transition"
                  >
                    <input
                      type="radio"
                      value={option.value}
                      {...register('visibility')}
                      className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer"
                    />
                    <div className="ml-3 flex-1">
                      <p className="text-white font-medium">{option.label}</p>
                      <p className="text-slate-400 text-sm">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Max Members */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Max Members
              </label>
              <input
                type="number"
                min="2"
                max="1000"
                {...register('maxMembers', {
                  min: { value: 2, message: 'Minimum 2 members' },
                  max: { value: 1000, message: 'Maximum 1000 members' }
                })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              {errors.maxMembers && (
                <p className="text-red-400 text-sm mt-1">{errors.maxMembers.message}</p>
              )}
            </div>

            {/* Tips Section */}
            <div className="bg-slate-700 border border-slate-600 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">💡 Tips for Success</h3>
              <ul className="text-slate-300 text-sm space-y-1">
                <li>• Choose a memorable clan name that reflects your playstyle</li>
                <li>• Use a clear tag (2-5 characters) for easy identification</li>
                <li>• Write a compelling description to attract like-minded players</li>
                <li>• Start with a reasonable member limit and adjust as you grow</li>
              </ul>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate('/clans')}
                className="flex-1 px-6 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-semibold hover:bg-slate-600 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : '🚀 Create Clan'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-slate-400 text-sm">
          <p>Need help? Check out our <a href="#" className="text-blue-400 hover:underline">clan guidelines</a></p>
        </div>
      </div>
    </div>
  );
};

export default ClanCreate;
