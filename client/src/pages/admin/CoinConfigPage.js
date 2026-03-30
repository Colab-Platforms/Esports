import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiPlus, FiTrash2, FiClock } from 'react-icons/fi';
import api from '../../services/api';

const CoinConfigPage = () => {
  const [configs, setConfigs] = useState([]);
  const [multipliers, setMultipliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [showMultiplierForm, setShowMultiplierForm] = useState(false);
  const [newMultiplier, setNewMultiplier] = useState({
    name: '',
    multiplier: 1.5,
    startTime: '18:00',
    endTime: '22:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  });

  useEffect(() => {
    fetchConfigs();
    fetchMultipliers();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/coin/coin-config');
      if (response.success) {
        let fetchedConfigs = response.data.configs;
        
        // Ensure core referral configs are always present in the UI
        const essentialReferralConfigs = [
          { key: 'referral_reward', description: 'Referral Reward (Referrer Gets)', category: 'referral', value: 50 },
          { key: 'referee_referral_bonus', description: 'Referral Bonus (Referee Gets)', category: 'referral', value: 50 }
        ];

        essentialReferralConfigs.forEach(essential => {
          if (!fetchedConfigs.find(c => c.key === essential.key)) {
            fetchedConfigs.push({
              ...essential,
              _id: `temp_${essential.key}`,
              isTemporary: true
            });
          }
        });

        setConfigs(fetchedConfigs);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
      alert('Failed to fetch configurations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMultipliers = async () => {
    try {
      const response = await api.get('/api/admin/coin/multiplier');
      if (response.success) {
        setMultipliers(response.data.multipliers);
      }
    } catch (error) {
      console.error('Error fetching multipliers:', error);
    }
  };

  const handleUpdateConfig = async (key, value) => {
    try {
      setSaving(key);
      const config = configs.find(c => c.key === key);
      const response = await api.put(`/api/admin/coin/coin-config/${key}`, { 
        value,
        description: config?.description,
        category: config?.category
      });
      if (response.success) {
        alert('Configuration updated successfully');
        fetchConfigs();
      }
    } catch (error) {
      alert(error.response?.data?.error?.message || 'Failed to update configuration');
    } finally {
      setSaving(null);
    }
  };

  const handleAddMultiplier = async () => {
    try {
      const response = await api.post('/api/admin/coin/multiplier', newMultiplier);
      if (response.success) {
        alert('Multiplier added successfully');
        setShowMultiplierForm(false);
        setNewMultiplier({
          name: '',
          multiplier: 1.5,
          startTime: '18:00',
          endTime: '22:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        });
        fetchMultipliers();
      }
    } catch (error) {
      alert(error.response?.data?.error?.message || 'Failed to add multiplier');
    }
  };

  const handleDeleteMultiplier = async (id) => {
    if (!window.confirm('Delete this multiplier?')) return;

    try {
      const response = await api.delete(`/api/admin/coin/multiplier/${id}`);
      if (response.success) {
        alert('Multiplier deleted successfully');
        fetchMultipliers();
      }
    } catch (error) {
      alert('Failed to delete multiplier');
    }
  };

  const handleInitDefaults = async () => {
    if (!window.confirm('Initialize default coin configurations? This will not overwrite existing configs.')) return;

    try {
      const response = await api.post('/api/admin/coin/coin-config/init');
      if (response.success) {
        alert('Default configurations initialized');
        fetchConfigs();
      }
    } catch (error) {
      alert('Failed to initialize defaults');
    }
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = [];
    }
    acc[config.category].push(config);
    return acc;
  }, {});

  const categoryLabels = {
    earning: '💰 Earning',
    tournament: '🏆 Tournament',
    referral: '🎁 Referral Program',
    bonus: '⭐ Extra Bonuses'
  };

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center space-x-2 text-gaming-gold hover:text-yellow-400 mb-4"
            >
              <FiArrowLeft />
              <span>Back to Admin</span>
            </Link>
            <h1 className="text-3xl font-gaming font-bold text-white mb-2">
              ⚙️ Coin Configuration
            </h1>
            <p className="text-gray-400">
              Manage coin rewards and multipliers
            </p>
          </div>
          
          <button
            onClick={handleInitDefaults}
            className="btn-gaming"
          >
            Initialize Defaults
          </button>
        </div>

        {/* Coin Configurations */}
        <div className="space-y-6 mb-8">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : Object.keys(groupedConfigs).length === 0 ? (
            <div className="card-gaming p-8 text-center">
              <p className="text-gray-400 mb-4">No configurations found</p>
              <button onClick={handleInitDefaults} className="btn-gaming">
                Initialize Default Configs
              </button>
            </div>
          ) : (
            Object.entries(groupedConfigs).map(([category, categoryConfigs]) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-gaming p-6"
              >
                <h3 className="text-xl font-bold text-white mb-4">
                  {categoryLabels[category] || category}
                </h3>
                
                <div className="space-y-4">
                  {categoryConfigs.map((config) => (
                    <div
                      key={config._id}
                      className="flex items-center justify-between p-4 bg-gaming-charcoal rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-white font-medium mb-1">
                          {config.description || config.key}
                        </p>
                        <p className="text-sm text-gray-400">
                          Key: {config.key}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <input
                          type="number"
                          min="0"
                          value={config.value}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            const newConfigs = configs.map(c =>
                              c.key === config.key ? { ...c, value: val } : c
                            );
                            setConfigs(newConfigs);
                          }}
                          className="w-24 px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                        />
                        
                        <button
                          onClick={() => handleUpdateConfig(config.key, config.value)}
                          disabled={saving === config.key}
                          className="btn-gaming flex items-center space-x-2"
                        >
                          <FiSave className="w-4 h-4" />
                          <span>{saving === config.key ? 'Saving...' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Time Multipliers */}
        <div className="card-gaming p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              ⏰ Time-Based Multipliers
            </h3>
            <button
              onClick={() => setShowMultiplierForm(!showMultiplierForm)}
              className="btn-gaming flex items-center space-x-2"
            >
              <FiPlus className="w-4 h-4" />
              <span>Add Multiplier</span>
            </button>
          </div>

          {/* Add Multiplier Form */}
          {showMultiplierForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-4 bg-gaming-charcoal rounded-lg"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={newMultiplier.name}
                    onChange={(e) => setNewMultiplier({ ...newMultiplier, name: e.target.value })}
                    placeholder="e.g., Evening Boost"
                    className="w-full px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={newMultiplier.multiplier}
                    onChange={(e) => setNewMultiplier({ ...newMultiplier, multiplier: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={newMultiplier.startTime}
                    onChange={(e) => setNewMultiplier({ ...newMultiplier, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">End Time</label>
                  <input
                    type="time"
                    value={newMultiplier.endTime}
                    onChange={(e) => setNewMultiplier({ ...newMultiplier, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Active Days</label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      onClick={() => {
                        const days = newMultiplier.days.includes(day)
                          ? newMultiplier.days.filter(d => d !== day)
                          : [...newMultiplier.days, day];
                        setNewMultiplier({ ...newMultiplier, days });
                      }}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        newMultiplier.days.includes(day)
                          ? 'bg-gaming-gold text-black'
                          : 'bg-gaming-dark text-gray-400 hover:text-white'
                      }`}
                    >
                      {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowMultiplierForm(false)}
                  className="px-4 py-2 bg-gaming-dark text-white rounded-lg hover:bg-gaming-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMultiplier}
                  className="btn-gaming"
                >
                  Add Multiplier
                </button>
              </div>
            </motion.div>
          )}

          {/* Multipliers List */}
          {multipliers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No multipliers configured
            </div>
          ) : (
            <div className="space-y-3">
              {multipliers.map((multiplier, index) => (
                <motion.div
                  key={multiplier._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-gaming-charcoal rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gaming-dark rounded-lg">
                      <FiClock className="text-gaming-gold" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{multiplier.name}</p>
                      <p className="text-sm text-gray-400">
                        {multiplier.startTime} - {multiplier.endTime} • {multiplier.multiplier}x
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {multiplier.days.map((day) => (
                          <span
                            key={day}
                            className="px-2 py-0.5 bg-gaming-gold/20 text-gaming-gold text-xs rounded"
                          >
                            {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteMultiplier(multiplier._id)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoinConfigPage;
