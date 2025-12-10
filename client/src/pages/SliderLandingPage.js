// This is the original tournament slider landing page
// Preserved for future use when multiple games are integrated

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { FiArrowRight } from 'react-icons/fi';
import { fetchTournaments } from '../store/slices/tournamentSlice';
import { selectAuth } from '../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import notificationService from '../services/notificationService';
import { getGameAsset } from '../assets/gameAssets';
import { getRandomBanner } from '../assets/tournamentBanners';
import OptimizedImage from '../components/common/OptimizedImage';
import HeroImageSlider from '../components/common/HeroImageSlider';
import SteamLinkingModal from '../components/tournaments/SteamLinkingModal';
import { getSteamAuthUrl } from '../utils/apiConfig';
import { getPlayerCountText } from '../utils/cs2ServerStatus';

const SliderLandingPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { tournaments, loading } = useSelector((state) => state.tournaments);
  const { isAuthenticated, user } = useSelector(selectAuth);
  const [pcTournaments, setPcTournaments] = useState([]);
  const [mobileTournaments, setMobileTournaments] = useState([]);
  const [showSteamModal, setShowSteamModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [platformStats, setPlatformStats] = useState({
    totalPlayers: '15K+',
    activeTournaments: '12',
    totalPrizes: '₹2.5L+',
    totalTransactions: '5K+'
  });

  useEffect(() => {
    dispatch(fetchTournaments({ 
      status: 'upcoming,registration_open,active', 
      limit: 6 
    }));
    fetchPlatformStats();
  }, [dispatch]);

  const fetchPlatformStats = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_URL}/api/tournaments/stats`);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setPlatformStats({
          totalPlayers: data.data.totalPlayers || '0',
          activeTournaments: data.data.activeTournaments || '0',
          totalPrizes: data.data.totalPrizes || '₹0',
          totalTransactions: data.data.totalTransactions || '0'
        });
      }
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    }
  };

  useEffect(() => {
    if (tournaments.length > 0) {
      const transformTournaments = async () => {
        const transformedTournaments = await Promise.all(
          tournaments.map(async (tournament) => {
            let participants = `${tournament.currentParticipants || 0}/${tournament.maxParticipants || 100}`;
            
            // For CS2, fetch real player count from server
            if (tournament.gameType === 'cs2' && tournament.roomDetails?.cs2) {
              try {
                const playerText = await getPlayerCountText(tournament);
                if (playerText && playerText !== 'Server Offline') {
                  participants = playerText;
                }
              } catch (error) {
                console.error('Error fetching CS2 player count:', error);
              }
            }

            return {
              id: tournament._id,
              name: tournament.name,
              game: tournament.gameType?.toUpperCase() || 'BGMI',
              gameIcon: getGameIcon(tournament.gameType),
              prizePool: `₹${tournament.prizePool?.toLocaleString() || '0'}`,
              entryFee: 'FREE',
              status: getDisplayStatus(tournament.status, tournament.gameType),
              participants,
              timeLeft: getTimeLeft(tournament.registrationDeadline),
              featured: tournament.featured || false,
              gameType: tournament.gameType,
              registrationDeadline: tournament.registrationDeadline,
              loginRequired: !isAuthenticated,
              roomDetails: tournament.roomDetails
            };
          })
        );

        const pc = transformedTournaments.filter(t => 
          ['cs2', 'valorant'].includes(t.gameType)
        );
        const mobile = transformedTournaments.filter(t => 
          ['bgmi', 'freefire', 'ml'].includes(t.gameType)
        );

        setPcTournaments(pc.slice(0, 3));
        setMobileTournaments(mobile.slice(0, 3));
      };

      transformTournaments();
    }
  }, [tournaments, isAuthenticated]);

  const getGameIcon = (gameType) => {
    const icons = {
      bgmi: '📱',
      cs2: '⚡',
      valorant: '🎯',
      freefire: '🔥',
      ml: '🎮'
    };
    return icons[gameType] || '🎮';
  };

  const getDisplayStatus = (status, gameType) => {
    // CS2 servers show different status labels
    if (gameType === 'cs2') {
      return status === 'active' ? 'SERVER ONLINE' : 'SERVER OFFLINE';
    }
    
    // Regular tournament statuses
    const statuses = {
      registration_open: 'OPEN RANKS',
      active: 'ACTIVE',
      upcoming: 'UPCOMING'
    };
    return statuses[status] || 'OPEN RANKS';
  };

  const getTimeLeft = (deadline) => {
    if (!deadline) return '2d 5h 30m';
    
    const now = new Date();
    const end = new Date(deadline);
    const diff = end - now;
    
    if (diff <= 0) return 'Closed';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const openSteamForCS2 = async (tournament) => {
    // Check if Steam is already connected
    const steamId = user?.gameIds?.steam || user?.steamProfile?.steamId;
    const isSteamConnected = user?.steamProfile?.isConnected;

    if (!steamId || !isSteamConnected) {
      // Show Steam linking modal if not connected
      setSelectedTournament(tournament);
      setShowSteamModal(true);
      return;
    }

    // Steam connected - directly join tournament
    try {
      const token = localStorage.getItem('token');
      const API_BASE_URL = process.env.REACT_APP_API_URL || '';
      
      const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournament.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          gameId: steamId,
          teamName: ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to join tournament');
      }

      // Success - Launch CS2
      const serverIp = tournament.roomDetails?.cs2?.serverIp || data.data?.tournament?.roomDetails?.cs2?.serverIp;
      const serverPort = tournament.roomDetails?.cs2?.serverPort || data.data?.tournament?.roomDetails?.cs2?.serverPort;
      const password = tournament.roomDetails?.cs2?.password || data.data?.tournament?.roomDetails?.cs2?.password;

      if (serverIp && serverPort) {
        // Show toast and launch directly
        notificationService.showCustomNotification(
          'success',
          'Launching CS2',
          `Connecting to ${serverIp}:${serverPort}`
        );

        const connectCommand = `steam://connect/${serverIp}:${serverPort}${password ? '/' + password : ''}`;
        
        // Launch CS2 after a short delay
        setTimeout(() => {
          window.location.href = connectCommand;
        }, 500);
      }

      // Refresh page to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('❌ Failed to join CS2 tournament:', error);
      notificationService.showCustomNotification(
        'error',
        'Join Failed',
        error.message || 'Failed to join tournament'
      );
    }
  };

  const handleSteamLink = () => {
    const userId = user?.id || user?._id;
    
    if (!userId) {
      notificationService.showCustomNotification(
        'error',
        'Authentication Error',
        'Please login again to continue'
      );
      navigate('/login');
      return;
    }

    setShowSteamModal(false);
    window.location.href = getSteamAuthUrl(userId, `/tournaments/${selectedTournament?.id}`);
  };

  const handleJoinTournament = (tournament) => {
    if (!isAuthenticated) {
      notificationService.showCustomNotification(
        'info',
        'Login Required',
        'Please login to join tournaments',
        '/login'
      );
      
      navigate('/login', { 
        state: { 
          from: `/tournaments/${tournament.id}`,
          message: 'Please login to join tournaments'
        }
      });
      return;
    }

    if (tournament.status === 'ACTIVE') {
      // For CS2, allow joining even if active
      if (tournament.gameType !== 'cs2') {
        notificationService.showCustomNotification(
          'warning',
          'Tournament In Progress',
          'This tournament is already in progress. Registration is closed.'
        );
        return;
      }
    }

    // CS2: Skip all registration checks
    if (tournament.gameType === 'cs2') {
      openSteamForCS2(tournament);
      return;
    }

    // BGMI/Others: Check registration status
    if (tournament.timeLeft === 'Closed') {
      notificationService.showCustomNotification(
        'warning',
        'Registration Closed',
        'Registration for this tournament has closed.'
      );
      return;
    }

    navigate(`/tournaments/${tournament.id}`);
  };

  const stats = [
    { label: 'Active Players', value: platformStats.totalPlayers },
    { label: 'Live Tournaments', value: platformStats.activeTournaments },
    { label: 'Prize Distributed', value: platformStats.totalPrizes },
    { label: 'Total Transactions', value: platformStats.totalTransactions }
  ];

  const TournamentCard = React.memo(({ tournament, onJoinClick }) => {
    return (
      <motion.div
        whileHover={{ y: -5, scale: 1.02 }}
        className="relative bg-gaming-charcoal rounded-xl overflow-hidden border border-gray-700 hover:border-gaming-gold/50 transition-all duration-300 group"
      >
      <div className="relative h-48 overflow-hidden">
        <OptimizedImage 
          src={getGameAsset(tournament.gameType, 'banner')} 
          alt={tournament.game}
          className="w-full h-full transition-transform duration-300 group-hover:scale-110"
          fallbackSrc={getRandomBanner(tournament.gameType)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        <div className="absolute top-3 left-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
            tournament.status === 'ACTIVE' 
              ? 'bg-green-500/90 text-white animate-pulse' 
              : 'bg-gaming-gold/90 text-black'
          }`}>
            {tournament.status}
          </span>
        </div>

        {tournament.featured && (
          <div className="absolute top-3 right-3">
            <span className="bg-yellow-500/90 text-black px-2 py-1 rounded text-xs font-bold backdrop-blur-sm">
              ⭐ FEATURED
            </span>
          </div>
        )}

        <div className="absolute bottom-4 left-4">
          <Link to={`/game/${tournament.game.toLowerCase()}`}>
            <h3 className="text-2xl font-gaming font-bold text-white hover:text-gaming-gold transition-colors duration-200 cursor-pointer drop-shadow-lg">
              {tournament.game}
            </h3>
          </Link>
        </div>

        <div className="absolute bottom-4 right-4">
          <div className="text-3xl opacity-80 drop-shadow-lg">{tournament.gameIcon}</div>
        </div>
      </div>

      <div className="p-4">
        <h4 className="font-bold text-white mb-3 text-sm">
          {tournament.name}
        </h4>

        <div className="space-y-2 text-sm">
          {/* CS2: Show as Server, not Tournament */}
          {tournament.gameType !== 'cs2' && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-400">Prize Pool:</span>
                <span className="text-gaming-gold font-bold">{tournament.prizePool}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Entry Fee:</span>
                <span className="text-green-400 font-bold">FREE</span>
              </div>
            </>
          )}
          
          <div className="flex justify-between">
            <span className="text-gray-400">{tournament.gameType === 'cs2' ? 'Server:' : 'Players:'}</span>
            <span className="text-white">{tournament.participants}</span>
          </div>
          
          {tournament.gameType === 'cs2' && (
            <div className="flex justify-between">
              <span className="text-gray-400">Type:</span>
              <span className="text-orange-400 font-bold">Active Server</span>
            </div>
          )}
        </div>

        <div className="mt-4">
          {tournament.gameType === 'cs2' ? (
            // CS2: Quick Launch + View buttons
            <div className="flex space-x-2">
              <button
                onClick={() => onJoinClick(tournament)}
                className="flex-1 font-bold py-3 px-4 rounded-lg transition-colors duration-200 bg-gaming-gold text-black hover:bg-gaming-accent flex items-center justify-center space-x-1"
              >
                <span>🚀</span>
                <span>QUICK LAUNCH</span>
              </button>
              <Link 
                to={`/tournaments/${tournament.id}`}
                className="px-4 py-3 border-2 border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-colors duration-200 flex items-center justify-center"
              >
                <span>VIEW</span>
              </Link>
            </div>
          ) : (
            // BGMI/Others: Single JOIN NOW button
            <Link 
              to={`/tournaments/${tournament.id}`}
              className="w-full block text-center font-bold py-3 px-4 rounded-lg transition-colors duration-200 bg-gaming-gold text-black hover:bg-gaming-accent"
            >
              {tournament.loginRequired && <span className="text-xs mr-1">🔒</span>}
              JOIN NOW
            </Link>
          )}
        </div>
      </div>
    </motion.div>
    );
  });

  const handleJoinTournamentCallback = React.useCallback((tournament) => {
    handleJoinTournament(tournament);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-theme-bg-primary">
      <HeroImageSlider />

      <section className="py-12 bg-gaming-charcoal/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-gaming font-bold text-gaming-gold mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-400 text-sm md:text-base">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-gaming font-bold text-white mb-2">
                PC GAMES
              </h2>
              <div className="text-gaming-gold font-semibold">{pcTournaments.length} Active</div>
            </div>
            <Link 
              to="/tournaments?category=pc" 
              className="text-gaming-gold hover:text-gaming-accent font-semibold flex items-center space-x-1"
            >
              <span>SHOW ALL</span>
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="bg-gaming-charcoal rounded-xl overflow-hidden border border-gray-700 animate-pulse">
                  <div className="h-48 bg-gray-700"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-700 rounded"></div>
                      <div className="h-3 bg-gray-700 rounded"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                    <div className="flex space-x-2 pt-2">
                      <div className="flex-1 h-8 bg-gray-700 rounded"></div>
                      <div className="w-16 h-8 bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : pcTournaments.length > 0 ? (
              pcTournaments.map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <TournamentCard tournament={tournament} onJoinClick={handleJoinTournamentCallback} />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-400 text-lg">No PC tournaments available</div>
                <Link to="/tournaments" className="text-gaming-gold hover:text-gaming-accent mt-2 inline-block">
                  View all tournaments
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gaming-charcoal/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-gaming font-bold text-white mb-2">
                MOBILE TOURNAMENTS
              </h2>
              <div className="text-gaming-gold font-semibold">{mobileTournaments.length} Active</div>
            </div>
            <Link 
              to="/tournaments?category=mobile" 
              className="text-gaming-gold hover:text-gaming-accent font-semibold flex items-center space-x-1"
            >
              <span>SHOW ALL</span>
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="bg-gaming-charcoal rounded-xl overflow-hidden border border-gray-700 animate-pulse">
                  <div className="h-48 bg-gray-700"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-700 rounded"></div>
                      <div className="h-3 bg-gray-700 rounded"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                    <div className="flex space-x-2 pt-2">
                      <div className="flex-1 h-8 bg-gray-700 rounded"></div>
                      <div className="w-16 h-8 bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : mobileTournaments.length > 0 ? (
              mobileTournaments.map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <TournamentCard tournament={tournament} onJoinClick={handleJoinTournamentCallback} />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-400 text-lg">No mobile tournaments available</div>
                <Link to="/tournaments" className="text-gaming-gold hover:text-gaming-accent mt-2 inline-block">
                  View all tournaments
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-gaming-neon/10 to-gaming-neon-blue/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-5xl font-gaming font-bold text-white mb-6">
              Ready to Dominate?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of gamers competing for glory and prizes
            </p>
            <Link to="/register" className="btn-gaming text-lg px-8 py-4">
              Start Your Journey
            </Link>
          </motion.div>
        </div>
      </section>

      <SteamLinkingModal
        isOpen={showSteamModal}
        onClose={() => setShowSteamModal(false)}
        onConfirm={handleSteamLink}
        tournamentName={selectedTournament?.name || 'this tournament'}
      />
    </div>
  );
};

export default SliderLandingPage;
