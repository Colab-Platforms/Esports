import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchMatchDetails, 
  generateRoomCredentials,
  selectCurrentMatch,
  selectMatchLoading,
  selectMatchError,
  clearMatchError
} from '../../store/slices/matchSlice';

const MatchRoom = ({ matchId }) => {
  const dispatch = useDispatch();
  const match = useSelector(selectCurrentMatch);
  const loading = useSelector(selectMatchLoading);
  const error = useSelector(selectMatchError);
  
  const [timeUntilStart, setTimeUntilStart] = useState('');
  const [isMatchStarted, setIsMatchStarted] = useState(false);

  useEffect(() => {
    if (matchId) {
      dispatch(fetchMatchDetails(matchId));
    }
  }, [dispatch, matchId]);

  useEffect(() => {
    if (match) {
      const updateTimer = () => {
        const now = new Date();
        const scheduledTime = new Date(match.scheduledAt);
        const startTime = match.startedAt ? new Date(match.startedAt) : null;
        
        if (startTime && now >= startTime) {
          setIsMatchStarted(true);
          setTimeUntilStart('Match Started');
        } else if (now >= scheduledTime) {
          setTimeUntilStart('Starting Soon...');
        } else {
          const timeDiff = scheduledTime - now;
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
          
          if (hours > 0) {
            setTimeUntilStart(`${hours}h ${minutes}m ${seconds}s`);
          } else if (minutes > 0) {
            setTimeUntilStart(`${minutes}m ${seconds}s`);
          } else {
            setTimeUntilStart(`${seconds}s`);
          }
        }
      };

      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      
      return () => clearInterval(timer);
    }
  }, [match]);

  const handleGenerateCredentials = () => {
    if (match) {
      dispatch(generateRoomCredentials(match._id));
    }
  };

  const handleCopyCredentials = () => {
    if (match) {
      let credentialsText = '';
      
      if (match.gameType === 'cs2') {
        credentialsText = `Server: ${match.serverDetails?.ip}:${match.serverDetails?.port}\nPassword: ${match.serverDetails?.password}\nConnect Command: ${match.serverDetails?.connectString}`;
      } else {
        credentialsText = `Room ID: ${match.roomId}\nPassword: ${match.roomPassword}`;
      }
      
      navigator.clipboard.writeText(credentialsText).then(() => {
        // You could show a toast notification here
        alert('Credentials copied to clipboard!');
      });
    }
  };

  const getGameIcon = (gameType) => {
    switch (gameType) {
      case 'bgmi':
        return '🎮';
      case 'valorant':
        return '🎯';
      case 'cs2':
        return '⚡';
      default:
        return '🎮';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'active':
        return 'text-green-400 bg-green-400/10';
      case 'completed':
        return 'text-blue-400 bg-blue-400/10';
      case 'disputed':
        return 'text-red-400 bg-red-400/10';
      case 'cancelled':
        return 'text-gray-400 bg-gray-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  if (loading.matchDetails) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading match details...</p>
        </div>
      </div>
    );
  }

  if (error.matchDetails) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Match</h2>
          <p className="text-gray-300 mb-4">{error.matchDetails.message}</p>
          <button
            onClick={() => {
              dispatch(clearMatchError('matchDetails'));
              dispatch(fetchMatchDetails(matchId));
            }}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-white mb-2">Match Not Found</h2>
          <p className="text-gray-300">The requested match could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark">
      <div className="container mx-auto px-4 py-8">
        {/* Match Header */}
        <div className="card-gaming p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="text-3xl">{getGameIcon(match.gameType)}</div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {match.tournamentId?.name} - Round {match.roundNumber}
                </h1>
                <p className="text-gray-300">Match #{match.matchNumber}</p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(match.status)}`}>
              {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
            </div>
          </div>
          
          {/* Timer */}
          <div className="text-center py-4">
            <div className="text-3xl font-bold text-gaming-neon mb-2">
              {timeUntilStart}
            </div>
            <p className="text-gray-300">
              {isMatchStarted ? 'Match is live!' : 'Until match starts'}
            </p>
          </div>
        </div>

        {/* Room Credentials */}
        {(match.roomId || match.serverDetails?.ip) && (
          <div className="card-gaming p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Room Details</h2>
              <div className="flex space-x-2">
                <button
                  onClick={handleCopyCredentials}
                  className="btn-primary text-sm"
                >
                  📋 Copy Details
                </button>
                <button
                  onClick={handleGenerateCredentials}
                  disabled={loading.roomCredentials}
                  className="btn-gaming text-sm"
                >
                  {loading.roomCredentials ? '⏳' : '🔄'} Refresh
                </button>
              </div>
            </div>
            
            {match.gameType === 'cs2' ? (
              <div className="space-y-3">
                <div className="bg-gaming-charcoal/50 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Server IP
                      </label>
                      <div className="bg-black/30 p-3 rounded border font-mono text-gaming-neon">
                        {match.serverDetails?.ip}:{match.serverDetails?.port}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Password
                      </label>
                      <div className="bg-black/30 p-3 rounded border font-mono text-gaming-neon">
                        {match.serverDetails?.password}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Connect Command
                    </label>
                    <div className="bg-black/30 p-3 rounded border font-mono text-gaming-neon text-sm">
                      {match.serverDetails?.connectString}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-300 mb-2">Room ID</div>
                  <div className="bg-black/30 p-4 rounded-lg border-2 border-gaming-neon/30">
                    <div className="text-2xl font-mono font-bold text-gaming-neon">
                      {match.roomId}
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-300 mb-2">Password</div>
                  <div className="bg-black/30 p-4 rounded-lg border-2 border-gaming-neon/30">
                    <div className="text-2xl font-mono font-bold text-gaming-neon">
                      {match.roomPassword}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Participants */}
        <div className="card-gaming p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Participants ({match.participants?.length || 0})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {match.participants?.map((participant, index) => (
              <div key={participant.userId._id} className="bg-gaming-charcoal/50 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gaming-neon/20 rounded-full flex items-center justify-center">
                    <span className="text-gaming-neon font-bold">
                      {participant.userId.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {participant.userId.username}
                    </div>
                    <div className="text-sm text-gray-300">
                      {participant.gameId}
                    </div>
                  </div>
                </div>
                {participant.resultSubmittedAt && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <div className="text-xs text-green-400">✓ Result Submitted</div>
                    <div className="text-sm text-gray-300 mt-1">
                      Score: {participant.score || 0}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Match Instructions */}
        <div className="card-gaming p-6">
          <h2 className="text-xl font-bold text-white mb-4">Instructions</h2>
          <div className="space-y-3 text-gray-300">
            <div className="flex items-start space-x-3">
              <span className="text-gaming-neon font-bold">1.</span>
              <span>Join the game using the room credentials provided above</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-gaming-neon font-bold">2.</span>
              <span>Play the match according to tournament rules</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-gaming-neon font-bold">3.</span>
              <span>Take a screenshot of your final results</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-gaming-neon font-bold">4.</span>
              <span>Submit your results using the result submission form</span>
            </div>
          </div>
          
          {match.status === 'active' && (
            <div className="mt-6">
              <button
                onClick={() => window.location.href = `/matches/${match._id}/submit-result`}
                className="btn-gaming w-full"
              >
                📊 Submit Match Results
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchRoom;