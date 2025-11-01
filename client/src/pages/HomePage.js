import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { FiPlay, FiAward, FiUsers, FiDollarSign, FiArrowRight, FiCalendar, FiClock } from 'react-icons/fi';
import { fetchTournaments } from '../store/slices/tournamentSlice';
import { selectAuth } from '../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import notificationService from '../services/notificationService';
import { gameImages, heroImages, getGameImage, getRandomTournamentImage } from '../assets/images';
import { getRandomBanner, getRandomHeroBackground } from '../assets/tournamentBanners';
import { getGameAsset, getGameInfo } from '../assets/gameAssets';
import OptimizedImage from '../components/common/OptimizedImage';
import TournamentSkeleton from '../components/common/TournamentSkeleton';
import HeroImageSlider from '../components/common/HeroImageSlider';

const HomePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { tournaments, loading } = useSelector((state) => state.tournaments);
  const { isAuthenticated } = useSelector(selectAuth);
  const [pcTournaments, setPcTournaments] = useState([]);
  const [mobileTournaments, setMobileTournaments] = useState([]);
  const [platformStats, setPlatformStats] = useState({
    totalPlayers: '15K+',
    activeTournaments: '12',
    totalPrizes: '₹2.5L+',
    totalTransactions: '5K+'
  });

  useEffect(() => {
    // Fetch tournaments from API
    dispatch(fetchTournaments({ 
      status: 'registration_open,active', 
      limit: 6 
    }));
    
    // Fetch platform stats
    fetchPlatformStats();
  }, [dispatch]);

  const fetchPlatformStats = async () => {
    try {
      const response = await fetch('/api/tournaments/stats');
      const data = await response.json();
      
      if (data.success) {
        setPlatformStats({
          totalPlayers: data.data.totalPlayers,
          activeTournaments: data.data.activeTournaments,
          totalPrizes: data.data.totalPrizes,
          totalTransactions: data.data.totalTransactions
        });
      }
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      // Keep default values if API fails
    }
  };

  useEffect(() => {
    if (tournaments.length > 0) {
      // Transform API data to match component structure
      const transformedTournaments = tournaments.map(tournament => ({
        id: tournament._id,
        name: tournament.name,
        game: tournament.gameType?.toUpperCase() || 'BGMI',
        gameIcon: getGameIcon(tournament.gameType),
        prizePool: `₹${tournament.prizePool?.toLocaleString() || '0'}`,
        entryFee: `₹${tournament.entryFee || 0}`,
        status: getDisplayStatus(tournament.status),
        participants: `${tournament.currentParticipants || 0}/${tournament.maxParticipants || 100}`,
        timeLeft: getTimeLeft(tournament.registrationDeadline),
        featured: tournament.featured || false,
        gameType: tournament.gameType
      }));

      // Separate PC and Mobile tournaments
      const pc = transformedTournaments.filter(t => 
        ['cs2', 'valorant'].includes(t.gameType)
      );
      const mobile = transformedTournaments.filter(t => 
        ['bgmi', 'freefire', 'ml'].includes(t.gameType)
      );

      setPcTournaments(pc.slice(0, 3));
      setMobileTournaments(mobile.slice(0, 3));
    }
  }, [tournaments]);

  const getGameIcon = (gameType) => {
    switch (gameType) {
      case 'bgmi': return '📱';
      case 'cs2': return '⚡';
      case 'valorant': return '🎯';
      case 'freefire': return '🔥';
      case 'ml': return '🎮';
      default: return '🎮';
    }
  };

  const getDisplayStatus = (status) => {
    switch (status) {
      case 'registration_open': return 'OPEN RANKS';
      case 'active': return 'ONGOING';
      case 'upcoming': return 'UPCOMING';
      default: return 'OPEN RANKS';
    }
  };

  const getTimeLeft = (deadline) => {
    if (!deadline) return '2d 5h';
    
    const now = new Date();
    const end = new Date(deadline);
    const diff = end - now;
    
    if (diff <= 0) return 'Closed';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const handleJoinTournament = (tournament) => {
    if (!isAuthenticated) {
      // Show notification and redirect to login
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

    // Check if tournament is still open for registration
    if (tournament.status === 'ONGOING') {
      notificationService.showCustomNotification(
        'warning',
        'Tournament In Progress',
        'This tournament is already in progress. Registration is closed.'
      );
      return;
    }

    if (tournament.timeLeft === 'Closed') {
      notificationService.showCustomNotification(
        'warning',
        'Registration Closed',
        'Registration for this tournament has closed.'
      );
      return;
    }

    // Navigate to tournament details page for registration
    navigate(`/tournaments/${tournament.id}`);
  };

  const stats = [
    { label: 'Active Players', value: platformStats.totalPlayers },
    { label: 'Live Tournaments', value: platformStats.activeTournaments },
    { label: 'Prize Distributed', value: platformStats.totalPrizes },
    { label: 'Total Transactions', value: platformStats.totalTransactions }
  ];

  const TournamentCard = ({ tournament }) => (
    // <Link to={`/game/${tournament.game.toLowerCase()}`} className="block">
      <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      className="relative bg-gaming-charcoal rounded-xl overflow-hidden border border-gray-700 hover:border-gaming-gold/50 transition-all duration-300 group"
    >
      {/* Tournament Image */}
      <div className="relative h-48 overflow-hidden">
        <OptimizedImage 
          src={getGameAsset(tournament.gameType, 'banner')} 
          alt={tournament.game}
          className="w-full h-full transition-transform duration-300 group-hover:scale-110"
          fallbackSrc={getRandomBanner(tournament.gameType)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
            tournament.status === 'ONGOING' 
              ? 'bg-red-500/90 text-white animate-pulse' 
              : 'bg-gaming-gold/90 text-black'
          }`}>
            {tournament.status}
          </span>
        </div>

        {/* Featured Badge */}
        {tournament.featured && (
          <div className="absolute top-3 right-3">
            <span className="bg-yellow-500/90 text-black px-2 py-1 rounded text-xs font-bold backdrop-blur-sm">
              ⭐ FEATURED
            </span>
          </div>
        )}

        {/* Game Title Overlay */}
        <div className="absolute bottom-4 left-4">
          <Link to={`/game/${tournament.game.toLowerCase()}`}>
            <h3 className="text-2xl font-gaming font-bold text-white hover:text-gaming-gold transition-colors duration-200 cursor-pointer drop-shadow-lg">
              {tournament.game}
            </h3>
          </Link>
        </div>

        {/* Game Icon */}
        <div className="absolute bottom-4 right-4">
          <div className="text-3xl opacity-80 drop-shadow-lg">{tournament.gameIcon}</div>
        </div>
      </div>

      {/* Tournament Info */}
      <div className="p-4">
        <h4 className="font-bold text-white mb-3 text-sm">
          {tournament.name}
        </h4>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Prize Pool:</span>
            <span className="text-gaming-gold font-bold">{tournament.prizePool}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Entry Fee:</span>
            <span className="text-white font-semibold">{tournament.entryFee}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Players:</span>
            <span className="text-white">{tournament.participants}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-400">Time Left:</span>
            <span className="text-yellow-400 font-semibold">{tournament.timeLeft}</span>
          </div>
        </div>

        <div className="mt-4 flex space-x-2">
          <button 
            onClick={() => handleJoinTournament(tournament)}
            disabled={tournament.status === 'ONGOING' || tournament.timeLeft === 'Closed'}
            className={`flex-1 font-bold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-1 ${
              tournament.status === 'ONGOING' || tournament.timeLeft === 'Closed'
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gaming-gold text-black hover:bg-gaming-accent'
            }`}
            title={!isAuthenticated ? 'Login required to join tournaments' : ''}
          >
            {!isAuthenticated && (
              <span className="text-xs">🔒</span>
            )}
            <span>
              {tournament.status === 'ONGOING' 
                ? 'IN PROGRESS' 
                : tournament.timeLeft === 'Closed' 
                  ? 'CLOSED' 
                  : !isAuthenticated
                    ? 'LOGIN TO JOIN'
                    : 'JOIN NOW'
              }
            </span>
          </button>
          <Link 
            to={`/tournaments/${tournament.id}`}
            className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:border-gaming-gold hover:text-gaming-gold transition-colors duration-200"
          >
            VIEW
          </Link>
        </div>
      </div>
    </motion.div>
    // </Link>
  );

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Hero Section with Dynamic Slider */}
      <HeroImageSlider />

      {/* Stats Section */}
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

      {/* PC Tournaments Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-gaming font-bold text-white mb-2">
                PC TOURNAMENTS
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
              // Loading skeleton
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
                  <TournamentCard tournament={tournament} />
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

      {/* Mobile Tournaments Section */}
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
              // Loading skeleton
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
                  <TournamentCard tournament={tournament} />
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

      {/* CTA Section */}
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
    </div>
  );
};

export default HomePage;