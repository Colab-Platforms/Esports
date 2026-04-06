import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiSearch, FiPlus, FiUsers, FiLock, FiGlobe, FiTrendingUp, FiClock, FiZap, FiArrowRight } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

const GAME_FILTERS = [
  { key: 'all', label: '🎮 All' },
  { key: 'valorant', label: '🟡 Valorant' },
  { key: 'cs2', label: '🔵 CS2' },
  { key: 'apex', label: '🔴 Apex' }
];

const SORT_OPTIONS = [
  { key: 'newest', label: '🆕 Newest', icon: FiClock },
  { key: 'members', label: '👥 Most Members', icon: FiUsers },
  { key: 'activity', label: '⚡ Most Active', icon: FiZap },
  { key: 'trending', label: '📈 Trending', icon: FiTrendingUp }
];

const ClanCard = ({ clan, onView, isFeatured }) => {
  const isRecruiting = (clan.stats?.totalMembers || 0) < clan.maxMembers;
  const progress = Math.min(((clan.stats?.totalMembers || 0) / clan.maxMembers) * 100, 100);

  const getGameColor = (game) => {
    switch (game?.toLowerCase()) {
      case 'valorant': return 'from-yellow-400 to-orange-500';
      case 'cs2': return 'from-blue-400 to-indigo-600';
      case 'apex': return 'from-red-500 to-rose-700';
      default: return 'from-gaming-gold to-yellow-600';
    }
  };

  const getAvatarInitials = (name) => {
    return name?.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || '??';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -8 }}
      className={`group relative bg-gaming-charcoal rounded-xl overflow-hidden border border-gaming-border hover:border-gaming-gold transition-all duration-300 flex flex-col h-[420px] ${isFeatured ? 'ring-2 ring-gaming-gold/30 shadow-[0_0_20px_rgba(241,196,15,0.15)]' : ''
        }`}
    >
      {/* Card Banner */}
      <div className={`h-28 w-full bg-gradient-to-br ${getGameColor(clan.game)} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
        <div className="absolute top-3 right-3 flex gap-2">
          {clan.visibility === 'private' && (
            <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg text-white">
              <FiLock className="w-3.5 h-3.5" />
            </div>
          )}
          {isFeatured && (
            <div className="bg-gaming-gold text-black px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">
              Featured
            </div>
          )}
        </div>
      </div>

      {/* Profile Section Overlay */}
      <div className="px-5 -mt-8 relative z-10 flex-grow">
        <div className="flex items-end justify-between mb-4">
          <div className="w-16 h-16 rounded-xl bg-gaming-dark border-4 border-gaming-charcoal flex items-center justify-center text-gaming-gold shadow-xl overflow-hidden group-hover:border-gaming-gold transition-all">
            {clan.avatar ? (
              <img src={clan.avatar} alt={clan.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-black">{getAvatarInitials(clan.name)}</span>
            )}
          </div>
          <div className="flex flex-col items-end pb-1">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest leading-none mb-1">Tag</span>
            <span className="text-gaming-gold font-gaming font-black text-sm">[{clan.tag || 'NONE'}]</span>
          </div>
        </div>

        {/* Info */}
        <div className="mb-4">
          <h3 className="text-xl font-gaming font-bold text-white mb-1 group-hover:text-gaming-gold transition-colors truncate">
            {clan.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <span className="flex items-center gap-1">
              <FiGlobe className="w-3 h-3" /> {clan.game || 'Other'}
            </span>
            <span>•</span>
            <span className={isRecruiting ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
              {isRecruiting ? 'Recruiting' : 'Full'}
            </span>
          </div>
          <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed mb-4">
            {clan.description || 'No description provided by the clan leader.'}
          </p>
        </div>

        {/* Capacity Bar */}
        <div className="mb-5">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span className="text-gray-500 font-bold uppercase tracking-wider">Clan Capacity</span>
            <span className="text-white font-bold">{clan.stats?.totalMembers || 0} / {clan.maxMembers}</span>
          </div>
          <div className="h-1.5 w-full bg-gaming-dark rounded-full overflow-hidden border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={`h-full ${progress > 90 ? 'bg-red-500' : 'bg-gaming-gold shadow-[0_0_8px_rgba(241,196,15,0.5)]'}`}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-5 pt-0 mt-auto border-t border-white/5 bg-black/5">
        <button
          onClick={() => onView(clan._id)}
          className="w-full h-11 bg-white/5 hover:bg-gaming-gold hover:text-black border border-white/10 hover:border-gaming-gold text-white font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 group/btn"
        >
          View Clan Details
          <FiZap className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
};

const ClanSkeleton = () => (
  <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6 animate-pulse h-[420px]">
    <div className="w-full h-28 bg-gaming-border rounded-lg mb-4" />
    <div className="w-16 h-16 bg-gaming-border rounded-xl -mt-12 mb-4 ml-4" />
    <div className="h-6 bg-gaming-border rounded mb-2 w-3/4 mx-4" />
    <div className="h-4 bg-gaming-border rounded mb-4 w-full mx-4" />
    <div className="h-10 bg-gaming-border rounded mt-auto" />
  </div>
);

const ClanDiscovery = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [gameFilter, setGameFilter] = useState(searchParams.get('game') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'trending');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Fetch clans
  useEffect(() => {
    fetchClans(false);
  }, [search, gameFilter, sortBy]);

  const fetchClans = async (isLoadMore) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setPage(1);
      }

      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (gameFilter !== 'all') params.append('game', gameFilter);
      params.append('sort', sortBy);
      params.append('page', isLoadMore ? page + 1 : 1);
      params.append('limit', 12);

      const response = await api.get(`/api/clans?${params.toString()}`);

      if (response.success) {
        if (isLoadMore) {
          setClans(prev => [...prev, ...response.data.clans]);
          setPage(prev => prev + 1);
        } else {
          setClans(response.data.clans);
        }
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching clans:', error);
      toast.error('Failed to load clans');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    setSearchParams({ search: value, game: gameFilter, sort: sortBy });
  };

  const handleGameFilter = (game) => {
    setGameFilter(game);
    setSearchParams({ search, game, sort: sortBy });
  };

  const handleSort = (sort) => {
    setSortBy(sort);
    setSearchParams({ search, game: gameFilter, sort });
  };

  const handleViewClan = (clanId) => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      navigate(`/clans/${clanId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-12">
        <div className="absolute inset-0 bg-gaming-gold/5 blur-[120px] rounded-full -top-40 -left-40 pointer-events-none" />
        <div className="absolute inset-0 bg-blue-500/5 blur-[120px] rounded-full -bottom-40 -right-40 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center md:text-left md:flex items-center justify-between"
          >
            <div className="max-w-2xl mb-8 md:mb-0">
              <h1 className="text-5xl md:text-7xl font-gaming font-black text-white mb-6 uppercase leading-tight tracking-tighter">
                Discover Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gaming-gold via-yellow-400 to-yellow-600">Legendary Squad</span>
              </h1>
              <p className="text-xl text-gray-400 font-medium leading-relaxed mb-8 max-w-xl">
                Join elite communities, dominate tournaments, and climb the global ladder together. The next generation of esports starts here.
              </p>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <button
                  onClick={() => navigate('/clans/create')}
                  className="px-8 py-4 bg-gaming-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-sm rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(241,196,15,0.3)]"
                >
                  Create Own Clan
                </button>
                <button
                  onClick={() => document.getElementById('discovery-main').scrollIntoView({ behavior: 'smooth' })}
                  className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-sm rounded-lg transition-all"
                >
                  Browse List
                </button>
              </div>
            </div>

            {/* Quick Stats Overlay */}
            <div className="hidden lg:block relative">
              <div className="w-80 h-80 rounded-2xl bg-gradient-to-br from-gaming-gold/20 to-transparent border border-gaming-gold/20 p-8 flex flex-col justify-center gap-8 backdrop-blur-3xl">
                <div>
                  <p className="text-gaming-gold font-gaming font-black text-4xl mb-1">1.2K+</p>
                  <p className="text-gray-400 uppercase font-bold text-xs tracking-widest">Active Communities</p>
                </div>
                <div className="w-full h-px bg-white/10" />
                <div>
                  <p className="text-white font-gaming font-black text-4xl mb-1">45K+</p>
                  <p className="text-gray-400 uppercase font-bold text-xs tracking-widest">Pro Players Online</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div id="discovery-main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12 space-y-6"
        >
          {/* Search Input */}
          <div className="relative group">
            <FiSearch className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-500 w-6 h-6 group-focus-within:text-gaming-gold transition-colors" />
            <input
              type="text"
              placeholder="Search clans by name, tag, or playstyle..."
              value={search}
              onChange={handleSearch}
              className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-lg placeholder-gray-600 focus:outline-none focus:border-gaming-gold focus:bg-gaming-charcoal/50 transition-all duration-300"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Game Filter Pills */}
            <div className="flex gap-2 flex-wrap">
              {GAME_FILTERS.map(game => (
                <button
                  key={game.key}
                  onClick={() => handleGameFilter(game.key)}
                  className={`px-6 py-2.5 rounded-full font-bold text-sm tracking-tight transition-all border ${gameFilter === game.key
                    ? 'bg-gaming-gold border-gaming-gold text-black shadow-[0_0_15px_rgba(241,196,15,0.3)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-gaming-gold hover:text-white'
                    }`}
                >
                  {game.label}
                </button>
              ))}
            </div>

            {/* Sort Options */}
            <div className="flex gap-2 items-center">
              <span className="text-gray-500 text-xs font-black uppercase tracking-widest mr-2">Sort By:</span>
              {SORT_OPTIONS.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    onClick={() => handleSort(option.key)}
                    title={option.label}
                    className={`p-2.5 rounded-lg transition-all border ${sortBy === option.key
                      ? 'bg-gaming-gold border-gaming-gold text-black'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-gaming-gold hover:text-white'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Featured Section - Only show on page 1 */}
        {!loading && clans.length > 3 && page === 1 && !search && gameFilter === 'all' && (
          <div className="mb-20">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-2 bg-gaming-gold rounded-full" />
              <h2 className="text-2xl font-gaming font-black text-white uppercase tracking-tighter">Elite Spotlight</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {clans.slice(0, 3).map((clan) => (
                <ClanCard key={clan._id} clan={clan} onView={handleViewClan} isFeatured={true} />
              ))}
            </div>
            <div className="mt-16 w-full h-px bg-white/5" />
          </div>
        )}

        {/* Main Grid */}
        <div className="mb-8">
          {(!loading && (page === 1 && !search && gameFilter === 'all' && clans.length > 3 ? clans.length > 3 : clans.length > 0)) && (
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-2 bg-white/20 rounded-full" />
              <h2 className="text-2xl font-gaming font-black text-white uppercase tracking-tighter">Operations Hub</h2>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <ClanSkeleton key={i} />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {(page === 1 && !search && gameFilter === 'all' && clans.length > 3 ? clans.slice(3) : clans).map((clan) => (
                  <ClanCard
                    key={clan._id}
                    clan={clan}
                    onView={handleViewClan}
                    isFeatured={false}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Empty State */}
          {!loading && clans.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10"
            >
              <div className="text-7xl mb-6">🏜️</div>
              <h3 className="text-3xl font-gaming font-black text-white mb-2 uppercase italic tracking-tighter">Negative Results</h3>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                {search ? 'Our satellites couldn\'t find any intel on that signature.' : 'No active clans found in this sector yet.'}
              </p>
              <button
                onClick={() => navigate('/clans/create')}
                className="px-8 py-3 bg-gaming-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-sm rounded-lg"
              >
                Assemble Yours
              </button>
            </motion.div>
          )}

          {/* Load More */}
          {pagination && pagination.pages > page && (
            <div className="flex justify-center py-12">
              <button
                onClick={() => fetchClans(true)}
                disabled={loadingMore}
                className="group relative flex items-center gap-3 px-10 py-4 bg-gaming-charcoal border border-white/10 rounded-xl text-white font-black uppercase tracking-[0.2em] text-sm hover:border-gaming-gold transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gaming-gold border-t-transparent rounded-full animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    Scan Next Sector
                    <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClanDiscovery;
