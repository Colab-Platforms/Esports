import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';

const CreateTeamModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    game: 'bgmi',
    description: '',
    maxMembers: 5,
    privacy: 'public'
  });

  const games = [
    { id: 'bgmi', name: 'BGMI', maxMembers: 4 },
    { id: 'cs2', name: 'CS2', maxMembers: 5 },
    { id: 'valorant', name: 'Valorant', maxMembers: 5 }
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-set max members based on game
    if (field === 'game') {
      const selectedGame = games.find(g => g.id === value);
      setFormData(prev => ({ ...prev, maxMembers: selectedGame.maxMembers }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gaming-dark border border-gaming-border rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gaming-border">
          <h2 className="text-white text-xl font-bold">Create New Team</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Team Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              minLength={3}
              maxLength={30}
              className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none"
              placeholder="Enter team name"
            />
          </div>

          {/* Team Tag */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Team Tag (Optional)
            </label>
            <input
              type="text"
              value={formData.tag}
              onChange={(e) => handleChange('tag', e.target.value.toUpperCase())}
              minLength={2}
              maxLength={5}
              className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none uppercase"
              placeholder="e.g., PRO, GG"
            />
            <p className="text-gray-500 text-xs mt-1">2-5 characters</p>
          </div>

          {/* Game */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Game *
            </label>
            <select
              value={formData.game}
              onChange={(e) => handleChange('game', e.target.value)}
              required
              className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none"
            >
              {games.map(game => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              maxLength={200}
              rows={3}
              className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none resize-none"
              placeholder="Tell others about your team..."
            />
            <p className="text-gray-500 text-xs mt-1">
              {formData.description.length}/200 characters
            </p>
          </div>

          {/* Max Members */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Members
            </label>
            <select
              value={formData.maxMembers}
              onChange={(e) => handleChange('maxMembers', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none"
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          {/* Privacy */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Privacy
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="public"
                  checked={formData.privacy === 'public'}
                  onChange={(e) => handleChange('privacy', e.target.value)}
                  className="text-gaming-gold focus:ring-gaming-gold"
                />
                <span className="text-white">Public</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="private"
                  checked={formData.privacy === 'private'}
                  onChange={(e) => handleChange('privacy', e.target.value)}
                  className="text-gaming-gold focus:ring-gaming-gold"
                />
                <span className="text-white">Private</span>
              </label>
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
              className="flex-1 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg font-medium transition-colors"
            >
              Create Team
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateTeamModal;
