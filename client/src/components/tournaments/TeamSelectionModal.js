import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiUsers, FiPlus, FiCheck, FiAward, FiPhone, FiEdit2, FiAlertTriangle } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, updateProfile } from '../../store/slices/authSlice';
import UserAvatar from '../common/UserAvatar';
import CreateTeamModal from '../teams/CreateTeamModal';
import axios from 'axios';
import toast from 'react-hot-toast';

const GAME_FIELDS = {
  bgmi: { idLabel: 'BGMI UID', nameLabel: 'BGMI IGN', idKey: 'bgmiId', nameKey: 'name' },
  freefire: { idLabel: 'Free Fire UID', nameLabel: 'Free Fire IGN', idKey: 'freeFireId', nameKey: 'name' },
  ff: { idLabel: 'Free Fire UID', nameLabel: 'Free Fire IGN', idKey: 'freeFireId', nameKey: 'name' },
  cs2: { idLabel: 'Steam ID', nameLabel: 'IGN', idKey: 'steamId', nameKey: 'name' },
  valorant: { idLabel: 'Valorant ID', nameLabel: 'IGN', idKey: 'valorantId', nameKey: 'name' },
};

const getGameInfo = (memberUser, gameType) => {
  const u = memberUser;
  if (!u) return { name: '', gameId: '' };

  switch (gameType) {
    case 'bgmi': {
      // Handle both new object format {ign, uid} and legacy fields
      const bgmi = u?.gameIds?.bgmi;
      const ignFromObj = typeof bgmi === 'object' ? bgmi?.ign : '';
      const uidFromObj = typeof bgmi === 'object' ? bgmi?.uid : (typeof bgmi === 'string' ? bgmi : '');
      return {
        name: ignFromObj || u?.bgmiIgnName || '',
        gameId: uidFromObj || u?.bgmiUid || ''
      };
    }
    case 'freefire':
    case 'ff': {
      const ff = u?.gameIds?.freefire;
      const ignFromObj = typeof ff === 'object' ? ff?.ign : '';
      const uidFromObj = typeof ff === 'object' ? ff?.uid : (typeof ff === 'string' ? ff : '');
      return {
        name: ignFromObj || u?.freeFireIgnName || '',
        gameId: uidFromObj || u?.freeFireUid || ''
      };
    }
    case 'cs2':
      return {
        name: '',
        gameId: u?.gameIds?.steam || u?.steamProfile?.steamId || ''
      };
    case 'valorant':
      return {
        name: '',
        gameId: typeof u?.gameIds?.valorant === 'string' ? u.gameIds.valorant : ''
      };
    default:
      return { name: '', gameId: '' };
  }
};

const TeamSelectionModal = ({ tournament, token, registering, onClose, onRegister }) => {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [memberEdits, setMemberEdits] = useState({});
  const [editingMemberId, setEditingMemberId] = useState(null);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  const gameType = tournament?.gameType;
  const needsPhone = gameType === 'bgmi' || gameType === 'freefire' || gameType === 'ff';
  const fields = GAME_FIELDS[gameType] || GAME_FIELDS.bgmi;

  const selectedTeam = useMemo(() => teams.find(t => t._id === selectedTeamId), [teams, selectedTeamId]);

  const currentUserId = user?._id || user?.id || localStorage.getItem('userId');

  const getMemberInfo = (member) => {
    const memberId = member.userId?._id || member.userId;
    const edited = memberEdits[memberId];
    if (edited) return edited;
    return getGameInfo(member.userId, gameType);
  };

  const isCaptain = (member) => {
    const memberId = member.userId?._id || member.userId;
    return memberId?.toString() === currentUserId?.toString();
  };

  const memberWarnings = useMemo(() => {
    if (!selectedTeam) return [];
    const warnings = [];
    const needsName = gameType !== 'cs2' && gameType !== 'valorant';
    selectedTeam.members?.forEach(m => {
      if (!m.userId) return;
      const info = getMemberInfo(m);
      const memberName = m.userId?.username || 'Unknown';
      const role = isCaptain(m) ? 'Team Leader' : 'Member';
      if (needsName && !info.name?.trim()) warnings.push(`${role} "${memberName}" is missing ${fields.nameLabel}`);
      if (!info.gameId?.trim()) warnings.push(`${role} "${memberName}" is missing ${fields.idLabel}`);
    });
    if (needsPhone && !/^[6-9]\d{9}$/.test(phoneNumber)) {
      warnings.push('Valid WhatsApp number is required');
    }
    return warnings;
  }, [selectedTeam, memberEdits, phoneNumber, needsPhone, fields, currentUserId, gameType]);

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    setMemberEdits({});
    setEditingMemberId(null);
  }, [selectedTeamId]);

  const fetchTeams = async (selectId = null) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/teams/my-teams?fresh=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const allTeams = response.data.data.teams || [];
        const filtered = allTeams.filter(t => t.game === gameType);
        setTeams(filtered);
        if (selectId) {
          const found = filtered.find(t => t._id === selectId);
          if (found) setSelectedTeamId(found._id);
        }
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCaptainProfile = async (game, captainGameInfo) => {
    if (!captainGameInfo || !game) return;
    try {
      const profilePayload = {};
      if (game === 'bgmi') {
        if (captainGameInfo.ign) profilePayload.bgmiIgnName = captainGameInfo.ign;
        if (captainGameInfo.uid) profilePayload.bgmiUid = captainGameInfo.uid;
      } else if (game === 'freefire' || game === 'ff') {
        if (captainGameInfo.ign) profilePayload.freeFireIgnName = captainGameInfo.ign;
        if (captainGameInfo.uid) profilePayload.freeFireUid = captainGameInfo.uid;
      } else if (game === 'valorant') {
        if (captainGameInfo.valorantId) profilePayload.gameIds = { valorant: captainGameInfo.valorantId };
      } else if (game === 'cs2') {
        if (captainGameInfo.steamId) profilePayload.gameIds = { steam: captainGameInfo.steamId };
      }
      if (Object.keys(profilePayload).length === 0) return;
      const res = await axios.put(`${API_URL}/api/auth/profile`, profilePayload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data?.data?.user) {
        dispatch(updateProfile(res.data.data.user));
        localStorage.setItem('user', JSON.stringify({
          ...JSON.parse(localStorage.getItem('user') || '{}'),
          ...res.data.data.user
        }));
      }
    } catch (err) {
      console.warn('Could not update captain profile from tournament modal:', err);
    }
  };

  const handleCreateTeam = async (teamData) => {
    const { captainGameInfo, ...payload } = teamData;
    try {
      const response = await axios.post(`${API_URL}/api/teams`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        toast.success('Team created!', {
          duration: 2000, position: 'top-center',
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid #FFD700' }
        });
        setShowCreateModal(false);
        const newTeamId = response.data.data.team?._id;
        // Update captain's profile with game info, then re-fetch with fresh populated data
        await updateCaptainProfile(payload.game, captainGameInfo);
        await fetchTeams(newTeamId);
      }
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to create team', {
        duration: 3000, position: 'top-center'
      });
    }
  };

  const handleEditMember = (memberId, field, value) => {
    setMemberEdits(prev => {
      const existing = prev[memberId] || {};
      return { ...prev, [memberId]: { ...existing, [field]: value } };
    });
  };

  const handleProceed = () => {
    if (!selectedTeam) {
      toast.error('Please select a team', { position: 'top-center' });
      return;
    }
    if (memberWarnings.length > 0) {
      toast.error(memberWarnings[0], { position: 'top-center', duration: 4000 });
      return;
    }
    onRegister(selectedTeam, phoneNumber, memberEdits);
  };

  if (showCreateModal) {
    return (
      <CreateTeamModal
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateTeam}
        token={token}
        fixedGame={gameType}
        currentUser={user}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gaming-dark border border-gaming-border rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-gaming-border shrink-0">
          <div>
            <h2 className="text-white text-xl font-bold">Select Your Team</h2>
            <p className="text-gray-400 text-sm mt-1">{tournament?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="bg-gaming-charcoal rounded-lg p-3 flex items-center space-x-3">
            <span className="text-2xl">
              {gameType === 'bgmi' ? '🎮' : gameType === 'cs2' ? '⚡' : gameType === 'valorant' ? '🎯' : '🔥'}
            </span>
            <div>
              <p className="text-white font-medium text-sm">{gameType?.toUpperCase()} Tournament</p>
              <p className="text-gray-400 text-xs">Choose a {gameType?.toUpperCase()} team or create a new one</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading your teams...</div>
          ) : teams.length > 0 ? (
            <div className="space-y-3">
              <p className="text-gray-300 text-sm font-medium">Your {gameType?.toUpperCase()} Teams</p>
              {teams.map((team) => {
                const isSelected = selectedTeamId === team._id;
                return (
                  <div key={team._id}>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedTeamId(isSelected ? null : team._id)}
                      className={`w-full p-4 rounded-lg transition-all text-left ${
                        isSelected
                          ? 'bg-gaming-gold/15 border-2 border-gaming-gold'
                          : 'bg-gaming-charcoal border border-gaming-border hover:border-gaming-gold/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gaming-gold/20 rounded-lg flex items-center justify-center">
                            <FiUsers className="w-5 h-5 text-gaming-gold" />
                          </div>
                          <div>
                            <h3 className="text-white font-bold">{team.name}</h3>
                            <p className="text-gray-400 text-xs">{team.members?.length}/{team.maxMembers} Members</p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 bg-gaming-gold rounded-full flex items-center justify-center">
                            <FiCheck className="w-4 h-4 text-black" />
                          </div>
                        )}
                      </div>
                      {!isSelected && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {team.members?.map((member) => (
                            member.userId && (
                              <div key={member.userId._id || member._id} className="flex items-center space-x-1 px-2 py-0.5 bg-gaming-dark rounded text-xs">
                                <UserAvatar user={member.userId} size="xs" />
                                <span className="text-gray-300">{member.userId.username}</span>
                                {member.role === 'captain' && <FiAward className="w-3 h-3 text-gaming-gold" />}
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </motion.button>

                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-2 bg-gaming-charcoal/50 rounded-lg p-3 border border-gaming-border">
                            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                              Team Roster — {fields.nameLabel} / {fields.idLabel}
                            </p>
                            {team.members?.map((member) => {
                              if (!member.userId) return null;
                              const memberId = member.userId._id || member.userId;
                              const info = getMemberInfo(member);
                              const isLeader = isCaptain(member);
                              const isEditing = editingMemberId === memberId;
                              const needsName = gameType !== 'cs2' && gameType !== 'valorant';
                              const missingName = needsName && !info.name?.trim();
                              const missingId = !info.gameId?.trim();
                              const hasMissingData = missingName || missingId;

                              return (
                                <div key={memberId} className={`rounded-lg p-3 ${hasMissingData ? 'bg-red-900/20 border border-red-500/30' : 'bg-gaming-dark'}`}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center space-x-2">
                                      <UserAvatar user={member.userId} size="xs" />
                                      <span className="text-white text-sm font-medium">{member.userId.username}</span>
                                      {isLeader && (
                                        <span className="text-[10px] bg-gaming-gold/20 text-gaming-gold px-1.5 py-0.5 rounded font-bold">LEADER</span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingMemberId(isEditing ? null : memberId);
                                        if (!isEditing && !memberEdits[memberId]) {
                                          setMemberEdits(prev => ({
                                            ...prev,
                                            [memberId]: { name: info.name, gameId: info.gameId }
                                          }));
                                        }
                                      }}
                                      className={`p-1.5 rounded transition-colors ${isEditing ? 'bg-gaming-gold/20 text-gaming-gold' : 'text-gray-500 hover:text-gaming-gold'}`}
                                    >
                                      <FiEdit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {isEditing ? (
                                    <div className="space-y-2 mt-2">
                                      {gameType !== 'cs2' && gameType !== 'valorant' && (
                                        <div>
                                          <label className="text-gray-500 text-[10px] uppercase tracking-wider">{fields.nameLabel}</label>
                                          <input
                                            type="text"
                                            value={memberEdits[memberId]?.name ?? info.name}
                                            onChange={(e) => handleEditMember(memberId, 'name', e.target.value)}
                                            className={`w-full bg-gaming-charcoal border rounded px-3 py-1.5 text-white text-sm focus:outline-none ${
                                              !(memberEdits[memberId]?.name ?? info.name)
                                                ? 'border-red-500 focus:border-red-400'
                                                : 'border-gaming-border focus:border-gaming-gold'
                                            }`}
                                            placeholder={`Enter ${fields.nameLabel}`}
                                          />
                                          {!(memberEdits[memberId]?.name ?? info.name) && (
                                            <p className="text-red-400 text-[10px] mt-0.5">Required</p>
                                          )}
                                        </div>
                                      )}
                                      <div>
                                        <label className="text-gray-500 text-[10px] uppercase tracking-wider">{fields.idLabel}</label>
                                        <input
                                          type="text"
                                          value={memberEdits[memberId]?.gameId ?? info.gameId}
                                          onChange={(e) => handleEditMember(memberId, 'gameId', e.target.value)}
                                          className={`w-full bg-gaming-charcoal border rounded px-3 py-1.5 text-white text-sm focus:outline-none ${
                                            !(memberEdits[memberId]?.gameId ?? info.gameId)
                                              ? 'border-red-500 focus:border-red-400'
                                              : 'border-gaming-border focus:border-gaming-gold'
                                          }`}
                                          placeholder={`Enter ${fields.idLabel}`}
                                        />
                                        {!(memberEdits[memberId]?.gameId ?? info.gameId) && (
                                          <p className="text-red-400 text-[10px] mt-0.5">Required</p>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {needsName && (
                                        <div>
                                          <span className="text-gray-500">{fields.nameLabel}: </span>
                                          <span className={!missingName ? 'text-gray-200' : 'text-red-400 font-medium'}>
                                            {info.name || 'Not set'}
                                          </span>
                                        </div>
                                      )}
                                      <div className={needsName ? '' : 'col-span-2'}>
                                        <span className="text-gray-500">{fields.idLabel}: </span>
                                        <span className={!missingId ? 'text-gray-200' : 'text-red-400 font-medium'}>
                                          {info.gameId || 'Not set'}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {hasMissingData && !isEditing && (
                                    <div className="flex items-center space-x-1 mt-1.5 text-[11px] text-red-400">
                                      <FiAlertTriangle className="w-3 h-3 shrink-0" />
                                      <span>
                                        Missing: {[missingName && fields.nameLabel, missingId && fields.idLabel].filter(Boolean).join(' & ')} — click edit to fix
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-1">No {gameType?.toUpperCase()} teams found</p>
              <p className="text-gray-500 text-sm">Create a team to register for this tournament</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="w-full py-3 border-2 border-dashed border-gaming-gold/30 hover:border-gaming-gold/60 rounded-lg text-gaming-gold font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <FiPlus className="w-5 h-5" />
            <span>Create New Team</span>
          </button>

          {needsPhone && selectedTeam && (
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">
                <FiPhone className="inline w-4 h-4 mr-1" />
                WhatsApp Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit number"
                className="w-full bg-gaming-charcoal border border-gaming-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-gaming-gold focus:outline-none"
              />
            </div>
          )}

          {selectedTeam && memberWarnings.length > 0 && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-xs font-medium mb-1.5 flex items-center space-x-1">
                <FiAlertTriangle className="w-3.5 h-3.5" />
                <span>Fix before registering:</span>
              </p>
              <ul className="space-y-0.5">
                {memberWarnings.map((w, i) => (
                  <li key={i} className="text-red-300 text-xs">• {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gaming-dark border-t border-gaming-border p-6 flex space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={registering}
            className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProceed}
            disabled={!selectedTeam || registering || memberWarnings.length > 0}
            className="flex-1 py-2 bg-gaming-gold hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-colors"
          >
            {registering ? 'Registering...' : 'Register Team'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default TeamSelectionModal;
