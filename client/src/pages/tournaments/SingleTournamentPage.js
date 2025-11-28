import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  FiArrowLeft,
  FiShare2,
  FiUsers,
  FiCalendar,
  FiDollarSign,
  FiMapPin,
  FiAward,
  FiInfo,
  FiMessageCircle,
  FiKey,
  FiCopy
} from 'react-icons/fi';
import { selectAuth } from '../../store/slices/authSlice';
import TournamentRegistration from '../../components/tournaments/TournamentRegistration';
import SteamLinkingModal from '../../components/tournaments/SteamLinkingModal';
import { getGameImage } from '../../assets/images';
import { getRandomBanner } from '../../assets/tournamentBanners';
import { getGameAsset } from '../../assets/gameAssets';
import OptimizedImage from '../../components/common/OptimizedImage';
import CountdownTimer from '../../components/common/CountdownTimer';
import { getSteamAuthUrl } from '../../utils/apiConfig';

const SingleTournamentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(selectAuth);
  const [activeTab, setActiveTab] = useState('general');
  const [showRegistration, setShowRegistration] = useState(false);
  const [showSteamModal, setShowSteamModal] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [isUserRegistered, setIsUserRegistered] = useState(false);
  const [registeredTeams, setRegisteredTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Share tournament function
  const handleShareTournament = React.useCallback(() => {
    const tournamentUrl = window.location.href;
    const shareText = `Check out this tournament: ${tournament?.name}\nPrize Pool: ₹${tournament?.prizePool?.toLocaleString()}\nJoin now!`;
    
    // Check if Web Share API is available
    if (navigator.share) {
      navigator.share({
        title: tournament?.name || 'Tournament',
        text: shareText,
        url: tournamentUrl
      }).catch((error) => {
        console.log('Error sharing:', error);
      });
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(`${shareText}\n${tournamentUrl}`).then(() => {
        alert('Tournament link copied to clipboard!');
      }).catch((error) => {
        console.error('Failed to copy:', error);
      });
    }
  }, [tournament]);

  const fetchRegisteredTeams = React.useCallback(async () => {
    try {
      setLoadingTeams(true);
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const API_BASE_URL = process.env.REACT_APP_API_URL || '';

      const response = await fetch(`${API_BASE_URL}/api/tournaments/${id}/participants`, { headers });
      const data = await response.json();

      if (data.success) {
        setRegisteredTeams(data.data.participants || []);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  }, [id]);

  // Check for Steam connection success and refresh user data
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('steam_connected') === 'true') {
      // Refresh user data from server
      const refreshUserData = async () => {
        try {
          const token = localStorage.getItem('token');
          if (token) {
            const response = await fetch('/api/auth/profile', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
              const data = await response.json();
              // Update Redux store with fresh user data
              if (data.success && data.data.user) {
                dispatch({ type: 'auth/loginSuccess', payload: { user: data.data.user, token } });
                console.log('✅ User data refreshed with Steam ID:', data.data.user.gameIds?.steam);
              }
            }
          }
        } catch (error) {
          console.error('Failed to refresh user data:', error);
        }
      };
      
      refreshUserData();
      
      // Clean URL
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, dispatch]);

  useEffect(() => {
    // Fetch real tournament data
    const fetchTournamentData = async () => {
      setLoadingTournament(true);
      setFetchError(null);
      
      try {
        console.log('🔍 Fetching tournament:', id);
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const API_BASE_URL = process.env.REACT_APP_API_URL || '';

        // Add timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${API_BASE_URL}/api/tournaments/${id}`, { 
          headers,
          signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Tournament data received:', data);

        if (data.success) {
          const tournamentData = data.data.tournament;

          // Add missing properties for compatibility
          const enhancedTournament = {
            ...tournamentData,
            closesIn: '2 hours 30 minutes', // Default value
            gameIcon: tournamentData.gameType === 'bgmi' ? '🎮' :
              tournamentData.gameType === 'cs2' ? '⚡' : '🎯',
            background: 'linear-gradient(135deg, #00d4ff 0%, #000000 100%)',
            registration: {
              closesIn: '2 hours 30 minutes',
              prizePool: `₹${tournamentData.prizePool?.toLocaleString() || '0'}`,
              participants: {
                current: tournamentData.currentParticipants || 0,
                max: tournamentData.maxParticipants || 100
              }
            },
            details: {
              level: tournamentData.gameType?.toUpperCase() || 'BGMI',
              platform: tournamentData.mode?.toUpperCase() || 'SQUAD',
              format: tournamentData.format || 'Battle Royale',
              tournamentDates: tournamentData.startDate ?
                new Date(tournamentData.startDate).toLocaleDateString() : 'TBD',
              region: tournamentData.region || 'India',
              language: 'Multiple Maps',
              server: `Max ${tournamentData.maxParticipants || 100} players`
            },
            rules: {
              description: tournamentData.rules || 'Tournament rules will be updated soon.'
            },
            rewards: {
              winner: `₹${tournamentData.prizePool?.toLocaleString() || '0'}`,
              description: 'Prizes will be distributed after tournament completion.'
            }
          };

          // Add room details directly if available
          if (data.data.roomDetails) {
            enhancedTournament.roomDetails = data.data.roomDetails;
          }

          setTournament(enhancedTournament);
          
          console.log('👤 User registration status:', data.data.isUserRegistered);
          console.log('🎮 Room details available:', !!data.data.roomDetails);
          
          setIsUserRegistered(data.data.isUserRegistered || false);
          setLoadingTournament(false);
        }
      } catch (error) {
        console.error('Failed to fetch tournament:', error);
        setFetchError(error.message);
        
        // Show error message instead of mock data
        if (error.name === 'AbortError') {
          console.error('Request timeout - server not responding');
          setFetchError('Server is not responding. Please check if the backend is running.');
        }
        
        setLoadingTournament(false);
        
        // Fallback to mock data for development
        const mockTournament = {
          id: 1,
          name: 'COLAB ASIA DIVAS',
          game: 'VALORANT',
          gameIcon: '🎯',
          status: 'UPCOMING',
          background: 'linear-gradient(135deg, #ff4655 0%, #000000 100%)',
          closesIn: '04:03h:16m:14s',
          prizePool: 50000,
          entryFee: 500,
          currentParticipants: 12,
          maxParticipants: 100,
          gameType: 'bgmi',
          mode: 'squad',
          format: 'Battle Royale',
          region: 'India',
          rules: 'Tournament rules and regulations will be displayed here',

          // Tournament Details
          details: {
            level: 'Free Fire',
            platform: 'Mobile',
            format: 'Battle Royale, Squad',
            tournamentDates: '25 Oct 2025 - 25 Oct 2025',
            region: 'India',
            language: 'Bermuda, Kalahari, Purgatory, Alpine, NeXt terra',
            server: 'SA (South Asia)'
          },

          // Registration & Prize
          registration: {
            closesIn: '04:03h:16m:14s',
            prizePool: '₹50,000',
            participants: { current: 12, max: 100 }
          },

          // Rules
          rules: {
            description: 'Tournament rules and regulations will be displayed here',
            pointsDistribution: 'Points will be distributed based on performance'
          },

          // Rewards
          rewards: {
            winner: '₹50,000',
            description: 'Prizes will be distributed 24h after tournament finishes'
          },

          // Room/Server Details (shown after registration)
          roomDetails: {
            bgmi: {
              roomId: 'BG123456',
              password: 'COLAB2025',
              map: 'Erangel',
              perspective: 'TPP',
              mode: 'Squad'
            },
            cs2: {
              serverIp: '103.21.58.132',
              serverPort: '27015',
              password: 'tournament123',
              connectCommand: 'steam://connect/103.21.58.132:27015/tournament123',
              rconPassword: 'admin123'
            }
          },

          // User registration status
          userRegistered: isAuthenticated && user?.tournaments?.includes(id)
        };

        setTournament(mockTournament);
        setIsUserRegistered(mockTournament.userRegistered);
        setLoadingTournament(false);
      }
    };

    fetchTournamentData();
    fetchRegisteredTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Only re-fetch when tournament id changes

  // Memoize handler functions BEFORE any conditional returns
  const handleSteamLink = React.useCallback(() => {
    const userId = user?.id || user?._id;
    
    if (!userId) {
      alert('Authentication error. Please login again.');
      navigate('/login');
      return;
    }

    setShowSteamModal(false);
    
    // Direct redirect to Steam OAuth - uses dynamic URL
    window.location.href = getSteamAuthUrl(userId, `/tournaments/${id}`);
  }, [user, navigate, id]);

  const handleJoinTournament = React.useCallback(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Open registration modal directly - Steam check will happen inside
    setShowRegistration(true);
  }, [isAuthenticated, tournament, user, navigate]);

  const handleRegistrationSuccess = React.useCallback(() => {
    setShowRegistration(false);
    setIsUserRegistered(true);
    
    // Refresh tournament data and teams
    fetchRegisteredTeams();
    
    // Reload page to fetch updated tournament data with room details
    window.location.reload();
  }, [fetchRegisteredTeams]);

  // Early return AFTER all hooks
  if (loadingTournament) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading tournament...</p>
        </div>
      </div>
    );
  }

  // Show error state if fetch failed
  if (fetchError && !tournament) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Failed to Load Tournament</h2>
          <p className="text-gray-400 mb-6">{fetchError}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-gaming w-full"
            >
              Try Again
            </button>
            <Link
              to="/games"
              className="block w-full px-6 py-3 bg-gaming-slate hover:bg-gaming-card text-white rounded-lg transition-colors"
            >
              Back to Games
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎮</div>
          <h2 className="text-2xl font-bold text-white mb-2">Tournament Not Found</h2>
          <p className="text-gray-400 mb-6">The tournament you're looking for doesn't exist.</p>
          <Link
            to="/games"
            className="btn-gaming"
          >
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'GENERAL', icon: FiInfo },
    { id: 'teams', label: 'TEAMS', icon: FiUsers },
    { id: 'chat', label: 'CHAT', icon: FiMessageCircle }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">DESCRIPTION</h3>
              <div className="relative bg-gaming-card rounded-lg border border-gaming-border overflow-hidden">
                {/* Background Image */}
                <div className="absolute inset-0 opacity-10">
                  <OptimizedImage 
                    src={getGameAsset(tournament?.gameType, 'thumbnail')} 
                    alt="Game Background"
                    className="w-full h-full"
                    fallbackSrc={getRandomBanner(tournament?.gameType)}
                  />
                </div>
                
                <div className="relative z-10 p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-gaming-gold">
                      <OptimizedImage 
                        src={getGameAsset(tournament?.gameType, 'logo')} 
                        alt={tournament?.gameType}
                        className="w-full h-full"
                        fallbackSrc="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=32&h=32&fit=crop&crop=center"
                      />
                    </div>
                    <div>
                      <div className="text-white font-semibold">GAME TYPE</div>
                      <div className="text-gray-400 text-sm">{tournament?.gameType?.toUpperCase() || tournament?.details?.level || 'BGMI'}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                      <FiUsers className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">MODE</div>
                      <div className="text-gray-400 text-sm">{tournament?.mode?.toUpperCase() || tournament?.details?.platform || 'SQUAD'}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-600 rounded flex items-center justify-center">
                      <FiAward className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">FORMAT</div>
                      <div className="text-gray-400 text-sm">{tournament?.format || tournament?.details?.format || 'Battle Royale'}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-6 h-6 bg-gray-600 rounded flex items-center justify-center">
                      <FiCalendar className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">START DATE</div>
                      <div className="text-gray-400 text-sm">
                        {tournament?.startDate ? new Date(tournament.startDate).toLocaleDateString() : tournament?.details?.tournamentDates || 'TBD'}
                      </div>
                    </div>
                  </div>

                  {/* Registration Countdown */}
                  {tournament?.registrationDeadline && new Date(tournament.registrationDeadline) > new Date() && (
                    <div className="mb-4 p-3 bg-gaming-neon/10 border border-gaming-neon/30 rounded-lg">
                      <div className="text-gaming-neon font-semibold text-sm mb-2">REGISTRATION CLOSES IN</div>
                      <CountdownTimer 
                        targetDate={tournament.registrationDeadline}
                        format="compact"
                        size="sm"
                        showLabels={false}
                      />
                    </div>
                  )}

                  {/* Tournament Start Countdown */}
                  {tournament?.startDate && new Date(tournament.startDate) > new Date() && (
                    <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <div className="text-blue-400 font-semibold text-sm mb-2">TOURNAMENT STARTS IN</div>
                      <CountdownTimer 
                        targetDate={tournament.startDate}
                        format="compact"
                        size="sm"
                        showLabels={false}
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-6 h-6 bg-gray-600 rounded flex items-center justify-center">
                      <FiMapPin className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">REGION</div>
                      <div className="text-gray-400 text-sm">{tournament?.region || tournament?.details?.region || 'India'}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-6 h-6 bg-gray-600 rounded flex items-center justify-center">
                      <FiDollarSign className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">ENTRY FEE</div>
                      <div className="text-green-400 text-sm font-bold">FREE</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-gray-600 rounded flex items-center justify-center">
                      <FiUsers className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">MAX PARTICIPANTS</div>
                      <div className="text-gray-400 text-sm">{tournament?.maxParticipants || tournament?.details?.server || '100'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tournament Rules */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">TOURNAMENT RULES</h3>
              <div className="bg-gaming-card p-4 rounded-lg border border-gaming-border">
                <div className="text-gaming-gold mb-2">Tournament rules and regulations</div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-4 h-4 bg-gaming-gold rounded"></div>
                  <span className="text-white text-sm">Points distribution</span>
                </div>
                <p className="text-gray-400 text-sm">
                  {tournament?.rules?.description || tournament?.rules || tournament?.description || 'Tournament rules will be updated soon.'}
                </p>
              </div>
            </div>

            {/* Rewards */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">REWARDS</h3>
              <div className="bg-gaming-card p-4 rounded-lg border border-gaming-border">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-gaming-gold rounded flex items-center justify-center">
                    <FiAward className="h-4 w-4 text-black" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg">₹{tournament?.prizePool?.toLocaleString() || tournament?.rewards?.winner || '0'}</div>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  {tournament?.rewards?.description || 'Prizes will be distributed after tournament completion.'}
                </p>
              </div>
            </div>

            {/* Room/Server Details (Only shown if user is registered) */}
            {isUserRegistered && tournament?.roomDetails && (
              <div>
                <h3 className="text-lg font-bold text-white mb-4">
                  {tournament.gameType === 'bgmi' ? 'ROOM DETAILS' : 'SERVER DETAILS'}
                </h3>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <FiKey className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 font-bold">
                      {tournament.gameType === 'bgmi' ? 'Room Credentials' : 'Server Connection'}
                    </span>
                  </div>

                  {/* Debug Info - Remove after testing */}
                  {console.log('🎮 Game Type:', tournament.gameType)}
                  {console.log('📋 Room Details:', tournament.roomDetails)}

                  {tournament.gameType === 'bgmi' && tournament.roomDetails?.bgmi && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-gray-400 text-sm">Room ID</div>
                          <div className="text-white font-mono text-lg bg-gaming-dark p-2 rounded">
                            {tournament.roomDetails.bgmi.roomId}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm">Password</div>
                          <div className="text-white font-mono text-lg bg-gaming-dark p-2 rounded">
                            {tournament.roomDetails.bgmi.password}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400">Map</div>
                          <div className="text-white font-bold">{tournament.roomDetails.bgmi.map}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Perspective</div>
                          <div className="text-white font-bold">{tournament.roomDetails.bgmi.perspective}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Mode</div>
                          <div className="text-white font-bold">{tournament.roomDetails.bgmi.mode}</div>
                        </div>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 mt-4">
                        <div className="text-blue-400 text-sm font-medium mb-1">Instructions:</div>
                        <div className="text-gray-300 text-xs space-y-1">
                          <div>1. Open BGMI and go to Custom Room</div>
                          <div>2. Enter Room ID and Password</div>
                          <div>3. Join the room 10 minutes before start time</div>
                          <div>4. Take screenshots for result verification</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {tournament.gameType === 'cs2' && tournament.roomDetails?.cs2 && (
                    <div className="space-y-4">
                      {/* Server Status */}
                      <div className="flex items-center justify-between bg-gaming-dark p-3 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-white font-semibold">Server Online</span>
                        </div>
                        <div className="text-gray-400 text-sm">
                          Ping: <span className="text-green-400">~25ms</span>
                        </div>
                      </div>

                      {/* Server Details Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Server IP</div>
                          <div className="text-white font-mono text-lg bg-gaming-dark p-3 rounded border border-gaming-border">
                            {tournament.roomDetails.cs2.serverIp}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Port</div>
                          <div className="text-white font-mono text-lg bg-gaming-dark p-3 rounded border border-gaming-border">
                            {tournament.roomDetails.cs2.serverPort}
                          </div>
                        </div>
                      </div>

                      {/* Quick Connect Command */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-gray-400 text-sm font-semibold">Quick Connect Command</div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(tournament.roomDetails.cs2.connectCommand);
                              alert('Command copied to clipboard!');
                            }}
                            className="px-3 py-1 bg-gaming-gold hover:bg-yellow-500 text-black text-xs font-bold rounded transition-colors flex items-center space-x-1"
                          >
                            <FiCopy className="h-3 w-3" />
                            <span>COPY</span>
                          </button>
                        </div>
                        <div className="bg-gaming-dark p-3 rounded font-mono text-sm text-gaming-neon border-2 border-gaming-neon/50 break-all">
                          {tournament.roomDetails.cs2.connectCommand}
                        </div>
                      </div>

                      {/* Enhanced Instructions */}
                      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="text-blue-400 font-bold mb-3 flex items-center space-x-2">
                          <span className="text-lg">📋</span>
                          <span>How to Join Server:</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">1</div>
                            <div>
                              <div className="text-white font-semibold text-sm">Copy Connect Command</div>
                              <div className="text-gray-300 text-xs">Click the COPY button above to copy the server command</div>
                            </div>
                          </div>
                          <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">2</div>
                            <div>
                              <div className="text-white font-semibold text-sm">Launch CS2</div>
                              <div className="text-gray-300 text-xs">Open Counter-Strike 2 through Steam</div>
                            </div>
                          </div>
                          <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">3</div>
                            <div>
                              <div className="text-white font-semibold text-sm">Open Console</div>
                              <div className="text-gray-300 text-xs">Press <span className="bg-gaming-dark px-2 py-0.5 rounded font-mono">~</span> key to open developer console</div>
                            </div>
                          </div>
                          <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">4</div>
                            <div>
                              <div className="text-white font-semibold text-sm">Paste & Connect</div>
                              <div className="text-gray-300 text-xs">Paste the command (Ctrl+V) and press Enter</div>
                            </div>
                          </div>
                          <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">5</div>
                            <div>
                              <div className="text-white font-semibold text-sm">Wait in Lobby</div>
                              <div className="text-gray-300 text-xs">Join 10 minutes before tournament start. Admin will begin the match.</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Important Notes */}
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                        <div className="text-yellow-400 font-semibold text-sm mb-2">⚠️ Important Notes:</div>
                        <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
                          <li>Results are automatically tracked by the server</li>
                          <li>Do not leave the server during the match</li>
                          <li>Follow admin instructions in server chat</li>
                          <li>Cheating will result in immediate disqualification</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 'teams':
        return (
          <div className="space-y-6">
            {/* Teams Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">REGISTERED TEAMS</h3>
                <p className="text-gray-400 text-sm">
                  {registeredTeams.length} / {tournament?.maxParticipants || 100} teams registered
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gaming-gold">
                  {registeredTeams.length}
                </div>
                <div className="text-xs text-gray-400">Teams</div>
              </div>
            </div>

            {loadingTeams ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gaming-gold"></div>
                <span className="ml-3 text-gray-300">Loading teams...</span>
              </div>
            ) : registeredTeams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {registeredTeams.map((team, index) => (
                  <div key={team._id || index} className="bg-gaming-card border border-gaming-border rounded-lg p-4 hover:border-gaming-gold transition-colors">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-gaming-neon to-gaming-neon-blue rounded-full flex items-center justify-center text-white font-bold">
                        {team.teamName ? team.teamName.charAt(0).toUpperCase() : team.playerName?.charAt(0).toUpperCase() || 'T'}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold">
                          {team.teamName || `Team ${index + 1}`}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {tournament?.mode === 'solo' ? 'Solo Player' : 'Team'}
                        </div>
                      </div>
                      <div className="text-xs text-gaming-gold font-semibold">
                        #{index + 1}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Player:</span>
                        <span className="text-white font-medium">{team.playerName}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Game ID:</span>
                        <span className="text-gaming-neon font-mono text-xs">
                          {team.gameId || 'Hidden'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Registered:</span>
                        <span className="text-gray-300 text-xs">
                          {team.registeredAt ? new Date(team.registeredAt).toLocaleDateString() : 'Recently'}
                        </span>
                      </div>
                    </div>

                    {/* Team Status */}
                    <div className="mt-3 pt-3 border-t border-gaming-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-400 flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                          Confirmed
                        </span>
                        {team.userId === user?.id && (
                          <span className="text-xs text-gaming-gold">Your Team</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <FiUsers className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Teams Registered Yet</h3>
                <p className="text-gray-400 mb-6">Be the first to register for this tournament!</p>
                
                {/* Registration CTA */}
                {!isUserRegistered && (
                  <button
                    onClick={handleJoinTournament}
                    className="btn-gaming inline-flex items-center space-x-2"
                  >
                    <FiUsers className="h-4 w-4" />
                    <span>Register Now</span>
                  </button>
                )}
              </div>
            )}

            {/* Tournament Capacity */}
            <div className="bg-gaming-dark rounded-lg p-4 border border-gaming-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Tournament Capacity</span>
                <span className="text-white text-sm font-semibold">
                  {registeredTeams.length} / {tournament?.maxParticipants || 100}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-gaming-neon to-gaming-gold h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min((registeredTeams.length / (tournament?.maxParticipants || 100)) * 100, 100)}%` 
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>{tournament?.maxParticipants || 100} teams</span>
              </div>
            </div>
          </div>
        );

      case 'chat':
        return (
          <div className="relative">
            {/* Background Image */}
            <div className="absolute inset-0 opacity-5">
              <OptimizedImage 
                src="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop&crop=center"
                alt="Chat Background"
                className="w-full h-full"
              />
            </div>
            
            <div className="relative z-10 text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                <FiMessageCircle className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Tournament Chat</h3>
              <p className="text-gray-400">Chat will be available during the tournament</p>
              
              {/* Chat Preview */}
              <div className="mt-8 max-w-md mx-auto">
                <div className="bg-gaming-card border border-gaming-border rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-gaming-gold rounded-full flex items-center justify-center">
                        <span className="text-xs">🎮</span>
                      </div>
                      <span className="text-gray-400 text-sm">Tournament updates will appear here</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-xs">💬</span>
                      </div>
                      <span className="text-gray-400 text-sm">Player discussions and strategies</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-xs">🏆</span>
                      </div>
                      <span className="text-gray-400 text-sm">Live match results and scores</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Header */}
      <div className="bg-gaming-card border-b border-gaming-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/games"
                className="p-2 hover:bg-gaming-slate rounded-lg transition-colors duration-200"
              >
                <FiArrowLeft className="h-5 w-5 text-white" />
              </Link>
              <span className="text-gray-400 text-sm">Banner image</span>
            </div>

            <div className="flex items-center space-x-3">
              <button 
                onClick={handleShareTournament}
                className="flex items-center space-x-2 px-4 py-2 bg-gaming-slate hover:bg-gaming-gold hover:text-black rounded-lg transition-all duration-200"
              >
                <FiShare2 className="h-4 w-4" />
                <span className="text-sm font-semibold">SHARE</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tournament Hero */}
      <div className="relative h-80 overflow-hidden">
        {/* Background Image */}
        <OptimizedImage 
          src={getRandomBanner(tournament?.gameType)} 
          alt={tournament?.name || 'Tournament'}
          className="w-full h-full"
          fallbackSrc={getGameImage(tournament?.gameType, 'banner')}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
        
        {/* Content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-4xl mx-auto px-4">
            <div className="text-6xl mb-4 drop-shadow-lg">
              {tournament?.gameIcon || (tournament?.gameType === 'bgmi' ? '🎮' : tournament?.gameType === 'cs2' ? '⚡' : '🎯')}
            </div>
            <h1 className="text-4xl md:text-6xl font-gaming font-bold text-white mb-4 drop-shadow-lg">
              {tournament?.name || 'Tournament'}
            </h1>
            <p className="text-xl text-gray-200 drop-shadow-lg">
              {tournament?.description || 'Join the ultimate gaming competition'}
            </p>
          </div>
        </div>

        {/* Game Type Badge */}
        <div className="absolute top-6 left-6">
          <span className="px-4 py-2 bg-gaming-gold/90 text-black font-bold rounded-lg backdrop-blur-sm">
            {tournament?.gameType?.toUpperCase() || 'BGMI'}
          </span>
        </div>

        {/* Prize Pool Badge */}
        <div className="absolute top-6 right-6">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2">
            <div className="text-gaming-gold text-sm font-medium">PRIZE POOL</div>
            <div className="text-white text-xl font-bold">
              ₹{tournament?.prizePool?.toLocaleString() || '25,000'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Top Info Bar - Horizontal Layout */}
        <div className="bg-gradient-to-r from-gaming-card via-gaming-slate to-gaming-card border border-gaming-border rounded-xl p-6 mb-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Prize Pool */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gaming-gold to-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <FiAward className="h-6 w-6 text-black" />
              </div>
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wide">Prize Pool</div>
                <div className="text-white font-bold text-xl">₹{tournament?.prizePool?.toLocaleString() || '0'}</div>
              </div>
            </div>

            {/* Participants */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <FiUsers className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wide">Participants</div>
                <div className="text-white font-bold text-xl">
                  {tournament?.currentParticipants || 0} / {tournament?.maxParticipants || 100}
                </div>
              </div>
            </div>

            {/* Timeline - Registration & Tournament Start */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gaming-neon to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <FiCalendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wide">Timeline</div>
                <div className="space-y-0.5">
                  <div className="text-gaming-neon font-bold text-sm">
                    Reg: {tournament?.registration?.closesIn || tournament?.closesIn || '2 hours'}
                  </div>
                  {tournament?.startDate && (
                    <div className="text-white font-semibold text-xs">
                      Start: {new Date(tournament.startDate) > new Date() 
                        ? new Date(tournament.startDate).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })
                        : 'Live Now!'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Join Button */}
            <div className="flex items-center justify-end">
              {isUserRegistered ? (
                <div className="bg-green-500/10 border-2 border-green-500/50 rounded-lg px-6 py-3 text-center">
                  <div className="text-green-400 font-bold text-lg flex items-center space-x-2">
                    <span>✅</span>
                    <span>Registered</span>
                  </div>
                  <div className="text-gray-300 text-xs mt-1">
                    {tournament?.gameType === 'bgmi' ? 'Room details below' : 'Server details below'}
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleJoinTournament}
                  className="btn-gaming px-8 py-4 text-lg font-bold shadow-lg hover:shadow-gaming-gold/50 transition-all duration-300"
                >
                  {isAuthenticated ? 'JOIN NOW' : 'LOGIN TO JOIN'}
                </button>
              )}
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center space-x-3 mt-6 pt-6 border-t border-gaming-border/50">
            <span className="px-4 py-1.5 bg-gaming-gold text-black text-xs font-bold rounded-full uppercase">
              {tournament?.status?.replace('_', ' ') || 'Upcoming'}
            </span>
            <span className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold rounded-full uppercase">
              {tournament?.gameType || 'BGMI'}
            </span>
            <span className="px-4 py-1.5 bg-gray-700 text-white text-xs font-bold rounded-full uppercase">
              {tournament?.mode || 'Squad'}
            </span>
            <div className="flex-1"></div>
            <div className="flex items-center space-x-2 text-gray-400 text-sm">
              <div className="w-6 h-6 bg-gaming-gold rounded-full flex items-center justify-center">
                <span className="text-black text-xs font-bold">C</span>
              </div>
              <span className="text-white font-semibold">Colab Esports</span>
            </div>
          </div>
        </div>

        {/* Modern Tab Pills */}
        <div className="flex items-center justify-center space-x-3 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full font-semibold text-sm uppercase tracking-wide transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-gaming-gold to-yellow-500 text-black shadow-lg shadow-gaming-gold/50'
                  : 'bg-gaming-card border border-gaming-border text-gray-400 hover:text-white hover:border-gaming-gold'
              }`}
            >
              <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-black' : ''}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Full Width Content */}
        <div className="w-full">
          {renderTabContent()}
        </div>
      </div>

      {/* Steam Linking Modal */}
      <SteamLinkingModal
        isOpen={showSteamModal}
        onClose={() => setShowSteamModal(false)}
        onConfirm={handleSteamLink}
        tournamentName={tournament?.name || 'this tournament'}
      />

      {/* Registration Modal */}
      {showRegistration && tournament && (
        <TournamentRegistration
          tournament={tournament}
          onClose={() => setShowRegistration(false)}
          onSuccess={handleRegistrationSuccess}
        />
      )}
    </div>
  );
};

export default SingleTournamentPage;