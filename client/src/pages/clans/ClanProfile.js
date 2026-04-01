import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FiArrowLeft, FiUsers, FiMessageSquare, FiClock, FiLock, FiGlobe } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { selectAuth } from '../../store/slices/authSlice';
import { useClan } from '../../contexts/ClanContext';

// --- Pure Utilities ---
const getAvatarInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getRoleBadgeColor = (role) => {
  switch (role) {
    case 'owner':
      return 'bg-red-500/20 text-red-400';
    case 'admin':
      return 'bg-purple-500/20 text-purple-400';
    case 'mod':
      return 'bg-blue-500/20 text-blue-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
};

// --- Sub-Components ---

const ClanHeader = ({ clan, user, isMember, joining, onJoin, onChatNavigate, isOwner, onSaveClan }) => {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: clan?.name || '', description: clan?.description || '' });
  const [expanded, setExpanded] = useState(false);

  // Update edit data when clan changes
  useEffect(() => {
    if (clan) {
      setEditData({ name: clan.name || '', description: clan.description || '' });
    }
  }, [clan]);

  const handleSave = async () => {
    if (!editData.name.trim()) return toast.error('Clan name is required');
    await onSaveClan(editData);
    setEditing(false);
  };

  const words = clan?.description ? clan.description.trim().split(/\s+/) : [];
  const isLong = words.length > 50;
  const displayDescription = expanded || !isLong ? clan.description : words.slice(0, 50).join(' ') + '...';

  return (
  <div className="glass-panel p-8 mb-8 relative border-l-4 border-l-gaming-gold">
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-6 w-full">
        {/* Avatar */}
        <div className="w-24 h-24 glass-panel flex items-center justify-center text-gaming-gold font-bold text-4xl flex-shrink-0 border-2 border-gaming-gold/20">
          {getAvatarInitials(clan.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-4 max-w-2xl mb-6 pr-8">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Clan Name</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white font-gaming text-2xl focus:outline-none focus:border-gaming-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Description</label>
                <textarea
                  value={editData.description}
                  onChange={e => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-gaming-dark border border-gaming-border rounded-lg text-gray-300 resize-none focus:outline-none focus:border-gaming-gold transition-colors"
                  rows="4"
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-gaming-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditData({ name: clan.name, description: clan.description });
                  }}
                  className="px-6 py-2 bg-gaming-dark border border-gaming-border text-white font-bold rounded-lg hover:border-gaming-gold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-4xl font-gaming font-bold text-white break-words">{clan.name}</h1>
                {clan.tag && (
                  <span className="px-3 py-1 bg-gaming-gold/20 text-gaming-gold font-bold rounded">
                    {clan.tag}
                  </span>
                )}
                {isOwner && (
                  <button 
                    onClick={() => setEditing(true)} 
                    className="ml-2 text-xs text-gaming-gold border border-gaming-gold/30 px-3 py-1.5 rounded-lg hover:bg-gaming-gold/10 transition-colors"
                  >
                    Edit Clan
                  </button>
                )}
              </div>
              <div className="text-gray-400 mb-4 max-w-2xl whitespace-pre-wrap">
                {displayDescription}
                {isLong && (
                  <button 
                    onClick={() => setExpanded(!expanded)} 
                    className="ml-2 text-gaming-gold hover:underline font-semibold focus:outline-none"
                  >
                    {expanded ? 'Show Less' : 'Read More'}
                  </button>
                )}
              </div>
            </>
          )}

          {/* Stats Row */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <FiUsers className="w-4 h-4" />
              <span>{clan.memberCount || 0}/{clan.maxMembers} Members</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <FiClock className="w-4 h-4" />
              <span>{clan.onlineCount || 0} Online</span>
            </div>
            {/* <div className="flex items-center gap-2 text-gray-300">
              <FiMessageSquare className="w-4 h-4" />
              <span>{clan.messageCount || 0} Messages</span>
            </div> */}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div>
        {isMember ? (
          <button
            onClick={onChatNavigate}
            className="px-6 py-3 bg-gaming-gold hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
          >
            Go to Chat
          </button>
        ) : clan.bannedUsers?.includes(user?._id) ? (
          <button
            disabled
            className="px-6 py-3 bg-red-500/50 text-red-200 font-bold rounded-lg cursor-not-allowed"
          >
            Banned from clan
          </button>
        ) : (
          <button
            onClick={onJoin}
            disabled={joining}
            className="px-6 py-3 bg-gaming-gold hover:bg-yellow-500 disabled:opacity-50 text-black font-bold rounded-lg transition-colors"
          >
            {joining ? 'Joining...' : clan.visibility === 'private' ? 'Request to join' : 'Join the Clan'}
          </button>
        )}
      </div>
    </div>

    {/* Visibility & Owner */}
    <div className="flex items-center gap-4 text-sm text-gray-400 border-t border-gaming-border pt-4">
      <div className="flex items-center gap-2">
        {clan.visibility === 'public' ? (
          <FiGlobe className="w-4 h-4" />
        ) : (
          <FiLock className="w-4 h-4" />
        )}
        <span className="capitalize">{clan.visibility} Clan</span>
      </div>
      <span>•</span>
      <span>Led by {clan.owner?.username}</span>
    </div>
  </div>
)};

const ClanOverviewTab = ({
  clanRules,
  myRole,
  editingRules,
  setEditingRules,
  rulesText,
  setRulesText,
  setClanRules,
  pinnedMessages,
  members
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Main Content */}
    <div className="lg:col-span-2 space-y-6">
      {/* Pinned Messages */}
      <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">📌 Pinned Messages</h3>
        {pinnedMessages.length === 0 ? (
          <div className="text-gray-400 text-sm">
            No pinned messages yet. Admins can pin important messages in the chat.
          </div>
        ) : (
          <div className="space-y-3">
            {pinnedMessages.map((msg, idx) => (
              <div key={idx} className="bg-gaming-dark border border-gaming-border/50 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gaming-gold">{msg.author}</span>
                  <span className="text-xs text-gray-500">{msg.date}</span>
                </div>
                <p className="text-sm text-gray-300">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clan Rules */}
      <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">📋 Clan Rules</h3>
          {myRole === 'owner' && (
            <button
              onClick={() => {
                setEditingRules(!editingRules);
                setRulesText(clanRules.join('\n'));
              }}
              className="text-sm px-3 py-1 bg-gaming-gold/20 text-gaming-gold rounded hover:bg-gaming-gold/30 transition-colors"
            >
              {editingRules ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>

        {editingRules ? (
          <div className="space-y-3">
            <textarea
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder="Enter clan rules (one per line)"
              className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gaming-gold transition-colors resize-none"
              rows="6"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setClanRules(rulesText.split('\n').filter(r => r.trim()));
                  setEditingRules(false);
                  toast.success('Clan rules updated!');
                }}
                className="flex-1 px-4 py-2 bg-gaming-gold hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
              >
                Save Rules
              </button>
              <button
                onClick={() => setEditingRules(false)}
                className="flex-1 px-4 py-2 bg-gaming-charcoal border border-gaming-border text-white font-bold rounded-lg hover:border-gaming-gold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-sm space-y-2">
            {clanRules.map((rule, idx) => (
              <p key={idx}>{rule}</p>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Sidebar */}
    <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">👥 Top Members</h3>
      <div className="space-y-3">
        {members.slice(0, 5).map(member => (
          <div key={member._id} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gaming-border rounded-full flex items-center justify-center text-xs font-bold">
              {member.user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {member.user?.username}
              </p>
              <p className={`text-xs font-bold ${getRoleBadgeColor(member.role)}`}>
                {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ClanMembersTab = ({
  members,
  filteredMembers,
  loadingMembers,
  memberSearch,
  setMemberSearch,
  memberSort,
  setMemberSort
}) => (
  <div className="space-y-4">
    {/* Search & Sort Controls */}
    <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-4 space-y-4">
      <div className="flex gap-4 flex-col md:flex-row">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search members by username..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gaming-gold transition-colors"
          />
        </div>

        {/* Sort */}
        <select
          value={memberSort}
          onChange={(e) => setMemberSort(e.target.value)}
          className="px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:border-gaming-gold transition-colors"
        >
          <option value="role">Sort by Role</option>
          <option value="newest">Sort by Newest</option>
          <option value="messages">Sort by Activity</option>
        </select>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-400">
        Showing {filteredMembers.length} of {members.length} members
      </div>
    </div>

    {/* Members Table */}
    <div className="bg-gaming-charcoal border border-gaming-border rounded-lg overflow-hidden">
      {loadingMembers ? (
        <div className="p-8 text-center text-gray-400">Loading members...</div>
      ) : filteredMembers.length === 0 ? (
        <div className="p-8 text-center text-gray-400">No members found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gaming-dark border-b border-gaming-border">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Member</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Role</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Joined</th>
                {/* <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Messages</th> */}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(member => (
                <tr key={member._id} className="border-b border-gaming-border hover:bg-gaming-dark/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gaming-border rounded-full flex items-center justify-center text-xs font-bold">
                        {member.user?.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {member.user?.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          Level {member.user?.level || 1}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded text-xs font-bold ${getRoleBadgeColor(member.role)}`}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  {/* <td className="px-6 py-4 text-sm text-gray-400">
                    {member.stats?.messagesCount || 0}
                  </td> */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
);

// --- Main Container ---

const ClanProfile = () => {
  const { id: clanId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const { user } = useSelector(selectAuth);
  const { myClan, refreshMyClan } = useClan();

  const [clan, setClan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'overview');
  const [members, setMembers] = useState([]);
  const [joining, setJoining] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSort, setMemberSort] = useState('role');
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [clanRules, setClanRules] = useState([
    '• Be respectful to all members',
    '• No cheating or exploiting',
    '• Participate in clan events',
    '• Follow Discord guidelines'
  ]);
  const [editingRules, setEditingRules] = useState(false);
  const [rulesText, setRulesText] = useState('');

  // Derive membership from myClan context
  const isMember = myClan?.clan?._id?.toString() === clanId || myClan?._id?.toString() === clanId;
  const myRole = isMember ? myClan?.role : null;

  // Handle Clan Profile Updates
  const handleUpdateClan = async (updateData) => {
    try {
      const response = await api.patch(`/api/clans/${clanId}`, updateData);
      if (response.success) {
        setClan(prev => ({ ...prev, ...updateData }));
        toast.success("Clan updated successfully");
        await refreshMyClan();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update clan");
    }
  };

  // Fetch clan detail
  useEffect(() => {
    fetchClanDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clanId]);

  // Sync activeTab with URL param
  useEffect(() => {
    if (tabFromUrl) setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  // Fetch members when tab changes
  useEffect(() => {
    if (activeTab === 'members' && members.length === 0) {
      fetchMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchClanDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/clans/${clanId}`);

      if (response.success) {
        setClan(response.data.clan);
      }
    } catch (error) {
      console.error('Error fetching clan:', error);
      toast.error('Failed to load clan');
      navigate('/clans');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const response = await api.get(`/api/clans/${clanId}/members?limit=50`);

      if (response.success) {
        setMembers(response.data.members);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoadingMembers(false);
    }
  };

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    return members
      .filter(m =>
        m.user?.username?.toLowerCase().includes(memberSearch.toLowerCase())
      )
      .sort((a, b) => {
        if (memberSort === 'role') {
          const roleOrder = { owner: 0, admin: 1, mod: 2, member: 3 };
          return roleOrder[a.role] - roleOrder[b.role];
        } else if (memberSort === 'newest') {
          return new Date(b.joinedAt) - new Date(a.joinedAt);
        } else if (memberSort === 'messages') {
          return (b.stats?.messagesCount || 0) - (a.stats?.messagesCount || 0);
        }
        return 0;
      });
  }, [members, memberSearch, memberSort]);

  const handleJoinClan = async () => {
    try {
      setJoining(true);
      const response = await api.post(`/api/clans/${clanId}/join`);

      if (response.success) {
        toast.success('🎉 Successfully joined clan!');
        // Refresh clan context so navbar updates immediately
        await refreshMyClan();
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to join clan';
      toast.error(message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) return null; // Let Hub handle loading or show a skeleton

  if (!clan) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-2xl font-bold text-white mb-4">Clan not found</h2>
      <button onClick={() => navigate('/clans')} className="btn-premium">Browse Clans</button>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 custom-scrollbar bg-hub-content-bg">
      <div className="max-w-6xl mx-auto space-y-8">
        <ClanHeader
          clan={clan}
          user={user}
          isMember={isMember}
          joining={joining}
          onJoin={handleJoinClan}
          onChatNavigate={() => navigate(`/clans/${clanId}/chat`)}
          isOwner={myRole === 'owner'}
          onSaveClan={handleUpdateClan}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Panel */}
            <div className="glass-panel p-6 flex items-center justify-around">
               <div className="text-center">
                 <p className="text-2xl font-bold text-gaming-gold">{clan.memberCount || 0}</p>
                 <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Members</p>
               </div>
               <div className="w-px h-10 bg-white/10" />
               <div className="text-center">
                 <p className="text-2xl font-bold text-blue-400">{clan.onlineCount || 0}</p>
                 <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Online</p>
               </div>
               <div className="w-px h-10 bg-white/10" />
               <div className="text-center">
                 <p className="text-2xl font-bold text-purple-400">{clan.visibility || 'Public'}</p>
                 <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Visibility</p>
               </div>
            </div>

            {/* Tabs List */}
            <div className="glass-panel overflow-hidden">
              <div className="flex border-b border-white/5 bg-white/2">
                {['overview', 'members', 'activity'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-8 py-4 text-sm font-bold transition-all relative capitalize ${
                      activeTab === tab ? 'text-gaming-gold' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gaming-gold shadow-[0_0_8px_rgba(241,196,15,0.5)]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="p-8">
                {activeTab === 'overview' && (
                  <ClanOverviewTab
                    clanRules={clanRules}
                    myRole={myRole}
                    editingRules={editingRules}
                    setEditingRules={setEditingRules}
                    rulesText={rulesText}
                    setRulesText={setRulesText}
                    setClanRules={setClanRules}
                    pinnedMessages={pinnedMessages}
                    members={members}
                  />
                )}

                {activeTab === 'members' && (
                  <ClanMembersTab
                    members={members}
                    filteredMembers={filteredMembers}
                    loadingMembers={loadingMembers}
                    memberSearch={memberSearch}
                    setMemberSearch={setMemberSearch}
                    memberSort={memberSort}
                    setMemberSort={setMemberSort}
                  />
                )}

                {activeTab === 'activity' && (
                  <div className="py-10 text-center text-gray-500 italic">
                    📊 Activity feed logic coming soon...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Brief Info */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">About</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {clan.description || 'No description provided.'}
              </p>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Leadership</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gaming-gold/10 flex items-center justify-center text-gaming-gold font-bold">
                  {clan.owner?.username?.[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-white transition-colors">@{clan.owner?.username}</p>
                  <p className="text-[10px] text-gaming-gold font-bold">Clan Leader</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClanProfile;
