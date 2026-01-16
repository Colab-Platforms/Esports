import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiSave, FiLock, FiGlobe } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';

const TeamManageModal = ({ team, onClose, onSuccess, token }) => {
  const [formData, setFormData] = useState({
    name: team.name,
    tag: team.tag,
    description: team.description || '',
    privacy: team.privacy || 'public'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.put(
        `${API_URL}/api/teams/${team._id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Team updated successfully! 🎉', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error updating team:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to update team', {
        duration: 3000,
        position: 'top-center'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gaming-card border border-gaming-border rounded-lg p-6 w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-bold">Manage Team</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team Name */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Team Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent"
              required
            />
          </div>

          {/* Team Tag */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Team Tag (3-5 characters)
            </label>
            <input
              type="text"
              name="tag"
              value={formData.tag}
              onChange={handleChange}
              maxLength="5"
              className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent resize-none"
              placeholder="Tell others about your team..."
            />
          </div>

          {/* Privacy */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Privacy
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, privacy: 'public' }))}
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                  formData.privacy === 'public'
                    ? 'bg-gaming-neon text-black'
                    : 'bg-gaming-dark border border-gaming-border text-gray-400 hover:text-white'
                }`}
              >
                <FiGlobe className="w-4 h-4" />
                <span>Public</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, privacy: 'private' }))}
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                  formData.privacy === 'private'
                    ? 'bg-gaming-neon text-black'
                    : 'bg-gaming-dark border border-gaming-border text-gray-400 hover:text-white'
                }`}
              >
                <FiLock className="w-4 h-4" />
                <span>Private</span>
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <FiSave className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default TeamManageModal;
