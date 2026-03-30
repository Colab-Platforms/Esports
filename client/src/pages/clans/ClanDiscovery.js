import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiSearch, FiPlus, FiUsers, FiLock, FiGlobe, FiTrendingUp, FiClock, FiZap } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';

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

const ClanCard = ({ clan, onView, isFeatured, rank }) => {
  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'private':
        return <FiLock className="w-4 h-4" />;
      case 'invite':
        return <FiLock className="w-4 h-4" />;
      default:
        return <FiGlobe className="w-4 h-4" />;
    }
  };

  const getVisibilityLabel = (visibility) => {
    return visibility.charAt(0).toUpperCase() + visibility.slice(1);
  };

  const getAvatarInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isRecruiting = clan.stats?.totalMembers < clan.maxMembers * 0.8;

  return (
    <div className={`bg-gaming-charcoal border rounded-lg p-6 hover:border-gaming-gold transition-all duration-300 flex flex-col h-full ${isFeatured ? 'border-gaming-gold shadow-lg shadow-gaming-gold/20' : 'border-gaming-border'
      }`}>
      {/* Featured Badge & Rank */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex gap-2">
          {isFeatured && (
            <span className="px-2 py-1 bg-gaming-gold/20 text-gaming-gold text-xs font-bold rounded-full animate-pulse">
              ⭐ Featured
            </span>
          )}
          {isRecruiting && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">
              🔥 Recruiting
            </span>
          )}
        </div>
        {/* {rank && (
          <div className="text-right">
            <div className="text-2xl font-bold text-gaming-gold">#{rank}</div>
            <div className="text-xs text-gray-400">Rank</div>
          </div>
        )} */}
      </div>

      {/* Avatar & Header */}
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-black font-bold text-lg ${isFeatured
          ? 'bg-gradient-to-br from-gaming-gold to-yellow-600'
          : 'bg-gradient-to-br from-blue-500 to-purple-600'
          }`}>
          {getAvatarInitials(clan.name)}
        </div>
        <div className="flex items-center gap-2">
          {clan.tag && (
            <span className="px-2 py-1 bg-gaming-gold/20 text-gaming-gold text-xs font-bold rounded">
              {clan.tag}
            </span>
          )}
          <div className="flex items-center gap-1 px-2 py-1 bg-gaming-border rounded text-xs text-gray-400">
            {getVisibilityIcon(clan.visibility)}
            <span>{getVisibilityLabel(clan.visibility)}</span>
          </div>
        </div>
      </div>

      {/* Clan Name */}
      <h3 className="text-lg font-bold text-white mb-2 truncate">{clan.name}</h3>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-grow">
        {clan.description || 'No description provided'}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-400 border-t border-gaming-border pt-4">
        <div className="flex items-center gap-1">
          <FiUsers className="w-4 h-4" />
          <span>{clan.stats?.totalMembers || 0}/{clan.maxMembers}</span>
        </div>
        {/* <div className="text-xs bg-gaming-gold/10 text-gaming-gold px-2 py-1 rounded">
          {clan.stats?.totalMessages || 0} messages
        </div> */}
      </div>

      {/* Owner Info */}
      <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
        <div className="w-6 h-6 bg-gaming-border rounded-full flex items-center justify-center">
          {clan.owner?.avatarUrl ? (
            <img src={clan.owner.avatarUrl} alt={clan.owner.username} className="w-full h-full rounded-full" />
          ) : (
            <span className="text-xs font-bold">{clan.owner?.username?.[0]?.toUpperCase()}</span>
          )}
        </div>
        <span>Led by {clan.owner?.username}</span>
      </div>

      {/* View Button */}
      <button
        onClick={() => onView(clan._id)}
        className="w-full px-4 py-2 bg-gaming-gold hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
      >
        View Clan
      </button>
    </div>
  );
};

const ClanSkeleton = () => (
  <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6 animate-pulse">
    <div className="w-12 h-12 bg-gaming-border rounded-lg mb-4" />
    <div className="h-6 bg-gaming-border rounded mb-2 w-3/4" />
    <div className="h-4 bg-gaming-border rounded mb-4 w-full" />
    <div className="h-4 bg-gaming-border rounded mb-4 w-2/3" />
    <div className="h-10 bg-gaming-border rounded" />
  </div>
);

const ClanDiscovery = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [gameFilter, setGameFilter] = useState(searchParams.get('game') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'trending');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Fetch clans
  useEffect(() => {
    fetchClans();
  }, [search, gameFilter, sortBy, page]);

  const fetchClans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (search) params.append('search', search);
      if (gameFilter !== 'all') params.append('game', gameFilter);
      params.append('sort', sortBy);
      params.append('page', page);
      params.append('limit', 12);

      const response = await api.get(`/api/clans?${params.toString()}`);

      if (response.success) {
        setClans(response.data.clans);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching clans:', error);
      toast.error('Failed to load clans');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    setPage(1);
    setSearchParams({ search: value, game: gameFilter, sort: sortBy });
  };

  const handleGameFilter = (game) => {
    setGameFilter(game);
    setPage(1);
    setSearchParams({ search, game, sort: sortBy });
  };

  const handleSort = (sort) => {
    setSortBy(sort);
    setPage(1);
    setSearchParams({ search, game: gameFilter, sort });
  };

  const handleViewClan = (clanId) => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      navigate(`/clans/${clanId}`);
    }
  };

  // Determine featured clans (top 3 by activity)
  const featuredClans = clans.slice(0, 3);
  const regularClans = clans.slice(3);

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-gaming font-bold text-white mb-2">
              🎮 Clan Discovery
            </h1>
            <p className="text-gray-400">
              Find and join clans to compete together
            </p>
          </div>
          <button
            onClick={() => navigate('/clans/create')}
            className="flex items-center gap-2 px-6 py-3 bg-gaming-gold hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            Create Clan
          </button>
        </div>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search clans by name, tag, or description..."
              value={search}
              onChange={handleSearch}
              className="w-full pl-12 pr-4 py-3 bg-gaming-charcoal border border-gaming-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gaming-gold transition-colors"
            />
          </div>

          {/* Game Filter Pills */}
          <div className="flex gap-2 flex-wrap">
            {GAME_FILTERS.map(game => (
              <button
                key={game.key}
                onClick={() => handleGameFilter(game.key)}
                className={`px-4 py-2 rounded-full font-semibold transition-all ${gameFilter === game.key
                  ? 'bg-gaming-gold text-black'
                  : 'bg-gaming-charcoal text-gaming-gold border border-gaming-border hover:border-gaming-gold'
                  }`}
              >
                {game.label}
              </button>
            ))}
          </div>

          {/* Sort Options */}
          <div className="flex gap-2 flex-wrap">
            {SORT_OPTIONS.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.key}
                  onClick={() => handleSort(option.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all ${sortBy === option.key
                    ? 'bg-gaming-gold text-black'
                    : 'bg-gaming-charcoal text-gray-400 border border-gaming-border hover:border-gaming-gold'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Featured Clans Section */}
        {!loading && featuredClans.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">⭐ Featured Clans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredClans.map((clan, index) => (
                <ClanCard
                  key={clan._id}
                  clan={clan}
                  onView={handleViewClan}
                  isFeatured={true}
                  rank={index + 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Regular Clans Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[...Array(6)].map((_, i) => (
              <ClanSkeleton key={i} />
            ))}
          </div>
        ) : clans.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-white mb-2">No clans found</h3>
            <p className="text-gray-400 mb-6">
              {search ? 'Try adjusting your search criteria' : 'Be the first to create a clan!'}
            </p>
            <button
              onClick={() => navigate('/clans/create')}
              className="px-6 py-3 bg-gaming-gold hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
            >
              Create Clan
            </button>
          </div>
        ) : (
          <>
            {regularClans.length > 0 && (
              <>
                <h2 className="text-2xl font-bold text-white mb-6">All Clans</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {regularClans.map((clan, index) => (
                    <ClanCard
                      key={clan._id}
                      clan={clan}
                      onView={handleViewClan}
                      isFeatured={false}
                      rank={index + 4}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-gold transition-colors"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {[...Array(pagination.pages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setPage(i + 1)}
                      className={`w-10 h-10 rounded-lg font-bold transition-colors ${page === i + 1
                        ? 'bg-gaming-gold text-black'
                        : 'bg-gaming-charcoal border border-gaming-border text-white hover:border-gaming-gold'
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                  disabled={page === pagination.pages}
                  className="px-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-gold transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ClanDiscovery;
