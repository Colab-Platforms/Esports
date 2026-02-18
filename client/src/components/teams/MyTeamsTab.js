import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiPlus, FiEdit2, FiTrash2, FiLogOut, FiAward, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import UserAvatar from '../common/UserAvatar';
import CreateTeamModal from './CreateTeamModal';
import axios from 'axios';
import toast from 'react-hot-toast';

const GAME_LABELS = {
  bgmi: 'BGMI',
  cs2: 'CS2',
  valorant: 'Valorant',
  freefire: 'Free Fire',
  ff: 'Free Fire'
};

const MyTeamsTab = ({ teams, invitations, loading, onRefresh, token }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTeam, setEditTeam] = useState(null);

  const handleCreateTeam = async (teamData) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.post(`${API_URL}/api/teams`, teamData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        toast.success('Team created successfully!', {
          duration: 3000, position: 'top-center',
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid #FFD700' }
        });
        setShowCreateModal(false);
        onRefresh();
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to create team', {
        duration: 3000, position: 'top-center'
      });
    }
  };

  const handleEditTeam = async (teamData) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.put(`${API_URL}/api/teams/${editTeam._id}`, teamData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        toast.success('Team updated!', {
          duration: 2000, position: 'top-center',
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid #FFD700' }
        });
        setEditTeam(null);
        onRefresh();
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to update team', {
        duration: 3000, position: 'top-center'
      });
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? This cannot be undone.')) return;
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.delete(`${API_URL}/api/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        toast.success('Team deleted', {
          duration: 2000, position: 'top-center',
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid #ef4444' }
        });
        onRefresh();
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to delete team', {
        duration: 3000, position: 'top-center'
      });
    }
  };

  const handleLeaveTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to leave this team?')) return;
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.post(`${API_URL}/api/teams/${teamId}/leave`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        toast.success('Left team', { duration: 2000, position: 'top-center' });
        onRefresh();
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to leave team', {
        duration: 3000, position: 'top-center'
      });
    }
  };

  const handleAcceptInvitation = async (invitationId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.post(`${API_URL}/api/teams/invitations/${invitationId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        toast.success('Joined team!', {
          duration: 2000, position: 'top-center',
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid #FFD700' }
        });
        onRefresh();
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to join team', {
        duration: 3000, position: 'top-center'
      });
    }
  };

  const handleRejectInvitation = async (invitationId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      await axios.post(`${API_URL}/api/teams/invitations/${invitationId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Invitation rejected', { duration: 2000, position: 'top-center' });
      onRefresh();
    } catch (error) {
      console.error('Error rejecting invitation:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading teams...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-2xl font-bold">My Teams</h2>
          <p className="text-gray-400 text-sm">Manage your gaming teams</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <FiPlus className="w-4 h-4" />
          <span>Create Team</span>
        </button>
      </div>

      {invitations.length > 0 && (
        <div>
          <h3 className="text-white text-lg font-bold mb-3">Team Invitations</h3>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv._id} className="flex items-center justify-between bg-gaming-charcoal border border-gaming-border rounded-lg px-4 py-3">
                <div>
                  <span className="text-white font-medium">{inv.teamId?.name}</span>
                  <span className="text-gray-400 text-sm ml-2">
                    {GAME_LABELS[inv.teamId?.game] || inv.teamId?.game?.toUpperCase()} — Invited by {inv.invitedBy?.username}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleAcceptInvitation(inv._id)} className="px-3 py-1 bg-gaming-gold hover:bg-yellow-500 text-black rounded text-sm font-medium transition-colors">Accept</button>
                  <button onClick={() => handleRejectInvitation(inv._id)} className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {teams.length > 0 ? (
        <div className="space-y-3">
          {teams.map((team) => (
            <TeamRow
              key={team._id}
              team={team}
              onEdit={() => setEditTeam(team)}
              onDelete={() => handleDeleteTeam(team._id)}
              onLeave={() => handleLeaveTeam(team._id)}
            />
          ))}
        </div>
      ) : (
        <div className="card-gaming p-12 text-center">
          <FiUsers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white text-xl font-bold mb-2">No Teams Yet</h3>
          <p className="text-gray-400 mb-6">Create your first team and start playing together!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
          >
            <FiPlus className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        </div>
      )}

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTeam}
          token={token}
        />
      )}

      {editTeam && (
        <CreateTeamModal
          onClose={() => setEditTeam(null)}
          onCreate={handleEditTeam}
          token={token}
          editTeam={editTeam}
        />
      )}
    </div>
  );
};

const TeamRow = ({ team, onEdit, onDelete, onLeave }) => {
  const [expanded, setExpanded] = useState(false);
  const currentUserId = localStorage.getItem('userId');

  let captainId = null;
  if (team.captain) {
    captainId = typeof team.captain === 'object' ? (team.captain._id || team.captain.id) : team.captain;
  }
  const isCaptain = captainId && currentUserId && captainId.toString() === currentUserId.toString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gaming-charcoal border border-gaming-border rounded-lg overflow-hidden"
    >
      <div className="flex items-center px-4 py-3">
        <div className="w-9 h-9 bg-gaming-gold/20 rounded-lg flex items-center justify-center shrink-0 mr-3">
          <FiUsers className="w-4 h-4 text-gaming-gold" />
        </div>

        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-white font-bold truncate">{team.name}</h3>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gaming-gold/15 text-gaming-gold whitespace-nowrap">
              {GAME_LABELS[team.game] || team.game?.toUpperCase()}
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">
            {team.members?.length}/{team.maxMembers} members
          </p>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gaming-dark rounded-lg transition-colors"
            title="Show members"
          >
            {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
          </button>

          {isCaptain && (
            <>
              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-gaming-gold hover:bg-gaming-gold/10 rounded-lg transition-colors"
                title="Edit team"
              >
                <FiEdit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete team"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </>
          )}

          {!isCaptain && (
            <button
              onClick={onLeave}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Leave team"
            >
              <FiLogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-gaming-border/50">
              <div className="flex flex-wrap gap-2">
                {team.members?.map((member) => {
                  if (!member.userId) return null;
                  return (
                    <div
                      key={member.userId._id || member._id}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-gaming-dark rounded-lg"
                    >
                      <UserAvatar user={member.userId} size="xs" />
                      <span className="text-white text-sm">{member.userId.username}</span>
                      {member.role === 'captain' && (
                        <FiAward className="w-3 h-3 text-gaming-gold" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MyTeamsTab;
