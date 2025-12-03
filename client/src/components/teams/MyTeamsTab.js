import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiUsers, FiPlus, FiSettings, FiLogOut, FiAward, FiX, FiUserPlus, FiTrash2 } from 'react-icons/fi';
import UserAvatar from '../common/UserAvatar';
import CreateTeamModal from './CreateTeamModal';
import InviteMemberModal from './InviteMemberModal';
import axios from 'axios';
import toast from 'react-hot-toast';

const MyTeamsTab = ({ teams, invitations, loading, onRefresh, token }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const handleCreateTeam = async (teamData) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.post(
        `${API_URL}/api/teams`,
        teamData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Team created successfully! 🎉', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
        setShowCreateModal(false);
        onRefresh();
      }
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to create team', {
        duration: 3000,
        position: 'top-center'
      });
    }
  };

  const handleLeaveTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to leave this team?')) return;

    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.post(
        `${API_URL}/api/teams/${teamId}/leave`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Left team successfully', {
          duration: 3000,
          position: 'top-center'
        });
        onRefresh();
      }
    } catch (error) {
      console.error('Error leaving team:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to leave team', {
        duration: 3000,
        position: 'top-center'
      });
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('⚠️ Are you sure you want to DELETE this team? This action cannot be undone!')) return;

    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.delete(
        `${API_URL}/api/teams/${teamId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Team deleted successfully', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #ef4444'
          }
        });
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to delete team', {
        duration: 3000,
        position: 'top-center'
      });
    }
  };

  const handleAcceptInvitation = async (invitationId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.post(
        `${API_URL}/api/teams/invitations/${invitationId}/accept`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Joined team successfully! 🎉', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
        onRefresh();
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to join team', {
        duration: 3000,
        position: 'top-center'
      });
    }
  };

  const handleRejectInvitation = async (invitationId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      await axios.post(
        `${API_URL}/api/teams/invitations/${invitationId}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      toast.success('Invitation rejected', {
        duration: 2000,
        position: 'top-center'
      });
      onRefresh();
    } catch (error) {
      console.error('Error rejecting invitation:', error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">
        Loading teams...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
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

      {/* Team Invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 className="text-white text-lg font-bold mb-3">Team Invitations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invitations.map((invitation) => (
              <motion.div
                key={invitation._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-gaming p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-white font-bold">
                      {invitation.teamId?.name}
                      {invitation.teamId?.tag && (
                        <span className="text-gaming-gold ml-2">[{invitation.teamId.tag}]</span>
                      )}
                    </h4>
                    <p className="text-gray-400 text-sm">
                      {invitation.teamId?.game?.toUpperCase()} • Invited by {invitation.invitedBy?.username}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAcceptInvitation(invitation._id)}
                    className="flex-1 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg font-medium transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectInvitation(invitation._id)}
                    className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* My Teams */}
      {teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map((team) => (
            <TeamCard
              key={team._id}
              team={team}
              onLeave={handleLeaveTeam}
              onDelete={handleDeleteTeam}
              onInvite={(team) => {
                setSelectedTeam(team);
                setShowInviteModal(true);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="card-gaming p-12 text-center">
          <FiUsers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white text-xl font-bold mb-2">No Teams Yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first team and start playing together!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
          >
            <FiPlus className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTeam}
        />
      )}

      {/* Invite Member Modal */}
      {showInviteModal && selectedTeam && (
        <InviteMemberModal
          team={selectedTeam}
          token={token}
          onClose={() => {
            setShowInviteModal(false);
            setSelectedTeam(null);
          }}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

// Team Card Component
const TeamCard = ({ team, onLeave, onDelete, onInvite }) => {
  const currentUserId = localStorage.getItem('userId');
  
  // Handle different captain data structures
  let captainId = null;
  if (team.captain) {
    if (typeof team.captain === 'object') {
      captainId = team.captain._id || team.captain.id;
    } else {
      captainId = team.captain;
    }
  }
  
  const isCaptain = captainId && currentUserId && captainId.toString() === currentUserId.toString();
  
  console.log('🎮 Team:', team.name);
  console.log('   Captain:', team.captain);
  console.log('   Captain ID:', captainId);
  console.log('   Current User:', currentUserId);
  console.log('   Is Captain:', isCaptain);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-gaming p-6"
    >
      {/* Team Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {team.logo ? (
            <img src={team.logo} alt={team.name} className="w-12 h-12 rounded-lg" />
          ) : (
            <div className="w-12 h-12 bg-gaming-gold/20 rounded-lg flex items-center justify-center">
              <FiUsers className="w-6 h-6 text-gaming-gold" />
            </div>
          )}
          <div>
            <h3 className="text-white font-bold text-lg">
              {team.name}
              {team.tag && <span className="text-gaming-gold ml-2">[{team.tag}]</span>}
            </h3>
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gaming-neon">{team.game?.toUpperCase()}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-400">{team.members.length}/{team.maxMembers} Members</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-400 capitalize">{team.privacy}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {team.description && (
        <p className="text-gray-400 text-sm mb-4">{team.description}</p>
      )}

      {/* Members */}
      <div className="mb-4">
        <h4 className="text-white text-sm font-medium mb-2">Members:</h4>
        <div className="flex flex-wrap gap-2">
          {team.members.map((member) => (
            <div
              key={member.userId._id}
              className="flex items-center space-x-2 px-3 py-1 bg-gaming-charcoal rounded-lg"
            >
              <UserAvatar user={member.userId} size="xs" />
              <span className="text-white text-sm">{member.userId.username}</span>
              {member.role === 'captain' && (
                <FiAward className="w-3 h-3 text-gaming-gold" title="Captain" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gaming-charcoal p-2 rounded text-center">
          <div className="text-gaming-gold font-bold">{team.stats?.wins || 0}</div>
          <div className="text-gray-400 text-xs">Wins</div>
        </div>
        <div className="bg-gaming-charcoal p-2 rounded text-center">
          <div className="text-gaming-gold font-bold">{team.stats?.losses || 0}</div>
          <div className="text-gray-400 text-xs">Losses</div>
        </div>
        <div className="bg-gaming-charcoal p-2 rounded text-center">
          <div className="text-gaming-gold font-bold">{team.stats?.tournamentsPlayed || 0}</div>
          <div className="text-gray-400 text-xs">Tournaments</div>
        </div>
      </div>

      {/* Debug Info */}
      {!isCaptain && (
        <div className="mb-2 p-2 bg-yellow-900/20 border border-yellow-600/30 rounded text-xs text-yellow-400">
          ⚠️ You are not the captain. Captain ID: {captainId}, Your ID: {currentUserId}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col space-y-2">
        {isCaptain ? (
          <>
            <div className="flex space-x-2">
              <button 
                onClick={() => onInvite(team)}
                className="flex-1 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
              >
                <FiUserPlus className="w-4 h-4" />
                <span>Invite</span>
              </button>
              <button className="flex-1 py-2 bg-gaming-neon hover:bg-gaming-neon-blue text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
                <FiSettings className="w-4 h-4" />
                <span>Manage</span>
              </button>
            </div>
            <button
              onClick={() => onDelete(team._id)}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <FiTrash2 className="w-4 h-4" />
              <span>Delete Team</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => onLeave(team._id)}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <FiLogOut className="w-4 h-4" />
            <span>Leave Team</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default MyTeamsTab;
