import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import BGMIRegistrationForm from '../../components/bgmi/BGMIRegistrationForm';
import TournamentTeamRegistrationForm from '../../components/tournaments/TournamentTeamRegistrationForm';
import {
  fetchTournamentById,
  joinTournament,
  selectCurrentTournament,
  selectTournamentLoading,
  selectTournamentError,
  clearError
} from '../../store/slices/tournamentSlice';
import { selectAuth } from '../../store/slices/authSlice';

const TournamentDetails = ({ 
  tournamentData = null, 
  isUserRegistered: propIsUserRegistered = false,
  registeredTeams: propRegisteredTeams = [],
  loadingTournament: propLoading = false,
  fetchError: propError = null 
}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(selectAuth);
  
  // Always call hooks, then use props if provided
  const reduxTournament = useSelector(selectCurrentTournament);
  const reduxLoading = useSelector(selectTournamentLoading);
  const reduxError = useSelector(selectTournamentError);
  
  // Use props if provided, otherwise fallback to Redux
  const tournament = tournamentData || reduxTournament;
  const loading = propLoading ? { tournamentDetails: propLoading } : reduxLoading;
  const error = propError ? { tournamentDetails: propError } : reduxError;

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [showTeamRegistrationForm, setShowTeamRegistrationForm] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [registeredTeams, setRegisteredTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [isUserRegistered, setIsUserRegistered] = useState(false);
  const [joinForm, setJoinForm] = useState({
    gameId: '',
    teamName: ''
  });

  useEffect(() => {
    // Only fetch tournament data if not provided via props
    if (id && !tournamentData) {
      dispatch(fetchTournamentById(id));
    }
  }, [dispatch, id, tournamentData]);

  // Check if user is registered
  useEffect(() => {
    if (tournament && user) {
      const registered = tournament.participants?.some(p => p.userId === user.id) || propIsUserRegistered;
      setIsUserRegistered(registered);
    }
  }, [tournament, user, propIsUserRegistered]);

  // Fetch registered teams for BGMI/Free Fire tournament
  useEffect(() => {
    if (id && (tournament?.gameType === 'bgmi' || tournament?.gameType === 'freefire')) {
      fetchRegisteredTeams();
    }
  }, [id, tournament?.gameType]);

  const fetchRegisteredTeams = async () => {
    try {
      setLoadingTeams(true);
      const endpoint = tournament?.gameType === 'freefire' 
        ? `/api/freefire-registration/tournament/${id}/teams`
        : `/api/bgmi-registration/tournament/${id}/teams`;
      const response = await fetch(endpoint);
      const data = await response.json();
      if (data.success) {
        setRegisteredTeams(data.data?.teams || []);
      }
    } catch (error) {
      console.error('Error fetching registered teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleJoinTournament = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      await dispatch(joinTournament({
        tournamentId: id,
        gameId: joinForm.gameId,
        teamName: joinForm.teamName
      })).unwrap();
      
      setShowJoinModal(false);
      setJoinForm({ gameId: '', teamName: '' });
      alert('Successfully registered for tournament!');
    } catch (error) {
      alert('Failed to join tournament: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'solo':
        return '👤';
      case 'duo':
        return '👥';
      case 'squad':
        return '👨‍👩‍👧‍👦';
      default:
        return '🎮';
    }
  };

  const canRegister = () => {
    if (!tournament) return false;
    return tournament.status === 'registration_open' && 
           tournament.currentParticipants < tournament.maxParticipants &&
           !isUserRegistered;
  };

  if (loading && loading.tournamentDetails) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (error && error.tournamentDetails) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Tournament</h2>
          <p className="text-gray-300 mb-4">{error.tournamentDetails.message || error.tournamentDetails}</p>
          <div className="space-x-4">
            <button
              onClick={() => {
                dispatch(clearError());
                dispatch(fetchTournamentById(id));
              }}
              className="btn-primary"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/bgmi')}
              className="btn-gaming"
            >
              Back to BGMI
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Tournament Not Found</h2>
          <p className="text-gray-300 mb-4">The requested tournament could not be found.</p>
          <button
            onClick={() => navigate('/bgmi')}
            className="btn-primary"
          >
            Back to BGMI
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop View */}
      <div className="min-h-screen bg-gaming-dark hidden lg:block">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-gaming-dark via-gaming-charcoal to-gaming-dark py-16">
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="flex items-center justify-center space-x-4 mb-4">
              <span className="text-4xl">{getModeIcon(tournament.mode)}</span>
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(tournament.status)}`}>
                {tournament.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-gaming font-bold text-white mb-4">
              {tournament.name}
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              {typeof tournament.description === 'string' ? tournament.description : tournament.description?.description || 'BGMI Tournament'}
            </p>
            
            {/* Quick Stats */}
            <div className="flex flex-wrap justify-center gap-6">
              <div className="bg-gaming-neon/10 border border-gaming-neon/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-gaming-neon">₹{tournament.prizePool.toLocaleString()}</div>
                <div className="text-sm text-gray-300">Prize Pool</div>
              </div>
              <div className="bg-gaming-neon/10 border border-gaming-neon/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-gaming-neon">₹{tournament.entryFee}</div>
                <div className="text-sm text-gray-300">Entry Fee</div>
              </div>
              <div className="bg-gaming-neon/10 border border-gaming-neon/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-gaming-neon">
                  {tournament.currentParticipants}/{tournament.maxParticipants}
                </div>
                <div className="text-sm text-gray-300">Players</div>
              </div>
              <div className="bg-gaming-neon/10 border border-gaming-neon/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-gaming-neon uppercase">{tournament.mode}</div>
                <div className="text-sm text-gray-300">Mode</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gaming-slate">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'general'
                    ? 'text-gaming-neon border-gaming-neon'
                    : 'text-gray-400 border-transparent hover:text-white'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('teams')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'teams'
                    ? 'text-gaming-neon border-gaming-neon'
                    : 'text-gray-400 border-transparent hover:text-white'
                }`}
              >
                Teams
              </button>
              {/* Chat button commented out for future implementation */}
              {/* <button
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'chat'
                    ? 'text-gaming-neon border-gaming-neon'
                    : 'text-gray-400 border-transparent hover:text-white'
                }`}
              >
                Chat
              </button> */}
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Tournament Info */}
                <div className="card-gaming p-6">
                  <h2 className="text-2xl font-bold text-white mb-6">Tournament Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-4">Schedule</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm text-gray-400">Registration Deadline</div>
                          <div className="text-white font-medium">{formatDate(tournament.registrationDeadline)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Tournament Start</div>
                          <div className="text-white font-medium">{formatDate(tournament.startDate)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Tournament End</div>
                          <div className="text-white font-medium">{formatDate(tournament.endDate)}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white mb-4">Game Details</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm text-gray-400">Game</div>
                          <div className="text-white font-medium">
                            {tournament.gameType === 'freefire' 
                              ? 'Free Fire' 
                              : 'BGMI (Battlegrounds Mobile India)'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Mode</div>
                          <div className="text-white font-medium capitalize">{tournament.mode}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Format</div>
                          <div className="text-white font-medium capitalize">
                            {typeof tournament.format === 'string' ? tournament.format.replace('_', ' ') : tournament.format?.format?.replace('_', ' ') || 'Battle Royale'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prize Distribution */}
                <div className="card-gaming p-6">
                  <h2 className="text-2xl font-bold text-white mb-6">Prize Distribution</h2>
                  <div className="space-y-4">
                    {tournament.prizeDistribution?.map((prize, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gaming-charcoal/50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl">
                            {prize.position === 1 ? '🥇' : prize.position === 2 ? '🥈' : prize.position === 3 ? '🥉' : `#${prize.position}`}
                          </div>
                          <div>
                            <div className="text-white font-bold">Position {prize.position}</div>
                            <div className="text-gray-400 text-sm">{prize.percentage}% of prize pool</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gaming-neon">₹{prize.amount.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rules */}
                <div className="card-gaming p-6">
                  <h2 className="text-2xl font-bold text-white mb-6">Tournament Rules</h2>
                  <div className="prose prose-invert max-w-none">
                    <div className="text-gray-300 whitespace-pre-line">
                      {typeof tournament.rules === 'string' ? tournament.rules : tournament.rules?.rules || 'Tournament rules will be updated soon.'}
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <h4 className="text-yellow-400 font-bold mb-2">
                      Important Notes for {tournament.gameType === 'freefire' ? 'Free Fire' : 'BGMI'}:
                    </h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Room ID and password will be shared 30 minutes before match start</li>
                      <li>• Screenshots of final results are mandatory for verification</li>
                      <li>• No third-party applications or modifications allowed</li>
                      <li>• Players must join the custom room on time</li>
                      <li>• Any disputes must be raised within 24 hours of match completion</li>
                    </ul>
                  </div>
                </div>

                {/* Participants */}
                {tournament.participants && tournament.participants.length > 0 && (
                  <div className="card-gaming p-6">
                    <h2 className="text-2xl font-bold text-white mb-6">Registered Players</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tournament.participants.slice(0, 10).map((participant, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gaming-charcoal/50 rounded-lg">
                          <div className="w-10 h-10 bg-gaming-neon/20 rounded-full flex items-center justify-center">
                            <span className="text-gaming-neon font-bold">
                              {participant.userId?.username?.charAt(0).toUpperCase() || 'P'}
                            </span>
                          </div>
                          <div>
                            <div className="text-white font-medium">
                              {participant.userId?.username || `Player ${index + 1}`}
                            </div>
                            <div className="text-gray-400 text-sm">
                              ID: {participant.gameId}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {tournament.participants.length > 10 && (
                      <div className="text-center mt-4">
                        <span className="text-gray-400">
                          And {tournament.participants.length - 10} more players...
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Teams Tab */}
            {activeTab === 'teams' && (
              <div className="card-gaming p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Registered Teams</h2>
                
                {loadingTeams ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gaming-neon mx-auto mb-2"></div>
                      <p className="text-gray-300">Loading teams...</p>
                    </div>
                  </div>
                ) : registeredTeams.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-4xl mb-2"></div>
                    <p className="text-gray-400">No teams registered yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gaming-charcoal/50 border-b border-gaming-slate">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Team Name</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Leader</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Members</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Group</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gaming-slate">
                        {registeredTeams.map((team, index) => (
                          <tr key={team._id} className="hover:bg-gaming-slate/20 transition-colors">
                            <td className="px-4 py-3 text-sm text-white font-medium">{team.teamName}</td>
                            <td className="px-4 py-3 text-sm text-white">{team.teamLeader?.name || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm text-gray-300">
                              <div className="flex flex-col space-y-1">
                                <span>Leader: {team.teamLeader?.bgmiId || 'N/A'}</span>
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
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                team.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                                team.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                team.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {team.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">
                              {new Date(team.registeredAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Chat Tab - Commented out for future implementation */}
            {/* {activeTab === 'chat' && (
              <div className="card-gaming p-6">
                <h2 className="text-2xl font-bold text-white mb-6">💬 Tournament Chat</h2>
                <div className="text-center py-8">
                  <p className="text-gray-400">Chat feature coming soon...</p>
                </div>
              </div>
            )} */}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">Registration</h3>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Spots Filled</span>
                  <span>{tournament.currentParticipants}/{tournament.maxParticipants}</span>
                </div>
                <div className="w-full bg-gaming-charcoal rounded-full h-3">
                  <div
                    className="bg-gaming-neon h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(tournament.currentParticipants / tournament.maxParticipants) * 100}%` }}
                  ></div>
                </div>
                <div className="text-center mt-2">
                  <span className="text-gaming-neon font-bold">
                    {Math.round((tournament.currentParticipants / tournament.maxParticipants) * 100)}% Full
                  </span>
                </div>
              </div>

              {/* Registration Status */}
              {!isAuthenticated ? (
                <button
                  onClick={() => navigate('/login')}
                  className="w-full btn-gaming mb-4 hover:shadow-lg transition-all pointer-events-auto cursor-pointer !opacity-100"
                  type="button"
                  disabled={false}
                >
                  Login to Join - ₹{tournament.entryFee}
                </button>
              ) : isUserRegistered ? (
                <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
                  <div className="text-green-400 text-2xl mb-2">✅</div>
                  <div className="text-green-400 font-bold">You're Registered!</div>
                  <div className="text-gray-300 text-sm mt-1">Good luck in the tournament</div>
                </div>
              ) : canRegister() ? (
                <div className="space-y-2 mb-4">
                  <button
                    onClick={() => setShowRegistrationForm(true)}
                    className="w-full btn-gaming"
                  >
                    Register Now - ₹{tournament.entryFee}
                  </button>
                  <button
                    onClick={() => setShowTeamRegistrationForm(true)}
                    className="w-full btn-primary text-sm"
                  >
                    Register with Team
                  </button>
                </div>
              ) : (
                <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                  <div className="text-red-400 font-bold">Registration Closed</div>
                  <div className="text-gray-300 text-sm mt-1">
                    {tournament.status === 'completed' ? 'Tournament completed' :
                     tournament.currentParticipants >= tournament.maxParticipants ? 'Tournament full' :
                     'Registration period ended'}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => navigate(tournament.gameType === 'freefire' ? '/freefire' : '/bgmi')}
                  className="w-full btn-primary"
                >
                  ← Back to {tournament.gameType === 'freefire' ? 'Free Fire' : 'BGMI'}
                </button>
                
                {tournament.status === 'active' && (
                  <button
                    onClick={() => navigate(`/tournaments/${tournament._id}/live`)}
                    className="w-full btn-gaming bg-red-600 hover:bg-red-700"
                  >
                    View Live Match
                  </button>
                )}
              </div>
            </div>

            {/* Tournament Stats */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">Tournament Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-white">{formatDate(tournament.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Organizer:</span>
                  <span className="text-white">Colab Esports</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tournament ID:</span>
                  <span className="text-gaming-neon font-mono text-xs">{tournament._id}</span>
                </div>
              </div>
            </div>

            {/* Share Tournament */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">📤 Share Tournament</h3>
              <div className="space-y-2">
                <button className="w-full btn-primary text-sm">
                  Copy Link
                </button>
                <button className="w-full btn-primary text-sm">
                  Share on WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Form Modal - Works for BGMI and Free Fire */}
      {showRegistrationForm && tournament && (
        <BGMIRegistrationForm
          tournament={tournament}
          onClose={() => setShowRegistrationForm(false)}
          onSuccess={(registration) => {
            setShowRegistrationForm(false);
            // Update local registration state immediately
            setIsUserRegistered(true);
            // Refresh tournament data to show updated participant count
            dispatch(fetchTournamentById(id));
            console.log('Registration successful:', registration);
          }}
        />
      )}

      {/* Team Registration Form Modal */}
      {showTeamRegistrationForm && tournament && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gaming-card border border-gaming-border rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <TournamentTeamRegistrationForm
              tournament={tournament}
              token={localStorage.getItem('token')}
              onSuccess={() => {
                setShowTeamRegistrationForm(false);
                // Update local registration state immediately
                setIsUserRegistered(true);
                // Refresh tournament data to show updated participant count
                dispatch(fetchTournamentById(id));
                console.log('Team registration successful!');
              }}
              onClose={() => setShowTeamRegistrationForm(false)}
            />
          </div>
        </div>
      )}

      {/* Old Join Tournament Modal (kept for backward compatibility) */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gaming-charcoal rounded-lg p-6 w-full max-w-md"
          >
            <h3 className="text-xl font-bold text-white mb-4">Register for Tournament</h3>
            
            <form onSubmit={handleJoinTournament} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  BGMI Game ID *
                </label>
                <input
                  type="text"
                  value={joinForm.gameId}
                  onChange={(e) => setJoinForm(prev => ({ ...prev, gameId: e.target.value }))}
                  placeholder="Enter your BGMI ID"
                  required
                  className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                />
              </div>
              
              {tournament.mode !== 'solo' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Team Name {tournament.mode === 'squad' ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    value={joinForm.teamName}
                    onChange={(e) => setJoinForm(prev => ({ ...prev, teamName: e.target.value }))}
                    placeholder="Enter team name"
                    required={tournament.mode === 'squad'}
                    className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                  />
                </div>
              )}
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="text-yellow-400 text-sm font-medium mb-1">Entry Fee: ₹{tournament.entryFee}</div>
                <div className="text-gray-300 text-xs">
                  Amount will be deducted from your wallet balance
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-gaming"
                >
                  Register
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </div>

      {/* Mobile/Tablet View - Show message */}
      <div className="min-h-screen bg-gaming-dark lg:hidden flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-4">Desktop Only</h2>
          <p className="text-gray-300 mb-6">
            Tournament details are optimized for desktop viewing. Please visit this page on a desktop or laptop for the best experience.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-gaming-neon text-gaming-dark font-bold rounded-lg hover:bg-gaming-neon/90 transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    </>
  );
};

export default TournamentDetails;