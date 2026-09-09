import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageBannerSlider from '../components/common/PageBannerSlider';
import ValorantRegistrationForm from '../components/valorant/ValorantRegistrationForm';
import GameIcon from '../components/common/GameIcon';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CountdownTimer from '../components/common/CountdownTimer';
import { getCdnIcon } from '../assets/gameAssets';
import { selectUser } from '../store/slices/authSlice';
import {
  fetchTournaments,
  selectTournaments,
  selectTournamentLoading,
  selectTournamentError,
  selectTournamentPagination,
  clearError
} from '../store/slices/tournamentSlice';

const ValorantPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const tournaments = useSelector(selectTournaments);
  const loading = useSelector(selectTournamentLoading);
  const error = useSelector(selectTournamentError);
  const pagination = useSelector(selectTournamentPagination);

  const [activeTab, setActiveTab] = useState('upcoming');
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const status = getStatusFromTab(activeTab);
    dispatch(fetchTournaments({
      gameType: 'valorant',
      status,
      page: 1,
      limit: 12
    }));

    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, activeTab]);

  const getStatusFromTab = (tab) => {
    switch (tab) {
      case 'upcoming':
        return 'upcoming,registration_open,registration_closed';
      case 'live':
        return 'active';
      case 'completed':
        return 'completed';
      default:
        return 'upcoming,registration_open,registration_closed';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming':
        return 'text-blue-400 bg-blue-400/10';
      case 'registration_open':
        return 'text-green-400 bg-green-400/10';
      case 'active':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'completed':
        return 'text-gray-400 bg-gray-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const handleRegisterClick = (tournament) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setSelectedTournament(tournament);
    setShowRegistrationForm(true);
  };

  const handleRegistrationSuccess = () => {
    setShowRegistrationForm(false);
    setSelectedTournament(null);
  };

  const handleCloseRegistrationForm = () => {
    setShowRegistrationForm(false);
    setSelectedTournament(null);
  };

  if (!tournaments) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  if (loading && isInitialLoad) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading Valorant tournaments..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark">
      <PageBannerSlider pageKey="valorant" height="h-96" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card-gaming p-6 mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'live', label: 'Live' },
              { key: 'completed', label: 'Completed' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center space-x-2 px-4 py-2 font-display font-medium transition-all duration-200 border ${
                  activeTab === tab.key
                    ? 'bg-gaming-gold/20 border-gaming-gold text-gaming-gold'
                    : 'bg-white/5 border-white/20 text-gray-300 hover:border-gaming-gold/60 hover:bg-white/10'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="card-gaming p-6 mb-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Error Loading Tournaments</h3>
              <p className="text-gray-300 mb-4">{error.message}</p>
              <button
                onClick={() => {
                  dispatch(clearError());
                  dispatch(fetchTournaments({ gameType: 'valorant', status: getStatusFromTab(activeTab) }));
                }}
                className="px-6 py-2 bg-white/5 border border-white/20 text-white font-display font-bold hover:border-gaming-gold/60 hover:bg-white/10 transition-all duration-300"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          {loading && !isInitialLoad && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-lg flex items-center justify-center z-10 pointer-events-none">
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gaming-neon border-t-transparent"></div>
                <p className="text-gaming-neon text-sm font-display">Loading tournaments...</p>
              </div>
            </div>
          )}

          {!tournaments || tournaments.length === 0 ? (
            <div className="card-gaming p-8 text-center col-span-full">
              <div className="text-gray-400 text-6xl mb-4">
                <img src={getCdnIcon('features', 'tournaments')} alt="No tournaments" className="w-16 h-16 mx-auto opacity-50" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No Valorant Tournaments Found</h2>
              <p className="text-gray-300 mb-4">
                {activeTab === 'upcoming'
                  ? 'No upcoming tournaments at the moment. Check back soon!'
                  : activeTab === 'live'
                  ? 'No live tournaments right now.'
                  : 'No completed tournaments to show.'}
              </p>
            </div>
          ) : (
            tournaments.map((tournament) => (
              <TournamentCard
                key={tournament._id}
                tournament={tournament}
                navigate={navigate}
                getStatusColor={getStatusColor}
                formatDate={formatDate}
                onRegisterClick={handleRegisterClick}
              />
            ))
          )}
        </div>

        {showRegistrationForm && selectedTournament && (
          <ValorantRegistrationForm
            tournament={selectedTournament}
            onClose={handleCloseRegistrationForm}
            onSuccess={handleRegistrationSuccess}
          />
        )}

        {pagination.pages > 1 && (
          <div className="card-gaming p-4 mt-6">
            <div className="flex items-center justify-between">
              <div className="text-gray-300 text-sm">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} tournaments
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => dispatch(fetchTournaments({
                    gameType: 'valorant',
                    status: getStatusFromTab(activeTab),
                    page: pagination.page - 1
                  }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 bg-white/5 border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-gold/60 hover:bg-white/10 font-display font-bold transition-all duration-300"
                >
                  Previous
                </button>
                <span className="px-3 py-1 bg-gaming-gold/20 border border-gaming-gold text-gaming-gold font-display font-bold">
                  {pagination.page}
                </span>
                <button
                  onClick={() => dispatch(fetchTournaments({
                    gameType: 'valorant',
                    status: getStatusFromTab(activeTab),
                    page: pagination.page + 1
                  }))}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 py-1 bg-white/5 border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-gold/60 hover:bg-white/10 font-display font-bold transition-all duration-300"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="card-gaming p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <GameIcon gameType="valorant" size="sm" />
              <span>Valorant Tournament Rules</span>
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              <div>• Team rosters (5 starters + optional substitute) are locked after registration deadline</div>
              <div>• Match/server details will be shared before your match</div>
              <div>• No third-party apps or cheats allowed</div>
              <div>• Disputes must be raised within 24 hours</div>
            </div>
          </div>

          <div className="card-gaming p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <GameIcon gameType="valorant" size="sm" />
              <span>How to Register</span>
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              <div>1. Register your 5-player team (Riot ID for each player)</div>
              <div>2. Add a substitute if you have one (optional)</div>
              <div>3. Wait for admin to verify your roster</div>
              <div>4. Receive match details via WhatsApp once verified</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TournamentCard = React.memo(({ tournament, navigate, getStatusColor, formatDate, onRegisterClick }) => {
  const isRegistrationClosed = tournament.status === 'registration_closed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative w-full aspect-[4/5] overflow-hidden border border-gaming-gold/70 hover:border-gaming-gold transition-all duration-300 group bg-gradient-to-br from-gaming-charcoal via-gaming-dark to-gaming-darker shadow-xl hover:shadow-gaming-gold/40"
      style={{
        clipPath: 'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)'
      }}
    >
      <div className="absolute inset-0">
        {tournament.bannerImage ? (
          <img src={tournament.bannerImage} alt={tournament.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-900 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/85" />
      </div>

      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        {isRegistrationClosed && (
          <div className="px-3 py-1.5 border border-gaming-gold/60 rounded-full text-xs font-display font-bold text-gaming-gold">
            REGISTRATION CLOSED
          </div>
        )}
        {tournament?.startDate && new Date(tournament.startDate) > new Date() && (
          <div className="px-3 py-1.5 backdrop-blur-md border border-blue-200/50 rounded-full text-xs font-display font-bold text-white">
            <CountdownTimer targetDate={tournament.startDate} format="compact" size="sm" showLabels={false} className="text-white" />
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex flex-col justify-between p-5">
        {!isRegistrationClosed && (
          <div className="flex justify-end">
            <div className={`px-2.5 py-1 rounded-full text-xs font-display font-bold ${getStatusColor(tournament.status)}`}>
              {tournament.status === 'completed' ? 'FINISHED' : tournament.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-gaming-gold font-display font-bold">PRIZE:</span>
              <span className="text-white font-display font-bold">₹{((tournament.prizePool || 0) / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-gaming-gold font-display font-bold">ENTRY:</span>
              <span className="text-white font-display font-bold">₹{tournament.entryFee || 0}</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-gaming-gold font-display font-bold">TEAMS:</span>
              <span className="text-white font-display font-bold">{tournament.currentParticipants}/{tournament.maxParticipants}</span>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-gaming-gold/20 via-gaming-gold/40 to-gaming-gold/20" />

          <div className="flex justify-between items-center text-xs">
            <div>
              <div className="text-gaming-gold font-display font-bold text-xs">REG DEADLINE</div>
              <div className="text-white font-display text-xs">{tournament.registrationDeadline ? formatDate(tournament.registrationDeadline).split(',')[0] : '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-gaming-gold font-display font-bold text-xs">STARTS</div>
              <div className="text-white font-display text-xs">{tournament.startDate ? formatDate(tournament.startDate).split(',')[0] : '—'}</div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/tournaments/${tournament._id}`)}
            className="w-full py-2 px-3 mt-2 bg-white/10 backdrop-blur-md border border-white/20 hover:border-gaming-gold/60 hover:bg-white/20 text-white font-display font-bold text-xs rounded-lg transition-all duration-300 shadow-lg hover:shadow-gaming-gold/40"
          >
            VIEW DETAILS →
          </button>
        </div>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return prevProps.tournament._id === nextProps.tournament._id &&
         prevProps.tournament.currentParticipants === nextProps.tournament.currentParticipants &&
         prevProps.tournament.status === nextProps.tournament.status;
});

export default ValorantPage;
