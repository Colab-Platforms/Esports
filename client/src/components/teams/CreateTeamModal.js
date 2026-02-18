import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSearch, FiUsers, FiUserPlus, FiEdit3, FiCheck, FiAlertCircle } from 'react-icons/fi';
import UserAvatar from '../common/UserAvatar';
import axios from 'axios';
import toast from 'react-hot-toast';

const GAMES = [
  { id: 'bgmi', name: 'BGMI', maxMembers: 4, fields: ['ign', 'uid'], labels: { ign: 'IGN Name', uid: 'BGMI UID' } },
  { id: 'cs2', name: 'CS2', maxMembers: 5, fields: ['steamId'], labels: { steamId: 'Steam ID' } },
  { id: 'valorant', name: 'Valorant', maxMembers: 5, fields: ['valorantId'], labels: { valorantId: 'Valorant ID' } },
  { id: 'freefire', name: 'Free Fire', maxMembers: 4, fields: ['ign', 'uid'], labels: { ign: 'IGN Name', uid: 'Free Fire UID' } }
];

const getGameInfoFromPlayer = (player, gameId) => {
  switch (gameId) {
    case 'bgmi':
      return {
        ign: player.bgmiIgnName || player.gameIds?.bgmi?.ign || '',
        uid: player.bgmiUid || player.gameIds?.bgmi?.uid || ''
      };
    case 'freefire':
      return {
        ign: player.freeFireIgnName || player.gameIds?.freefire?.ign || '',
        uid: player.freeFireUid || player.gameIds?.freefire?.uid || ''
      };
    case 'cs2':
      return {
        steamId: player.steamId || player.gameIds?.steam || ''
      };
    case 'valorant':
      return {
        valorantId: player.valorantId || player.gameIds?.valorant || ''
      };
    default:
      return {};
  }
};

const CreateTeamModal = ({ onClose, onCreate, token, fixedGame = null, editTeam = null }) => {
  const isEdit = !!editTeam;

  const [formData, setFormData] = useState({
    name: editTeam?.name || '',
    game: editTeam?.game || fixedGame || 'bgmi'
  });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const currentGame = GAMES.find(g => g.id === formData.game) || GAMES[0];
  const maxAddable = currentGame.maxMembers - 1;

  useEffect(() => {
    if (editTeam?.members) {
      const currentUserId = localStorage.getItem('userId');
      const otherMembers = editTeam.members.filter(m => {
        if (!m.userId) return false;
        const mid = m.userId._id || m.userId;
        return mid.toString() !== currentUserId?.toString();
      });
      const mapped = otherMembers.map(m => {
        const u = m.userId;
        const gameInfo = getGameInfoFromPlayer(u, editTeam.game);
        const hasAllInfo = currentGame.fields.every(f => gameInfo[f] && gameInfo[f].trim());
        return {
          _id: u._id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          gameIds: u.gameIds,
          bgmiIgnName: u.bgmiIgnName,
          bgmiUid: u.bgmiUid,
          freeFireIgnName: u.freeFireIgnName,
          freeFireUid: u.freeFireUid,
          gameInfo,
          hasAllInfo
        };
      });
      setSelectedMembers(mapped);
    }
  }, [editTeam]);

  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
        const response = await axios.get(`${API_URL}/api/users/players`, {
          params: { search: searchQuery },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          const players = response.data.data.players || [];
          const filtered = players.filter(
            player => !selectedMembers.some(m => m._id === player._id)
          );
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error('Error searching players:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedMembers, token]);

  const handleGameChange = (gameId) => {
    const game = GAMES.find(g => g.id === gameId);
    setFormData(prev => ({ ...prev, game: gameId }));
    const newMembers = selectedMembers.slice(0, game.maxMembers - 1).map(member => ({
      ...member,
      gameInfo: getGameInfoFromPlayer(member, gameId)
    }));
    setSelectedMembers(newMembers);
  };

  const handleAddMember = (player) => {
    if (selectedMembers.length >= maxAddable) {
      toast.error(`Team is full (${currentGame.maxMembers} players max)`, { position: 'top-center' });
      return;
    }
    const gameInfo = getGameInfoFromPlayer(player, formData.game);
    const hasAllInfo = currentGame.fields.every(f => gameInfo[f] && gameInfo[f].trim());
    setSelectedMembers(prev => [...prev, { ...player, gameInfo, hasAllInfo }]);
    setSearchResults(prev => prev.filter(p => p._id !== player._id));
    setSearchQuery('');
  };

  const handleRemoveMember = (playerId) => {
    setSelectedMembers(prev => prev.filter(m => m._id !== playerId));
    if (editingMember === playerId) setEditingMember(null);
  };

  const handleUpdateGameInfo = (playerId, field, value) => {
    setSelectedMembers(prev => prev.map(m => {
      if (m._id !== playerId) return m;
      const newGameInfo = { ...m.gameInfo, [field]: value };
      const hasAllInfo = currentGame.fields.every(f => newGameInfo[f] && newGameInfo[f].trim());
      return { ...m, gameInfo: newGameInfo, hasAllInfo };
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Team name is required', { position: 'top-center' });
      return;
    }
    onCreate({
      name: formData.name,
      game: formData.game,
      maxMembers: currentGame.maxMembers,
      memberIds: selectedMembers.map(m => m._id),
      membersGameInfo: selectedMembers.map(m => ({
        userId: m._id,
        username: m.username,
        ...m.gameInfo
      }))
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gaming-dark border border-gaming-border rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-gaming-border shrink-0">
          <h2 className="text-white text-xl font-bold">{isEdit ? 'Edit Team' : 'Create New Team'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Team Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              minLength={3}
              maxLength={30}
              className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none"
              placeholder="Enter team name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Game *</label>
            {(fixedGame || isEdit) ? (
              <div className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white">
                {currentGame.name}
              </div>
            ) : (
              <select
                value={formData.game}
                onChange={(e) => handleGameChange(e.target.value)}
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none"
              >
                {GAMES.map(game => (
                  <option key={game.id} value={game.id}>{game.name}</option>
                ))}
              </select>
            )}
            <p className="text-gray-500 text-xs mt-1">
              {currentGame.name} teams have {currentGame.maxMembers} players (including you)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Team Members ({1 + selectedMembers.length}/{currentGame.maxMembers})
            </label>

            <div className="space-y-2 mb-3">
              <div className="flex items-center space-x-3 px-3 py-2 bg-gaming-gold/10 border border-gaming-gold/30 rounded-lg">
                <div className="w-8 h-8 bg-gaming-gold/20 rounded-full flex items-center justify-center">
                  <FiUsers className="w-4 h-4 text-gaming-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">You (Captain)</p>
                </div>
                <span className="text-gaming-gold text-xs font-medium px-2 py-0.5 bg-gaming-gold/10 rounded">Captain</span>
              </div>

              <AnimatePresence>
                {selectedMembers.map((member) => (
                  <motion.div
                    key={member._id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-gaming-charcoal border border-gaming-border rounded-lg overflow-hidden"
                  >
                    <div className="flex items-center space-x-3 px-3 py-2">
                      <UserAvatar user={member} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{member.username}</p>
                        {member.hasAllInfo ? (
                          <p className="text-green-400 text-xs flex items-center space-x-1">
                            <FiCheck className="w-3 h-3" />
                            <span>
                              {currentGame.fields.map(f => member.gameInfo[f]).filter(Boolean).join(' | ')}
                            </span>
                          </p>
                        ) : (
                          <p className="text-yellow-400 text-xs flex items-center space-x-1">
                            <FiAlertCircle className="w-3 h-3" />
                            <span>Game info missing</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingMember(editingMember === member._id ? null : member._id)}
                          className={`p-1.5 rounded transition-colors ${
                            editingMember === member._id
                              ? 'bg-gaming-gold/20 text-gaming-gold'
                              : 'text-gray-400 hover:text-white hover:bg-gaming-dark'
                          }`}
                          title="Edit game info"
                        >
                          <FiEdit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member._id)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {editingMember === member._id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-gaming-border"
                        >
                          <div className="p-3 space-y-2">
                            {currentGame.fields.map(field => (
                              <div key={field}>
                                <label className="block text-xs text-gray-400 mb-1">
                                  {currentGame.labels[field]}
                                </label>
                                <input
                                  type="text"
                                  value={member.gameInfo[field] || ''}
                                  onChange={(e) => handleUpdateGameInfo(member._id, field, e.target.value)}
                                  placeholder={`Enter ${currentGame.labels[field]}`}
                                  className="w-full px-2.5 py-1.5 bg-gaming-dark border border-gaming-border rounded text-white text-sm focus:border-gaming-gold focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>

              {selectedMembers.length < maxAddable && (
                Array.from({ length: maxAddable - selectedMembers.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center space-x-3 px-3 py-2 border border-dashed border-gaming-border/50 rounded-lg">
                    <div className="w-8 h-8 bg-gaming-charcoal rounded-full flex items-center justify-center">
                      <FiUserPlus className="w-4 h-4 text-gray-500" />
                    </div>
                    <p className="text-gray-500 text-sm">Empty slot</p>
                  </div>
                ))
              )}
            </div>

            {selectedMembers.length < maxAddable && (
              <div className="relative">
                <FiSearch className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search players by username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gaming-gold"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gaming-gold"></div>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mt-2 bg-gaming-charcoal border border-gaming-border rounded-lg overflow-hidden max-h-52 overflow-y-auto"
                >
                  {searchResults.map((player) => {
                    const info = getGameInfoFromPlayer(player, formData.game);
                    const hasInfo = currentGame.fields.some(f => info[f] && info[f].trim());
                    return (
                      <button
                        key={player._id}
                        type="button"
                        onClick={() => handleAddMember(player)}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-gaming-dark transition-colors text-left border-b border-gaming-border/30 last:border-b-0"
                      >
                        <UserAvatar user={player} size="xs" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{player.username}</p>
                          {hasInfo ? (
                            <p className="text-gaming-neon text-xs truncate">
                              {currentGame.fields.map(f => info[f]).filter(Boolean).join(' | ')}
                            </p>
                          ) : (
                            <p className="text-gray-500 text-xs">No {currentGame.name} info on profile</p>
                          )}
                        </div>
                        <span className="text-gaming-gold text-xs font-medium shrink-0">+ Add</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {searchQuery.trim().length >= 1 && !searchLoading && searchResults.length === 0 && (
              <p className="mt-2 text-gray-500 text-xs text-center py-2">No players found for "{searchQuery}"</p>
            )}
          </div>
        </form>

        <div className="border-t border-gaming-border p-6 flex space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!formData.name.trim()}
            className="flex-1 py-2 bg-gaming-gold hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Create Team'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateTeamModal;
