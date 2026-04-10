import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FiArrowLeft, FiUsers, FiMessageSquare, FiClock, FiLock, FiGlobe, FiTarget, FiAward, FiActivity, FiZap, FiCopy, FiSearch } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { selectAuth } from '../../store/slices/authSlice';
import { useClan } from '../../contexts/ClanContext';
import { motion, AnimatePresence } from 'framer-motion';

// --- Pure Utilities ---
const getAvatarInitials = (name) => {
  if (!name) return '';
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

const getRoleBadgeColor = (role) => {
  switch (role) {
    case 'owner': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'admin': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'mod': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

// --- Sub-Components ---

const ClanHeader = ({ clan, user, isMember, joining, onJoin, onChatNavigate, isOwner, onSaveClan, onLeave }) => {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: clan?.name || '', description: clan?.description || '' });

  const getGameColor = (game) => {
    switch (game?.toLowerCase()) {
      case 'valorant': return 'from-yellow-400 to-orange-600';
      case 'cs2': return 'from-blue-500 to-indigo-700';
      case 'apex': return 'from-red-600 to-rose-800';
      default: return 'from-gaming-gold to-yellow-600';
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(clan._id);
    toast.success('ID Copied to Clipboard');
  };

  return (
    <div className="relative mb-12">
      {/* Cinematic Banner */}
      <div className={`h-48 md:h-64 w-full bg-gradient-to-br ${getGameColor(clan.game)} rounded-3xl overflow-hidden relative shadow-2xl group`}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

        {/* Top Intelligence Tools */}
        <div className="absolute top-6 right-6 flex gap-3 z-20">
          <button
            onClick={copyId}
            className="p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md text-gray-300 border border-white/10 rounded-xl transition-all"
            title="Copy Tactical ID"
          >
            <FiCopy className="w-4 h-4" />
          </button>
          {isOwner && (
            <button
              onClick={() => setEditing(true)}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
            >
              Update Intelligence
            </button>
          )}
        </div>
      </div>

      {/* Identity Segment Overlay */}
      <div className="mx-auto px-8 -mt-20 relative z-30">
        <div className="flex flex-col md:flex-row items-end gap-10">
          {/* Elite Avatar Overlay */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-44 h-44 rounded-[2rem] bg-gaming-dark border-[10px] border-gaming-charcoal flex items-center justify-center text-gaming-gold font-gaming font-black text-6xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden group/avatar"
          >
            {clan.avatar ? (
              <img src={clan.avatar} alt={clan.name} className="w-full h-full object-cover transition-transform group-hover/avatar:scale-110 duration-500" />
            ) : (
              <span className="drop-shadow-[0_0_15px_rgba(241,196,15,0.6)]">{getAvatarInitials(clan.name)}</span>
            )}
          </motion.div>

          {/* Core Identity Panel */}
          <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-8 pb-4 w-full">
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl md:text-6xl font-gaming font-black text-white uppercase tracking-tighter drop-shadow-2xl">
                  {clan.name}
                </h1>
                <div className="bg-gaming-gold/20 text-gaming-gold px-3 py-1 rounded-lg text-xl font-gaming font-black italic">
                  {clan.tag || 'T1'}
                </div>
              </div>
              {/* <div className="flex items-center gap-6 text-gray-500 font-black text-xs tracking-[0.2em] uppercase">
                <span className="flex items-center gap-2 text-gaming-gold/80"><FiTarget className="w-4 h-4" /> {clan.game} SECTOR</span>
                <span className="flex items-center gap-2"><FiLock className="w-4 h-4" /> {clan.visibility}</span>
                <span className="flex items-center gap-2 text-white/40">EST. {new Date(clan.createdAt).getFullYear()}</span>
              </div> */}
            </div>

            {/* Strategic Actions */}
            <div className="flex items-center gap-4">
              {isMember ? (
                <>
                  <button
                    onClick={onChatNavigate}
                    className="px-10 py-4 bg-gaming-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[0_15px_30px_rgba(241,196,15,0.3)] transition-all transform hover:-translate-y-1 active:scale-95"
                  >
                    Go to Chat
                  </button>
                  {!isOwner && (
                    <button
                      onClick={onLeave}
                      className="p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 rounded-2xl transition-all"
                    >
                      <FiArrowLeft className="w-5 h-5" />
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={onJoin}
                  disabled={joining}
                  className="px-12 py-5 bg-gaming-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-base rounded-2xl shadow-[0_15px_40px_rgba(241,196,15,0.4)] transition-all transform hover:-translate-y-1 active:scale-95"
                >
                  {joining ? 'Authenticating...' : 'JOIN CLAN'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Overlay */}
      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-black/70">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="bg-gaming-charcoal border border-white/10 p-10 rounded-[2.5rem] w-full max-w-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)]"
            >
              <h2 className="text-3xl font-gaming font-black text-white uppercase italic tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">Update Tactical Intelligence</h2>
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Community Callsign</label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                    className="w-full h-14 px-6 bg-gaming-dark border border-white/5 rounded-2xl text-white font-bold text-lg focus:border-gaming-gold outline-none transition-all shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Manifesto (Mission Statement)</label>
                  <textarea
                    value={editData.description}
                    onChange={e => setEditData({ ...editData, description: e.target.value })}
                    className="w-full p-6 bg-gaming-dark border border-white/5 rounded-2xl text-white focus:border-gaming-gold outline-none transition-all h-40 resize-none leading-relaxed"
                  />
                </div>
                <div className="flex gap-4 pt-6">
                  <button
                    onClick={async () => {
                      await onSaveClan(editData);
                      setEditing(false);
                    }}
                    className="flex-1 h-16 bg-gaming-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all"
                  >
                    Confirm Intel Update
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 h-16 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest rounded-2xl transition-all"
                  >
                    Abort Mission
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ClanOverviewTab = ({ description, myRole, clanRules }) => {
  return (
    <div className="space-y-12">
      {/* Narrative Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1.5 bg-gaming-gold rounded-full" />
            <h3 className="text-xl font-gaming font-black text-white uppercase tracking-widest">The Manifesto</h3>
          </div>
          <p className="text-lg text-gray-400 leading-loose font-medium italic px-4 border-l border-white/5">
            "{description || 'No formal manifesto has been drafted by the leadership yet. Expect clandestine operations and total domination.'}"
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1.5 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            <h3 className="text-xl font-gaming font-black text-white uppercase tracking-widest">Protocol (Rules)</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 px-4">
            {(clanRules || []).map((rule, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-gaming-charcoal border border-white/5 rounded-xl hover:border-red-500/30 transition-all group">
                <span className="text-red-500 font-gaming font-black text-lg leading-none mt-1 opacity-50 group-hover:opacity-100">{idx + 1}</span>
                <p className="text-gray-300 font-bold text-sm leading-relaxed">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trophy / Milestone Case */}
      {/* <div className="pt-12 border-t border-white/5">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FiAward className="w-6 h-6 text-gaming-gold" />
            <h3 className="text-xl font-gaming font-black text-white uppercase tracking-widest">Elite Service Records</h3>
          </div>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">3 Global Citations</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-gaming-charcoal border border-gaming-gold/10 rounded-2xl flex items-center gap-5 group transition-all hover:bg-gaming-gold/5">
            <div className="w-14 h-14 rounded-2xl bg-gaming-gold/10 flex items-center justify-center text-gaming-gold text-2xl group-hover:scale-110 transition-transform">
              🥇
            </div>
            <div>
              <p className="text-white font-black text-sm uppercase tracking-tighter">Season Alpha Champion</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Valorant Premier</p>
            </div>
          </div>
          <div className="p-6 bg-gaming-charcoal border border-blue-500/10 rounded-2xl flex items-center gap-5 group transition-all hover:bg-blue-500/5 opacity-50 grayscale hover:grayscale-0 cursor-not-allowed">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 text-2xl">
              🎖️
            </div>
            <div>
              <p className="text-white font-black text-sm uppercase tracking-tighter">CS2 Major Contender</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">Signal Offline</p>
            </div>
          </div>
          <div className="p-6 bg-gaming-charcoal border border-purple-500/10 rounded-2xl flex items-center gap-5 group transition-all hover:bg-purple-500/5">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 text-2xl">
              🚀
            </div>
            <div>
              <p className="text-white font-black text-sm uppercase tracking-tighter">Rapid Recruitment</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Squad Size Milestone</p>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
};

const ClanRosterTab = ({ members, memberSearch, setMemberSearch }) => {
  return (
    <div className="space-y-10">
      {/* Search Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div className="relative w-full max-w-md group">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-gaming-gold transition-colors" />
          <input
            type="text"
            placeholder="Scan directory for operative signature..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-6 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-gaming-gold transition-all"
          />
        </div>
        <div className="flex items-center gap-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">
          <span>Directory Status: <span className="text-green-500">Live</span></span>
          <span className="w-1 h-1 rounded-full bg-white/10" />
          <span>Total Intel: {members.length} Samples</span>
        </div>
      </div>

      {/* Operative Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {members.filter(m => m.user?.username?.toLowerCase().includes(memberSearch.toLowerCase())).map((member) => (
          <motion.div
            key={member._id}
            whileHover={{ y: -5 }}
            className="bg-gaming-charcoal border border-white/5 p-5 rounded-2xl relative overflow-hidden group"
          >
            <div className={`absolute top-0 left-0 w-1.5 h-full ${member.role === 'owner' ? 'bg-red-500' : member.role === 'admin' ? 'bg-purple-500' : 'bg-gaming-gold'}`} />
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-xl bg-gaming-dark border-2 border-gaming-charcoal flex items-center justify-center text-white font-black group-hover:border-gaming-gold transition-all overflow-hidden">
                {member.user?.avatarUrl ? (
                  <img src={member.user.avatarUrl} alt={member.user.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">{member.user?.username?.[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-gaming font-black text-white truncate leading-none mb-1 uppercase tracking-tight">{member.user?.username}</p>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${getRoleBadgeColor(member.role)}`}>
                  {member.role === 'owner' ? 'Command' : member.role}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                <span>Operative Rank</span>
                <span className="text-white">LEVEL {member.user?.level || 0}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                <span>Status</span>
                <span className="text-green-400">ACTIVE SESSION</span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="text-[10px] font-black text-gaming-gold uppercase tracking-widest hover:underline">View Profile</button>
              <FiArrowLeft className="w-4 h-4 text-gray-600 rotate-180" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

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
  const [memberSearch, setMemberSearch] = useState('');
  const [clanRules] = useState([
    'Enforce total respect across all operational sectors.',
    'Unauthorized use of exploits results in immediate extraction.',
    'Mandatory participation in high-priority tournament deployments.',
    'Adhere to all encrypted protocol guidelines in Discord coms.'
  ]);

  // Derive status
  const isMember = myClan?.clan?._id?.toString() === clanId || myClan?._id?.toString() === clanId;
  const myRole = isMember ? (myClan?.role || 'member') : null;

  useEffect(() => {
    fetchClanData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clanId]);

  const fetchClanData = async () => {
    try {
      setLoading(true);
      const [clanRes, membersRes] = await Promise.all([
        api.get(`/api/clans/${clanId}`),
        api.get(`/api/clans/${clanId}/members?limit=100`)
      ]);

      if (clanRes.success) setClan(clanRes.data.clan);
      if (membersRes.success) setMembers(membersRes.data.members);
    } catch (error) {
      toast.error('Tactical failure: Unable to sync with database');
      navigate('/clans');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data) => {
    try {
      const res = await api.patch(`/api/clans/${clanId}`, data);
      if (res.success) {
        setClan(prev => ({ ...prev, ...data }));
        toast.success('Intelligence updated');
        await refreshMyClan();
      }
    } catch (err) {
      toast.error('Authority denied');
    }
  };

  const handleJoin = async () => {
    try {
      setJoining(true);
      const res = await api.post(`/api/clans/${clanId}/join`);
      if (res.success) {
        toast.success('Welcome to the squad, operative.');
        await refreshMyClan();
        await fetchClanData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Access Denied');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('CRITICAL: Withdrawal from clan is permanent. Proceed?')) return;
    try {
      const res = await api.post(`/api/clans/${clanId}/leave`);
      if (res.success) {
        toast.success('Operative extracted successfully.');
        await refreshMyClan();
        await fetchClanData();
      }
    } catch (err) {
      toast.error('Withdrawal failed');
    }
  };

  if (loading || !clan) return null;

  return (
    <div className="flex-1 px-4 lg:px-12 py-10 bg-gaming-dark selection:bg-gaming-gold/30">
      <div className="max-w-7xl mx-auto space-y-12">
        <ClanHeader
          clan={clan}
          user={user}
          isMember={isMember}
          joining={joining}
          onJoin={handleJoin}
          onChatNavigate={() => navigate(`/clans/${clanId}/chat`)}
          isOwner={myRole === 'owner'}
          onSaveClan={handleUpdate}
          onLeave={handleLeave}
        />

        {/* Real Performance Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-gaming-charcoal/50 border border-white/5 rounded-3xl p-8 text-center backdrop-blur-md">
            <p className="text-gray-500 font-black text-[10px] uppercase tracking-[0.2em] mb-2">Total Members</p>
            <p className="text-5xl font-gaming font-black text-white">{clan.memberCount}</p>
            <div className="mt-3 text-[10px] text-gaming-gold font-bold uppercase tracking-widest">{Math.floor((clan.memberCount / clan.maxMembers) * 100)}% Capacity</div>
          </div>
          <div className="bg-gaming-charcoal/50 border border-white/5 rounded-3xl p-8 text-center backdrop-blur-md">
            <p className="text-gray-500 font-black text-[10px] uppercase tracking-[0.2em] mb-2">Tactical Access</p>
            <p className="text-4xl font-gaming font-black text-blue-400 uppercase tracking-tighter truncate">{clan.visibility}</p>
            <div className="mt-3 text-[10px] text-blue-400/60 font-bold uppercase tracking-widest">Clan Visibility</div>
          </div>
          <div className="bg-gaming-charcoal/50 border border-white/5 rounded-3xl p-8 text-center backdrop-blur-md">
            <p className="text-gray-500 font-black text-[10px] uppercase tracking-[0.2em] mb-2">Game Sector</p>
            <p className="text-4xl font-gaming font-black text-purple-400 uppercase tracking-tighter truncate">{clan.game}</p>
            <div className="mt-3 text-[10px] text-purple-400/60 font-bold uppercase tracking-widest">Live Operations</div>
          </div>
          <div className="bg-gaming-charcoal/50 border border-white/5 rounded-3xl p-8 text-center backdrop-blur-md">
            <p className="text-gray-500 font-black text-[10px] uppercase tracking-[0.2em] mb-2">Service History</p>
            <p className="text-5xl font-gaming font-black text-green-500">
              {Math.floor((new Date() - new Date(clan.createdAt)) / (1000 * 60 * 60 * 24))}
            </p>
            <div className="mt-3 text-[10px] text-green-500/50 font-bold uppercase tracking-widest">Days Active</div>
          </div>
        </div>

        {/* Standardized Navigation Container */}
        <div className="bg-gaming-charcoal/30 border border-white/5 rounded-[3rem] overflow-hidden backdrop-blur-sm shadow-2xl">
          <div className="flex bg-black/20 p-2 md:p-4">
            {['overview', 'members',].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab ? 'bg-gaming-gold text-black shadow-[0_10px_20px_rgba(241,196,15,0.2)]' : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
              >
                {tab === 'overview' && <FiAward className="w-4 h-4" />}
                {tab === 'members' && <FiUsers className="w-4 h-4" />}
                {tab === 'tournaments' && <FiTarget className="w-4 h-4" />}
                {tab === 'activity' && <FiActivity className="w-4 h-4" />}
                <span className="hidden md:inline">{tab}</span>
              </button>
            ))}
          </div>

          <div className="p-10 lg:p-16 min-h-[500px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: 'circOut' }}
              >
                {activeTab === 'overview' && <ClanOverviewTab description={clan.description} clanRules={clanRules} />}
                {activeTab === 'members' && <ClanRosterTab members={members} memberSearch={memberSearch} setMemberSearch={setMemberSearch} />}

                {activeTab === 'tournaments' && (
                  <div className="text-center py-24 space-y-6">
                    <FiTarget className="w-16 h-16 text-white/5 mx-auto animate-pulse" />
                    <h3 className="text-2xl font-gaming font-black text-white/20 uppercase tracking-widest italic">Encrypted Briefings</h3>
                    <p className="text-gray-600 max-w-md mx-auto italic font-bold">
                      Current tournament deployments and upcoming match-ups are restricted to level-3 verified operatives only.
                    </p>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="text-center py-24 space-y-6">
                    <FiActivity className="w-16 h-16 text-white/5 mx-auto animate-spin-slow" />
                    <h3 className="text-2xl font-gaming font-black text-white/20 uppercase tracking-widest italic">Signal Offline</h3>
                    <p className="text-gray-600 max-w-md mx-auto italic font-bold text-xs tracking-widest leading-loose">
                      Real-time activity feed synchronization is currently disabled by local EM jamming. Operations update pending.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClanProfile;
