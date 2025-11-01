import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  fetchTournamentById,
  joinTournament,
  selectCurrentTournament,
  selectTournamentLoading,
  selectTournamentError,
  clearError
} from '../../store/slices/tournamentSlice';
import { selectAuth } from '../../store/slices/authSlice';

const BGMITournamentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(selectAuth);
  const tournament = useSelector(selectCurrentTournament);
  const loading = useSelector(selectTournamentLoading);
  const error = useSelector(selectTournamentError);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinForm, setJoinForm] = useState({
    gameId: '',
    teamName: ''
  });

  useEffect(() => {
    if (id) {
      dispatch(fetchTournamentById(id));
    }
  }, [dispatch, id]);

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

  const isUserRegistered = () => {
    if (!tournament || !user) return false;
    return tournament.participants?.some(p => p.userId === user.id);
  };

  const canRegister = () => {
    if (!tournament) return false;
    return tournament.status === 'registration_open' && 
           tournament.currentParticipants < tournament.maxParticipants &&
           !isUserRegistered();
  };

  if (loading.tournamentDetails) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (error.tournamentDetails) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Tournament</h2>
          <p className="text-gray-300 mb-4">{error.tournamentDetails.message}</p>
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
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
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
    <div className="min-h-screen bg-gaming-dark">
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
              {tournament.description}
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
            {/* Tournament Info */}
            <div className="card-gaming p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Tournament Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">📅 Schedule</h3>
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
                  <h3 className="text-lg font-bold text-white mb-4">🎮 Game Details</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-400">Game</div>
                      <div className="text-white font-medium">BGMI (Battlegrounds Mobile India)</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Mode</div>
                      <div className="text-white font-medium capitalize">{tournament.mode}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Format</div>
                      <div className="text-white font-medium capitalize">{tournament.format.replace('_', ' ')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Prize Distribution */}
            <div className="card-gaming p-6">
              <h2 className="text-2xl font-bold text-white mb-6">🏆 Prize Distribution</h2>
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
              <h2 className="text-2xl font-bold text-white mb-6">📋 Tournament Rules</h2>
              <div className="prose prose-invert max-w-none">
                <div className="text-gray-300 whitespace-pre-line">
                  {tournament.rules}
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <h4 className="text-yellow-400 font-bold mb-2">⚠️ Important Notes for BGMI:</h4>
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
                <h2 className="text-2xl font-bold text-white mb-6">👥 Registered Players</h2>
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">🎯 Registration</h3>
              
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
              {isUserRegistered() ? (
                <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
                  <div className="text-green-400 text-2xl mb-2">✅</div>
                  <div className="text-green-400 font-bold">You're Registered!</div>
                  <div className="text-gray-300 text-sm mt-1">Good luck in the tournament</div>
                </div>
              ) : canRegister() ? (
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="w-full btn-gaming mb-4"
                >
                  Register Now - ₹{tournament.entryFee}
                </button>
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
                  onClick={() => navigate('/bgmi')}
                  className="w-full btn-primary"
                >
                  ← Back to BGMI
                </button>
                
                {tournament.status === 'active' && (
                  <button
                    onClick={() => navigate(`/tournaments/${tournament._id}/live`)}
                    className="w-full btn-gaming bg-red-600 hover:bg-red-700"
                  >
                    🔴 View Live Match
                  </button>
                )}
              </div>
            </div>

            {/* Tournament Stats */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">📊 Tournament Stats</h3>
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
                  📋 Copy Link
                </button>
                <button className="w-full btn-primary text-sm">
                  📱 Share on WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Join Tournament Modal */}
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
  );
};

export default BGMITournamentDetails;