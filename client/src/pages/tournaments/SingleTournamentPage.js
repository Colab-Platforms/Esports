import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  FiArrowLeft,
  FiShare2,
  FiCopy,
  FiUsers,
  FiCalendar,
  FiDollarSign,
  FiMapPin,
  FiClock,
  FiAward,
  FiInfo,
  FiMessageCircle,
  FiServer,
  FiKey
} from 'react-icons/fi';
import { fetchTournamentById } from '../../store/slices/tournamentSlice';
import { selectAuth } from '../../store/slices/authSlice';
import TournamentRegistration from '../../components/tournaments/TournamentRegistration';
import { gameImages, getGameImage, getRandomTournamentImage } from '../../assets/images';
import { getRandomBanner } from '../../assets/tournamentBanners';
import { getGameAsset } from '../../assets/gameAssets';
import OptimizedImage from '../../components/common/OptimizedImage';

const SingleTournamentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(selectAuth);
  const [activeTab, setActiveTab] = useState('general');
  const [showRegistration, setShowRegistration] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [isUserRegistered, setIsUserRegistered] = useState(false);

  useEffect(() => {
    // Fetch real tournament data
    const fetchTournamentData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch(`/api/tournaments/${id}`, { headers });
        const data = await response.json();

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

          setTournament(enhancedTournament);
          setIsUserRegistered(data.data.isUserRegistered || false);

          // Set room details if user is registered
          if (data.data.roomDetails) {
            setTournament(prev => ({
              ...prev,
              roomDetails: data.data.roomDetails
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch tournament:', error);
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
      }
    };

    fetchTournamentData();
  }, [id, isAuthenticated, user]);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading tournament...</p>
        </div>
      </div>
    );
  }

  const handleJoinTournament = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Check Steam requirement for CS2
    if (tournament?.gameType === 'cs2' && !user?.gameIds?.steam) {
      alert('Steam ID is required for CS2 tournaments. Please connect your Steam account first.');
      return;
    }

    setShowRegistration(true);
  };

  const handleRegistrationSuccess = () => {
    setShowRegistration(false);
    setIsUserRegistered(true);
    // Refresh tournament data to show room details
  };

  const tabs = [
    { id: 'general', label: 'GENERAL', icon: FiInfo },
    { id: 'teams', label: 'TEAMS', icon: FiUsers },
    { id: 'chat', label: 'CHAT', icon: FiMessageCircle }
  ];

  const TabContent = () => {
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
                      <div className="text-gray-400 text-sm">₹{tournament?.entryFee || 0}</div>
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

                  {tournament.gameType === 'bgmi' && tournament.roomDetails.bgmi && (
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

                  {tournament.gameType === 'cs2' && tournament.roomDetails.cs2 && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-gray-400 text-sm">Server IP</div>
                          <div className="text-white font-mono text-lg bg-gaming-dark p-2 rounded">
                            {tournament.roomDetails.cs2.serverIp}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm">Port</div>
                          <div className="text-white font-mono text-lg bg-gaming-dark p-2 rounded">
                            {tournament.roomDetails.cs2.serverPort}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-400 text-sm mb-2">Connect Command</div>
                        <div className="bg-gaming-dark p-3 rounded font-mono text-sm text-gaming-neon border border-gaming-neon/30">
                          {tournament.roomDetails.cs2.connectCommand}
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(tournament.roomDetails.cs2.connectCommand)}
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                        >
                          <FiCopy className="h-3 w-3" />
                          <span>Copy Command</span>
                        </button>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 mt-4">
                        <div className="text-blue-400 text-sm font-medium mb-1">Instructions:</div>
                        <div className="text-gray-300 text-xs space-y-1">
                          <div>1. Copy the connect command above</div>
                          <div>2. Open Steam console (~ key in-game)</div>
                          <div>3. Paste and execute the command</div>
                          <div>4. Server will automatically track results</div>
                        </div>
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
          <div className="relative">
            {/* Background Image */}
            <div className="absolute inset-0 opacity-5">
              <OptimizedImage 
                src="https://images.unsplash.com/photo-1556438064-2d7646166914?w=800&h=600&fit=crop&crop=center"
                alt="Teams Background"
                className="w-full h-full"
              />
            </div>
            
            <div className="relative z-10 text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <FiUsers className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Teams Registered</h3>
              <p className="text-gray-400">Teams will appear here once registration opens</p>
              
              {/* Team Slots Preview */}
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="bg-gaming-card border border-gaming-border rounded-lg p-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center">
                      <span className="text-gray-500 text-lg">👥</span>
                    </div>
                    <div className="text-gray-500 text-sm">Team Slot {index + 1}</div>
                  </div>
                ))}
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
              <button className="flex items-center space-x-2 px-4 py-2 bg-gaming-slate hover:bg-gaming-border rounded-lg transition-colors duration-200">
                <FiShare2 className="h-4 w-4 text-white" />
                <span className="text-white text-sm">SHARE</span>
              </button>

              <button className="flex items-center space-x-2 px-4 py-2 bg-gaming-slate hover:bg-gaming-border rounded-lg transition-colors duration-200">
                <FiCopy className="h-4 w-4 text-white" />
                <span className="text-white text-sm">COPY TOURNAMENT</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Left Sidebar - Tournament Info */}
          <div className="lg:col-span-1">
            <div className="bg-gaming-card rounded-lg border border-gaming-border p-6 sticky top-8">

              {/* Tournament Status */}
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="px-3 py-1 bg-gaming-gold text-black text-xs font-bold rounded-full">
                    {tournament?.status?.toUpperCase() || 'UPCOMING'}
                  </span>
                  <span className="px-3 py-1 bg-gray-600 text-white text-xs font-bold rounded-full">
                    COLAB TOURNAMENT
                  </span>
                </div>
              </div>

              {/* Registration Info */}
              <div className="mb-6">
                <div className="text-gray-400 text-sm mb-1">REGISTRATION CLOSES IN</div>
                <div className="text-white font-bold">{tournament?.registration?.closesIn || tournament?.closesIn || '2 hours'}</div>
              </div>

              {/* Prize Pool */}
              <div className="mb-6">
                <div className="text-gray-400 text-sm mb-1">PRIZE POOL</div>
                <div className="flex items-center space-x-2">
                  <FiAward className="h-4 w-4 text-gaming-gold" />
                  <span className="text-white font-bold">₹{tournament?.prizePool?.toLocaleString() || tournament?.registration?.prizePool || '0'}</span>
                </div>
              </div>

              {/* Participants */}
              <div className="mb-6">
                <div className="text-gray-400 text-sm mb-1">PARTICIPANTS</div>
                <div className="flex items-center space-x-2">
                  <FiUsers className="h-4 w-4 text-white" />
                  <span className="text-white">
                    {tournament?.currentParticipants || tournament?.registration?.participants?.current || 0} / {tournament?.maxParticipants || tournament?.registration?.participants?.max || 100}
                  </span>
                </div>
              </div>

              {/* Join Button */}
              {isUserRegistered ? (
                <div className="w-full bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 text-center">
                  <div className="text-green-400 font-bold">✅ Registered</div>
                  <div className="text-gray-300 text-sm">
                    {tournament?.gameType === 'bgmi' ? 'Room details available above' : 'Server details available above'}
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleJoinTournament}
                  className="w-full btn-gaming py-3 mb-4"
                >
                  {isAuthenticated ? 'JOIN TOURNAMENT' : 'LOGIN TO JOIN'}
                </button>
              )}

              {/* Organizer */}
              <div className="text-center">
                <div className="text-gray-400 text-sm mb-1">ORGANIZER</div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-6 h-6 bg-gaming-gold rounded-full flex items-center justify-center">
                    <span className="text-black text-xs font-bold">C</span>
                  </div>
                  <span className="text-white font-semibold">Colab</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Tabs */}
          <div className="lg:col-span-3">

            {/* Tab Navigation */}
            <div className="flex space-x-8 border-b border-gaming-border mb-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 pb-4 px-2 font-semibold transition-colors duration-200 ${activeTab === tab.id
                    ? 'text-gaming-gold border-b-2 border-gaming-gold'
                    : 'text-gray-400 hover:text-white'
                    }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TabContent />
            </motion.div>
          </div>
        </div>
      </div>

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