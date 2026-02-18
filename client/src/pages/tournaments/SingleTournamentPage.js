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
  FiKey,
  FiCopy
} from 'react-icons/fi';
import { selectAuth } from '../../store/slices/authSlice';
import SteamLinkingModal from '../../components/tournaments/SteamLinkingModal';
import TeamSelectionModal from '../../components/tournaments/TeamSelectionModal';
import api from '../../services/api';
import GameIcon from '../../components/common/GameIcon';
import { getRandomBanner } from '../../assets/tournamentBanners';
import { getGameAsset } from '../../assets/gameAssets';
import OptimizedImage from '../../components/common/OptimizedImage';
import CountdownTimer from '../../components/common/CountdownTimer';
import { getSteamAuthUrl } from '../../utils/apiConfig';
import { getServerStats, getServerPlayers, getPlayerStats } from '../../utils/cs2ServerStatus';
import notificationService from '../../services/notificationService';
import secureRequest from '../../utils/secureRequest';

const SingleTournamentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(selectAuth);
  const [activeTab, setActiveTab] = useState('general');
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showSteamModal, setShowSteamModal] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [isUserRegistered, setIsUserRegistered] = useState(false);
  const [registeredTeams, setRegisteredTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [serverStats, setServerStats] = useState([]);
  const [serverPlayers, setServerPlayers] = useState([]);
  const [scoreboards, setScoreboards] = useState([]);

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
        notificationService.showCustomNotification(
          'success',
          'Link Copied!',
          'Tournament link copied to clipboard'
        );
      }).catch((error) => {
        console.error('Failed to copy:', error);
        notificationService.showCustomNotification(
          'info',
          'Share Tournament',
          `Copy this link: ${tournamentUrl}`
        );
      });
    }
  }, [tournament]);

  const fetchRegisteredTeams = React.useCallback(async () => {
    try {
      setLoadingTeams(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL || '';

      // For BGMI tournaments, use the BGMI-specific endpoint
      let endpoint = `/api/tournaments/${id}/participants`;

      if (tournament?.gameType === 'bgmi') {
        endpoint = `/api/bgmi-registration/tournament/${id}/teams`;
      }

      const data = await secureRequest.get(endpoint);

      if (data.success) {
        // Handle both response formats
        const teams = data.data?.teams || data.data?.participants || [];
        setRegisteredTeams(teams);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  }, [id, tournament?.gameType]);

  // Check for Steam connection success and refresh user data
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('steam_connected') === 'true') {
      // Refresh user data from server
      const refreshUserData = async () => {
        try {
          const token = localStorage.getItem('token');
          if (token) {
            const API_BASE_URL = process.env.REACT_APP_API_URL || '';
            const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
              const data = await response.json();
              // Update Redux store with fresh user data
              if (data.success && data.data.user) {
                dispatch({ type: 'auth/loginSuccess', payload: { user: data.data.user, token } });
                console.log('✅ User data refreshed with Steam ID:', data.data.user.gameIds?.steam);
                console.log('🎮 Steam profile:', data.data.user.steamProfile);
              }
            } else {
              console.error('Failed to fetch user profile:', response.status);
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

        const data = await secureRequest.get(`/api/tournaments/${id}`);
        console.log('✅ Tournament data received:', data);

        if (data.success) {
          const tournamentData = data.data.tournament;

          // Add missing properties for compatibility
          const enhancedTournament = {
            ...tournamentData,
            closesIn: '2 hours 30 minutes', // Default value
            gameType: tournamentData.gameType, // Keep gameType for GameIcon component
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

          // Fetch server stats and players for CS2 tournaments (non-blocking)
          if (enhancedTournament.gameType === 'cs2' && enhancedTournament.roomDetails?.cs2) {
            // Don't await these - let them load in background
            Promise.all([
              getServerStats(enhancedTournament),
              getServerPlayers(enhancedTournament),
              getPlayerStats(enhancedTournament)
            ]).then(([stats, players, playerStats]) => {
              setServerStats(stats);
              setServerPlayers(players);
              console.log('📊 Server stats loaded:', stats);
              console.log('👥 Server players loaded:', players);
              console.log('📈 Player stats loaded:', playerStats);
            }).catch(error => {
              console.error('Failed to fetch server data:', error);
            });
          }
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

        // ❌ MOCK DATA DISABLED - Use real API only
        // Uncomment below for development fallback
        /*
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

        // setTournament(mockTournament);
        // setIsUserRegistered(mockTournament.userRegistered);
        setLoadingTournament(false);
        */
      }
    };

    fetchTournamentData();
  }, [id]);

  // Fetch registered teams when tournament data is loaded
  useEffect(() => {
    if (tournament && tournament._id) {
      // Fetch immediately without artificial delay
      fetchRegisteredTeams();
    }
  }, [tournament?._id, tournament?.gameType, fetchRegisteredTeams]);

  // Fetch scoreboards for completed tournaments
  const fetchScoreboards = React.useCallback(async () => {
    if (!tournament?._id || tournament.status !== 'completed') return;

    try {
      const data = await secureRequest.get(`/api/tournaments/${tournament._id}/scoreboards`);

      if (data.success) {
        const scoreboardsData = data.data.scoreboards || [];
        setScoreboards(scoreboardsData);
        // Update tournament with scoreboards for UI checks
        setTournament(prev => ({
          ...prev,
          scoreboards: scoreboardsData
        }));
      }
    } catch (error) {
      console.error('Error fetching scoreboards:', error);
    }
  }, [tournament?._id, tournament?.status]);

  // Fetch scoreboards when tournament is loaded and completed
  useEffect(() => {
    if (tournament && tournament.status === 'completed') {
      fetchScoreboards();
    }
  }, [tournament, fetchScoreboards]);

  // Smart refresh for CS2 tournaments - uses background caching
  useEffect(() => {
    if (!tournament || tournament.gameType !== 'cs2' || !tournament.roomDetails?.cs2) {
      return;
    }

    const refreshServerData = async () => {
      try {
        // These calls will use smart cache with background refresh
        const [stats, players] = await Promise.all([
          getServerStats(tournament),
          getServerPlayers(tournament),
          getPlayerStats(tournament)
        ]);
        setServerStats(stats);
        setServerPlayers(players);
        console.log('⚡ Server data loaded from smart cache');
      } catch (error) {
        console.error('Failed to refresh server data:', error);
      }
    };

    // Initial load - subsequent updates happen via background refresh
    refreshServerData();

    // Optional: Refresh UI every 2 minutes to show updated cached data
    const interval = setInterval(refreshServerData, 120000);

    return () => clearInterval(interval);
  }, [tournament]);

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

  const handleJoinTournament = React.useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // CS2 Tournament - Direct join with Steam check
    if (tournament?.gameType === 'cs2') {
      try {
        // Check if Steam is connected
        const steamId = user?.gameIds?.steam || user?.steamProfile?.steamId;
        const isSteamConnected = user?.steamProfile?.isConnected;

        console.log('🎮 CS2 Direct Join - Steam Check:', {
          steamId,
          isSteamConnected,
          user
        });

        // If Steam not connected, show Steam linking modal
        if (!steamId || !isSteamConnected) {
          console.log('⚠️ Steam not connected - showing Steam modal');
          setShowSteamModal(true);
          return;
        }

        // Steam connected - directly join tournament
        console.log('✅ Steam connected - joining tournament directly');

        const token = localStorage.getItem('token');
        const API_BASE_URL = process.env.REACT_APP_API_URL || '';

        const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournament._id}/join`, {
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

        console.log('✅ Successfully joined CS2 tournament:', data);

        // Trigger cache invalidation for homepage
        window.dispatchEvent(new CustomEvent('tournamentJoined', {
          detail: { tournamentId: tournament._id, tournamentName: tournament.name }
        }));

        // Update localStorage timestamp for cache invalidation
        localStorage.setItem('last_tournament_update', Date.now().toString());

        // Show success notification
        notificationService.showCustomNotification(
          'success',
          'Tournament Joined!',
          `Successfully joined ${tournament.name}. Launching CS2...`
        );

        // Launch CS2 directly - Steam will handle installation if needed
        if (tournament.roomDetails?.cs2?.connectCommand) {
          window.location.href = tournament.roomDetails.cs2.connectCommand;
        }

      } catch (error) {
        console.error('❌ Failed to join CS2 tournament:', error);
        notificationService.showCustomNotification(
          'error',
          'Join Failed',
          `Failed to join tournament: ${error.message}`
        );
      }
      return;
    }

    setShowTeamSelection(true);
  }, [isAuthenticated, tournament, user, navigate]);

  const handleRegistrationSuccess = React.useCallback(() => {
    setShowTeamSelection(false);
    setIsUserRegistered(true);
    fetchRegisteredTeams();
    notificationService.showCustomNotification(
      'success',
      'Registration Successful!',
      'You have been successfully registered for the tournament.',
      `/tournaments/${id}`
    );
  }, [fetchRegisteredTeams, id]);

  const handleDirectRegistration = React.useCallback(async (team, phoneNumber, memberEdits = {}) => {
    if (!tournament || !team) return;
    setRegistering(true);

    try {
      const currentUserId = user?._id || user?.id || localStorage.getItem('userId');
      const gameType = tournament.gameType;

      const getInfo = (member) => {
        const memberId = member.userId?._id || member.userId;
        const edited = memberEdits[memberId];
        if (edited) return edited;

        const u = member.userId;
        if (gameType === 'bgmi') {
          return { name: u?.gameIds?.bgmi?.ign || u?.bgmiIgnName || '', gameId: u?.gameIds?.bgmi?.uid || u?.bgmiUid || '' };
        } else if (gameType === 'freefire' || gameType === 'ff') {
          return { name: u?.gameIds?.freefire?.ign || u?.freeFireIgnName || '', gameId: u?.gameIds?.freefire?.uid || u?.freeFireUid || '' };
        } else if (gameType === 'cs2') {
          return { name: '', gameId: u?.gameIds?.steam || u?.steamProfile?.steamId || '' };
        } else if (gameType === 'valorant') {
          return { name: '', gameId: u?.gameIds?.valorant || '' };
        }
        return { name: '', gameId: '' };
      };

      const captainMember = team.members.find(m => {
        if (!m.userId) return false;
        return (m.userId._id || m.userId).toString() === currentUserId?.toString();
      });
      const otherMembers = team.members.filter(m => {
        if (!m.userId) return false;
        return (m.userId._id || m.userId).toString() !== currentUserId?.toString();
      });

      const leaderInfo = captainMember ? getInfo(captainMember) : { name: '', gameId: '' };

      if (gameType === 'bgmi') {
        const registrationData = {
          teamName: team.name,
          teamLeader: {
            name: leaderInfo.name,
            bgmiId: leaderInfo.gameId,
            phone: phoneNumber || user?.phone || '',
            isSubstitute: false
          },
          teamMembers: otherMembers.map(m => {
            const info = getInfo(m);
            return { name: info.name, bgmiId: info.gameId, isSubstitute: false };
          }),
          whatsappNumber: phoneNumber || user?.phone || ''
        };
        await api.post(`/api/bgmi-registration/${tournament._id}/register`, registrationData);
      } else if (gameType === 'freefire' || gameType === 'ff') {
        const registrationData = {
          teamName: team.name,
          teamLeader: {
            name: leaderInfo.name,
            freeFireId: leaderInfo.gameId,
            phone: phoneNumber || user?.phone || ''
          },
          teamMembers: otherMembers.map(m => {
            const info = getInfo(m);
            return { name: info.name, freeFireId: info.gameId };
          }),
          whatsappNumber: phoneNumber || user?.phone || ''
        };
        await api.post(`/api/freefire-registration/${tournament._id}/register`, registrationData);
      } else if (gameType === 'cs2') {
        const steamId = leaderInfo.gameId || user?.gameIds?.steam || user?.steamProfile?.steamId;
        if (!steamId) {
          notificationService.showCustomNotification('error', 'Steam Not Linked', 'Please connect your Steam account first.');
          setRegistering(false);
          return;
        }
        const tkn = localStorage.getItem('token');
        const API_BASE_URL = process.env.REACT_APP_API_URL || '';
        await fetch(`${API_BASE_URL}/api/tournaments/${tournament._id}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
          body: JSON.stringify({ gameId: steamId, teamName: team.name })
        });
      } else {
        const tkn = localStorage.getItem('token');
        const API_BASE_URL = process.env.REACT_APP_API_URL || '';
        await fetch(`${API_BASE_URL}/api/tournaments/${tournament._id}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
          body: JSON.stringify({ teamName: team.name, gameId: leaderInfo.gameId || '' })
        });
      }

      handleRegistrationSuccess();
    } catch (error) {
      let errorMessage = 'Registration failed. Please try again.';
      const details = error.response?.data?.error?.details;
      if (details && Array.isArray(details)) {
        errorMessage = details.map(d => {
          const path = d.path || d.param || '';
          if (path.includes('teamLeader.bgmiId')) return `Team Leader is missing BGMI UID`;
          if (path.includes('teamLeader.name')) return `Team Leader is missing BGMI IGN`;
          if (path.includes('teamLeader.phone')) return `Team Leader phone number is invalid`;
          if (path.includes('teamLeader.freeFireId')) return `Team Leader is missing Free Fire UID`;
          if (path.includes('teamMembers')) {
            const match = path.match(/teamMembers\[?(\d+)\]?/);
            const idx = match ? parseInt(match[1]) + 1 : '';
            if (path.includes('bgmiId')) return `Member ${idx} is missing BGMI UID`;
            if (path.includes('freeFireId')) return `Member ${idx} is missing Free Fire UID`;
            if (path.includes('name')) return `Member ${idx} is missing IGN`;
            return d.msg;
          }
          if (path.includes('whatsappNumber')) return 'Invalid WhatsApp number';
          return d.msg || `${path}: validation failed`;
        }).join('\n');
      } else {
        errorMessage = error.response?.data?.error?.message || error.response?.data?.message || error.message || errorMessage;
      }
      notificationService.showCustomNotification('error', 'Registration Failed', errorMessage);
    } finally {
      setRegistering(false);
    }
  }, [tournament, user, handleRegistrationSuccess]);

  // Early return AFTER all hooks
  if (loadingTournament) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center items-center space-x-1 mb-4">
            <div className="w-2 h-2 bg-gaming-neon rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-gaming-neon rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-gaming-neon rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-gaming-neon rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
            <div className="w-2 h-2 bg-gaming-neon rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
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

  // Keep the original page, just change the registration modal for BGMI

  const tabs = [
    { id: 'general', label: 'GENERAL', icon: FiInfo },
    { id: 'teams', label: 'TEAMS', icon: FiUsers }
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

                  {/* CS2: Show real server info */}
                  {tournament?.gameType === 'cs2' && serverStats.length > 0 && (
                    <>
                      {serverStats.slice(0, 4).map((stat, index) => (
                        <div key={index} className="flex items-center space-x-3 mb-3">
                          <div className="text-2xl">{stat.icon}</div>
                          <div>
                            <div className="text-white font-semibold">{stat.label.toUpperCase()}</div>
                            <div className={`text-sm font-bold ${stat.color}`}>{stat.value}</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

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

                  {/* Registration Countdown - Hidden for CS2 */}
                  {tournament?.gameType !== 'cs2' && tournament?.registrationDeadline && new Date(tournament.registrationDeadline) > new Date() && (
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

                  {/* Tournament Start Countdown - Hidden for CS2 */}
                  {tournament?.gameType !== 'cs2' && tournament?.startDate && new Date(tournament.startDate) > new Date() && (
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

            {/* Removed: REWARDS section */}
            {/* Removed: ROOM DETAILS section */}

          </div>
        );

      case 'teams':
        return (
          <div className="space-y-6">
            {/* Teams Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {tournament?.gameType === 'cs2' ? 'JOINED PLAYERS' : 'REGISTERED TEAMS'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {registeredTeams.length} / {tournament?.maxParticipants || 100} {tournament?.gameType === 'cs2' ? 'players joined' : 'teams registered'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gaming-gold">
                  {registeredTeams.length}
                </div>
                <div className="text-xs text-gray-400">{tournament?.gameType === 'cs2' ? 'Players' : 'Teams'}</div>
              </div>
            </div>

            {loadingTeams ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gaming-gold rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-gaming-gold rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gaming-gold rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gaming-gold rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-2 h-2 bg-gaming-gold rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <span className="ml-3 text-gray-300">Loading teams...</span>
              </div>
            ) : (tournament?.gameType === 'cs2' && serverPlayers.length > 0) ? (
              /* CS2: Show real players from server */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serverPlayers.map((player, index) => (
                  <div key={index} className="bg-gaming-card border border-gaming-border rounded-lg p-4 hover:border-gaming-gold transition-colors">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold">
                          {player.name}
                        </div>
                        <div className="text-gray-400 text-sm">
                          Playing now
                        </div>
                      </div>
                      <div className="text-xs text-gaming-gold font-semibold">
                        🎮
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Score:</span>
                        <span className="text-gaming-gold font-bold">{player.score}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Time:</span>
                        <span className="text-white font-medium">{player.time} min</span>
                      </div>
                    </div>

                    {/* Player Status */}
                    <div className="mt-3 pt-3 border-t border-gaming-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-400 flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                          Online
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : registeredTeams.length > 0 ? (
              /* BGMI/Other: Show registered teams in table format */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gaming-charcoal/50 border-b border-gaming-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Team Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Leader</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Members</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Group</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gaming-border">
                    {registeredTeams.map((team, index) => (
                      <tr key={team._id || index} className="hover:bg-gaming-slate/20 transition-colors">
                        <td className="px-4 py-3 text-sm text-white font-medium">{team.teamName || `Team ${index + 1}`}</td>
                        <td className="px-4 py-3 text-sm text-white">{team.teamLeader?.name || team.playerName || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          <div className="flex flex-col space-y-1">
                            <span>Leader: {team.teamLeader?.bgmiId || team.gameId || 'N/A'}</span>
                            {team.teamMembers?.map((member, idx) => (
                              <span key={idx}>P{idx + 1}: {member.bgmiId || 'N/A'}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-gaming-neon/20 text-gaming-neon rounded text-xs font-medium">
                            {team.group || 'Not Assigned'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${team.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                            team.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              team.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                'bg-blue-500/20 text-blue-400'
                            }`}>
                            {team.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {team.registeredAt ? new Date(team.registeredAt).toLocaleDateString() : 'Recently'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <FiUsers className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {tournament?.gameType === 'cs2' ? 'No Players Joined Yet' : 'No Teams Registered Yet'}
                </h3>
                <p className="text-gray-400 mb-6">
                  {tournament?.gameType === 'cs2' ? 'Be the first to join this server!' : 'Be the first to register for this tournament!'}
                </p>

                {/* Registration CTA */}
                {!isUserRegistered && tournament?.status === 'registration_open' && (
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

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Header - Glassy Yellow Card Design */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/games"
            className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200 backdrop-blur-sm"
          >
            <FiArrowLeft className="h-5 w-5 text-white" />
          </Link>

          <button
            onClick={handleShareTournament}
            className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 backdrop-blur-sm border border-white/20"
          >
            <FiShare2 className="h-4 w-4" />
            <span className="text-sm font-semibold">SHARE</span>
          </button>
        </div>

        {/* Glassy Yellow Card */}
        <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br from-yellow-400/20 via-yellow-300/10 to-yellow-400/5 border border-yellow-400/30 shadow-2xl p-6 md:p-8">
          {/* Animated Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-yellow-500/5 opacity-50" />

          {/* Content */}
          <div className="relative z-10">
            {/* Main Header with Logo and Text */}
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {/* Left: Large Logo */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center text-5xl md:text-6xl shadow-lg border-2 border-yellow-300/50">
                  <GameIcon gameType={tournament?.gameType} size="xl" />
                </div>
              </div>

              {/* Middle: Tournament Info in Outline Box */}
              <div className="flex-1 border-2 border-yellow-400/40 rounded-xl p-4 md:p-6 bg-white/5 backdrop-blur-sm">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">
                  {tournament?.name || 'Tournament'}
                </h1>
                <p className="text-yellow-100/80 text-sm md:text-base font-body mb-3 leading-relaxed">
                  {tournament?.description || 'Join the ultimate gaming competition'}
                </p>

                {/* Quick Info Tags */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-yellow-400/20 border border-yellow-400/40 rounded-lg text-yellow-200 text-xs font-semibold font-body">
                    {tournament?.gameType?.toUpperCase() || 'BGMI'}
                  </span>
                  <span className="px-3 py-1 bg-yellow-400/20 border border-yellow-400/40 rounded-lg text-yellow-200 text-xs font-semibold font-body">
                    {tournament?.mode?.toUpperCase() || 'SQUAD'}
                  </span>
                  {/* <span className="px-3 py-1 bg-yellow-400/20 border border-yellow-400/40 rounded-lg text-yellow-200 text-xs font-semibold font-body">
                    👥 {tournament?.currentParticipants || 0}/{tournament?.maxParticipants || 100}
                  </span> */}
                  {/* <span className="px-3 py-1 bg-yellow-400/20 border border-yellow-400/40 rounded-lg text-yellow-200 text-xs font-semibold font-body">
                    🌍 {tournament?.region || 'India'}
                  </span> */}
                </div>
              </div>

              {/* Right: Prize Pool & Status */}
              <div className="flex-shrink-0 flex flex-col gap-3">
                <div className="bg-gradient-to-br from-yellow-400/30 to-yellow-500/20 backdrop-blur-sm rounded-xl p-4 border border-yellow-400/40 text-center md:text-right">
                  <div className="text-yellow-200 text-xs font-bold uppercase tracking-wider font-display">Prize Pool</div>
                  <div className="text-white text-3xl md:text-4xl font-display font-bold mt-2">
                    ₹{tournament?.prizePool?.toLocaleString() || '0'}
                  </div>
                  <div className="text-yellow-100/60 text-xs mt-1 font-body">Total Rewards</div>
                </div>

                {/* Status Badge with Countdown */}
                <div className={`px-4 py-2 rounded-lg font-semibold text-sm text-center backdrop-blur-sm border font-display ${tournament?.status === 'active'
                  ? 'bg-green-500/20 text-green-300 border-green-400/40'
                  : tournament?.status === 'registration_open'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                    : 'bg-gray-500/20 text-gray-300 border-gray-400/40'
                  }`}>
                  {tournament?.status === 'active' ? (
                    <div className="flex flex-col gap-2 items-center">
                      <span>ACTIVE</span>
                      {tournament?.registrationDeadline && new Date(tournament.registrationDeadline) > new Date() && (
                        <div className="text-xs font-body whitespace-nowrap">
                          <CountdownTimer
                            targetDate={tournament.registrationDeadline}
                            format="compact"
                            size="sm"
                            showLabels={false}
                          />
                        </div>
                      )}
                    </div>
                  ) : tournament?.status === 'registration_open' && tournament?.registrationDeadline && new Date(tournament.registrationDeadline) > new Date() ? (
                    <div className="flex flex-col gap-2 items-center">
                      <span>🔵 REGISTRATION OPEN</span>
                      <div className="text-xs font-body whitespace-nowrap">
                        <CountdownTimer
                          targetDate={tournament.registrationDeadline}
                          format="compact"
                          size="sm"
                          showLabels={false}
                        />
                      </div>
                    </div>
                  ) : (
                    <span>🟢 {tournament?.status?.toUpperCase().replace('_', ' ') || 'ACTIVE'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Tournament Info Grid - Prize Pool, Participants, Timeline, Status & Join */}
            <div className="mt-6 pt-6 border-t border-yellow-400/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Prize Pool */}
                {/* <div className="flex items-center space-x-3 md:space-x-4">
                  <div className="w-10 md:w-12 h-10 md:h-12 bg-gradient-to-br from-gaming-gold to-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiAward className="h-5 md:h-6 w-5 md:w-6 text-black" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-gray-400 text-xs uppercase tracking-wide font-body">Prize Pool</div>
                    <div className="text-white font-bold text-lg md:text-xl truncate font-display">₹{tournament?.prizePool?.toLocaleString() || '0'}</div>
                  </div>
                </div> */}

                {/* Participants */}
                <div className="flex items-center space-x-3 md:space-x-4">
                  <div className="w-10 md:w-12 h-10 md:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiUsers className="h-5 md:h-6 w-5 md:w-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-gray-400 text-xs uppercase tracking-wide font-body">Participants</div>
                    <div className="text-white font-bold text-lg md:text-xl font-display">{tournament?.currentParticipants || 0} / {tournament?.maxParticipants || 100}</div>
                  </div>
                </div>

                {/* Timeline - Registration & Tournament Start */}
                <div className="flex items-center space-x-3 md:space-x-4">
                  {/* <div className="w-10 md:w-12 h-10 md:h-12 bg-gradient-to-br from-gaming-neon to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiCalendar className="h-5 md:h-6 w-5 md:w-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-gray-400 text-xs uppercase tracking-wide font-body">Timeline</div>
                    <div className="space-y-0.5">
                      <div className="text-gaming-neon font-bold text-xs md:text-sm truncate font-display">Reg: {tournament?.registration?.closesIn || tournament?.closesIn || '2 hours'}</div>
                      {tournament?.startDate && (
                        <div className="text-white font-semibold text-xs truncate font-body">Start: {new Date(tournament.startDate) > new Date() ? new Date(tournament.startDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Live Now!'}</div>
                      )}
                    </div>
                  </div> */}
                </div>

                {/* Timeline - Registration & Tournament Start */}
                <div className="flex items-center space-x-3 md:space-x-4">
                  {/* <div className="w-10 md:w-12 h-10 md:h-12 bg-gradient-to-br from-gaming-neon to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiCalendar className="h-5 md:h-6 w-5 md:w-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-gray-400 text-xs uppercase tracking-wide font-body">Timeline</div>
                    <div className="space-y-0.5">
                      <div className="text-gaming-neon font-bold text-xs md:text-sm truncate font-display">Reg: {tournament?.registration?.closesIn || tournament?.closesIn || '2 hours'}</div>
                      {tournament?.startDate && (
                        <div className="text-white font-semibold text-xs truncate font-body">Start: {new Date(tournament.startDate) > new Date() ? new Date(tournament.startDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Live Now!'}</div>
                      )}
                    </div>
                  </div> */}
                </div>

                {/* Status & Join Button */}
                <div className="flex items-center justify-center sm:justify-end">
                  {isUserRegistered ? (
                    <div className="bg-green-500/10 border-2 border-green-500/50 rounded-lg px-4 md:px-6 py-2 md:py-3 text-center w-full sm:w-auto">
                      <div className="text-green-400 font-bold text-sm md:text-lg flex items-center justify-center space-x-2 font-display">
                        <span>✅</span>
                        <span>{tournament?.gameType === 'cs2' ? 'Joined' : 'Registered'}</span>
                      </div>
                      <div className="text-gray-300 text-xs mt-1 font-body">{tournament?.gameType === 'bgmi' ? 'Room details below' : 'Server details below'}</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!isAuthenticated) {
                          navigate('/login');
                        } else {
                          handleJoinTournament();
                        }
                      }}
                      disabled={
                        tournament?.gameType === 'cs2' 
                          ? tournament?.status !== 'active'
                          : tournament?.status !== 'registration_open' || (tournament?.registrationDeadline && new Date(tournament.registrationDeadline) < new Date())
                      }
                      className={`btn-gaming px-8 py-4 text-lg font-bold shadow-lg hover:shadow-gaming-gold/50 transition-all duration-300 font-display ${
                        (tournament?.gameType === 'cs2' 
                          ? tournament?.status !== 'active'
                          : tournament?.status !== 'registration_open' || (tournament?.registrationDeadline && new Date(tournament.registrationDeadline) < new Date())
                        ) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {!isAuthenticated ? ('LOGIN TO JOIN') : 
                       tournament?.gameType === 'cs2' ? (
                         tournament?.status === 'active' ? ('JOIN SERVER') : ('SERVER INACTIVE')
                       ) : (
                         (tournament?.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()) ? ('REGISTRATION CLOSED') : 
                         tournament?.status !== 'registration_open' ? ('REGISTRATION CLOSED') : 
                         ('REGISTER NOW')
                       )
                      }
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Glassy Border Glow Effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400/0 via-yellow-300/5 to-yellow-400/0 pointer-events-none" />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Modern Tab Pills */}
        <div className="flex items-center justify-center space-x-3 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full font-semibold text-sm uppercase tracking-wide transition-all duration-300 ${activeTab === tab.id
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

      {showTeamSelection && tournament && (
        <TeamSelectionModal
          tournament={tournament}
          token={localStorage.getItem('token')}
          registering={registering}
          onClose={() => setShowTeamSelection(false)}
          onRegister={(team, phoneNumber, memberEdits) => handleDirectRegistration(team, phoneNumber, memberEdits)}
        />
      )}
    </div>
  );
};

export default SingleTournamentPage;