import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

const GamesManagement = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    fullName: '',
    description: '',
    icon: '',
    isActive: true,
    featured: false,
    order: 1
  });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const response = await fetch(`${API_URL}/api/games`);
      const data = await response.json();
      
      // Handle new response format
      const gamesData = data.data?.games || data;
      setGames(gamesData);
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
      const url = editingGame 
        ? `${API_URL}/api/games/${editingGame.id}`
        : `${API_URL}/api/games`;
      
      const method = editingGame ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingGame ? 'Game updated!' : 'Game created!');
        fetchGames();
        resetForm();
      } else {
        toast.error('Failed to save game');
      }
    } catch (error) {
      toast.error('Error saving game');
    }
  };

  const handleEdit = (game) => {
    setEditingGame(game);
    setFormData({
      id: game.id,
      name: game.name,
      fullName: game.fullName || '',
      description: game.description || '',
      icon: game.icon,
      isActive: game.isActive,
      featured: game.featured,
      order: game.order
    });
    setShowForm(true);
  };

  const handleDelete = async (gameId) => {
    if (!window.confirm('Delete this game?')) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/api/games/${gameId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Game deleted!');
        fetchGames();
      }
    } catch (error) {
      toast.error('Error deleting game');
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      fullName: '',
      description: '',
      icon: '',
      isActive: true,
      featured: false,
      order: 1
    });
    setEditingGame(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-gold"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-gaming font-bold text-white mb-2">Games Management</h1>
            <p className="text-gray-400">Add and manage games on your platform</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-gaming flex items-center space-x-2"
          >
            <FiPlus className="h-5 w-5" />
            <span>Add Game</span>
          </button>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {games.map((game) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-gaming p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{game.icon}</div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(game)}
                    className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    <FiEdit2 className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={() => handleDelete(game.id)}
                    className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    <FiTrash2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{game.name}</h3>
              <p className="text-gray-400 text-sm mb-3">{game.fullName}</p>
              <div className="flex items-center space-x-2">
                {game.featured && (
                  <span className="px-2 py-1 bg-gaming-gold text-black text-xs font-bold rounded">
                    Featured
                  </span>
                )}
                <span className={`px-2 py-1 text-xs font-bold rounded ${
                  game.isActive ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                }`}>
                  {game.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gaming-slate rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingGame ? 'Edit Game' : 'Add New Game'}
                </h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-white">
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Game ID *
                    </label>
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) => setFormData({...formData, id: e.target.value})}
                      className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white"
                      placeholder="bgmi"
                      required
                      disabled={editingGame}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Short Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white"
                      placeholder="BGMI"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white"
                    placeholder="Battlegrounds Mobile India"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white"
                    rows="3"
                    placeholder="Battle Royale mobile game"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Icon (Emoji) *
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({...formData, icon: e.target.value})}
                      className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white text-2xl"
                      placeholder="🎮"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({...formData, order: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white"
                      min="1"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-300">Active</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({...formData, featured: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-300">Featured</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gaming-gold hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <FiSave className="h-4 w-4" />
                    <span>{editingGame ? 'Update' : 'Create'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamesManagement;
