import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import api from '../../services/api';

const emptyPlayer = () => ({ name: '', riotName: '', riotTag: '' });

const ValorantRegistrationForm = ({ tournament, onClose, onSuccess }) => {
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [teamName, setTeamName] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [captain, setCaptain] = useState({
    name: user?.username || '',
    riotName: '',
    riotTag: ''
  });
  const [players, setPlayers] = useState([emptyPlayer(), emptyPlayer(), emptyPlayer(), emptyPlayer()]);
  const [includeSubstitute, setIncludeSubstitute] = useState(false);
  const [substitute, setSubstitute] = useState(emptyPlayer());

  const updatePlayer = (index, field, value) => {
    setPlayers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const allRosterEntries = () => [
    { label: 'Captain', ...captain },
    ...players.map((p, i) => ({ label: `Player ${i + 2}`, ...p })),
    ...(includeSubstitute ? [{ label: 'Substitute', ...substitute }] : [])
  ];

  const validateForm = () => {
    if (!teamName.trim() || teamName.trim().length < 3) {
      setError('Team name must be at least 3 characters long');
      return false;
    }
    if (!phone.match(/^[6-9]\d{9}$/)) {
      setError('A valid Indian WhatsApp number is required');
      return false;
    }
    if (!captain.name.trim()) {
      setError('Captain name is required');
      return false;
    }
    if (!captain.riotName.trim() || !captain.riotTag.trim()) {
      setError('Captain Riot ID (name and tag) is required');
      return false;
    }

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.name.trim()) {
        setError(`Player ${i + 2} name is required`);
        return false;
      }
      if (!p.riotName.trim() || !p.riotTag.trim()) {
        setError(`Player ${i + 2} Riot ID (name and tag) is required`);
        return false;
      }
    }

    if (includeSubstitute) {
      const hasAny = substitute.name.trim() || substitute.riotName.trim() || substitute.riotTag.trim();
      if (hasAny) {
        if (!substitute.name.trim() || !substitute.riotName.trim() || !substitute.riotTag.trim()) {
          setError('Substitute must have a name and a complete Riot ID, or remove the substitute');
          return false;
        }
      }
    }

    // Duplicate Riot ID check within the roster (case/whitespace-insensitive)
    const entries = allRosterEntries().filter(e => e.riotName && e.riotTag);
    const keys = entries.map(e => `${e.riotName.trim().toLowerCase()}#${e.riotTag.trim().toLowerCase()}`);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      setError('All players must have unique Riot IDs (name#tag)');
      return false;
    }

    return true;
  };

  const toRiotId = (p) => ({ name: p.riotName.trim(), tag: p.riotTag.trim() });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const registrationData = {
        teamName: teamName.trim(),
        teamLeader: {
          name: captain.name.trim(),
          riotId: toRiotId(captain),
          phone
        },
        teamMembers: players.map(p => ({
          name: p.name.trim(),
          riotId: toRiotId(p)
        })),
        ...(includeSubstitute && substitute.name.trim() && {
          substitute: {
            name: substitute.name.trim(),
            riotId: toRiotId(substitute)
          }
        }),
        whatsappNumber: phone
      };

      const response = await api.post(`/api/valorant-registration/${tournament._id}/register`, registrationData);
      const responseData = response.data || response;
      const isSuccess = responseData?.success === true;

      if (isSuccess) {
        setSuccess(true);
        setTimeout(() => {
          const registration = responseData.data?.registration || responseData.registration;
          onSuccess && onSuccess(registration);
        }, 1800);
      } else {
        setError(responseData?.error?.message || responseData?.message || 'Registration failed');
      }
    } catch (err) {
      let errorMessage = 'Failed to register team';
      if (err.response?.data?.error?.details) {
        errorMessage = err.response.data.error.details.map(d => d.msg || d.message).join('\n');
      } else if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
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
        <div className="bg-gaming-dark border border-red-500 rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">Registration Successful!</h2>
          <p className="text-gray-300 mb-4">
            Team <span className="text-red-400 font-bold">{teamName}</span> has been registered for {tournament.name}.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            📱 WhatsApp confirmation sent to {phone}. Admin will verify your roster shortly.
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400 mx-auto"></div>
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
        className="bg-gaming-dark border border-gaming-slate rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col"
      >
        <div className="sticky top-0 bg-gaming-dark border-b border-gaming-slate p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <span className="text-3xl">🎯</span>
              <span>Register Team</span>
            </h2>
            <p className="text-gray-400">{tournament.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form id="valorant-registration-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <span className="text-red-400 font-medium whitespace-pre-line text-sm">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Team Name *</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter your team name"
                className="w-full px-4 py-3 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">WhatsApp Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit phone"
                className="w-full px-4 py-3 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Captain */}
          <div className="bg-gaming-charcoal rounded-lg p-4 space-y-3 border border-red-500/20">
            <h4 className="text-white font-bold flex items-center space-x-2">
              <span>👑</span>
              <span>Captain</span>
            </h4>
            <PlayerFields
              player={captain}
              onChange={(field, value) => setCaptain(prev => ({ ...prev, [field]: value }))}
            />
          </div>

          {/* Players 2-5 */}
          <div className="space-y-3">
            <h4 className="text-white font-bold flex items-center space-x-2">
              <span>👥</span>
              <span>Players (4 required)</span>
            </h4>
            {players.map((p, index) => (
              <div key={index} className="bg-gaming-charcoal rounded-lg p-4 space-y-3 border border-gaming-slate">
                <div className="text-sm font-semibold text-red-400">Player {index + 2}</div>
                <PlayerFields player={p} onChange={(field, value) => updatePlayer(index, field, value)} />
              </div>
            ))}
          </div>

          {/* Substitute */}
          <div className="bg-gaming-charcoal rounded-lg p-4 space-y-3 border border-gaming-slate">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-bold flex items-center space-x-2">
                <span>🔄</span>
                <span>Substitute (optional)</span>
              </h4>
              <label className="flex items-center space-x-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={includeSubstitute}
                  onChange={(e) => setIncludeSubstitute(e.target.checked)}
                />
                <span>Add substitute</span>
              </label>
            </div>
            {includeSubstitute && (
              <PlayerFields
                player={substitute}
                onChange={(field, value) => setSubstitute(prev => ({ ...prev, [field]: value }))}
              />
            )}
          </div>
        </form>

        <div className="border-t border-gaming-slate bg-gaming-dark p-3 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-gaming-slate text-white rounded hover:bg-gaming-charcoal transition-colors text-xs font-medium disabled:opacity-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="valorant-registration-form"
            className="px-4 py-1.5 bg-red-500 text-white font-medium rounded hover:bg-red-600 transition-colors disabled:opacity-50 text-xs whitespace-nowrap"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register Team'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const PlayerFields = ({ player, onChange }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">Full Name *</label>
      <input
        type="text"
        value={player.name}
        onChange={(e) => onChange('name', e.target.value)}
        placeholder="Player's full name"
        className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded text-white text-sm focus:border-red-500 focus:outline-none"
      />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">Riot ID Name *</label>
      <input
        type="text"
        value={player.riotName}
        onChange={(e) => onChange('riotName', e.target.value)}
        placeholder="e.g. TenZ"
        className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded text-white text-sm focus:border-red-500 focus:outline-none"
      />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">Riot ID Tag *</label>
      <input
        type="text"
        value={player.riotTag}
        onChange={(e) => onChange('riotTag', e.target.value.replace('#', ''))}
        placeholder="e.g. 1234"
        className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded text-white text-sm focus:border-red-500 focus:outline-none"
      />
    </div>
  </div>
);

export default ValorantRegistrationForm;
