import { useState } from 'react';
import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import PlayerInputWithValidation from './PlayerInputWithValidation';
import axios from 'axios';
import toast from 'react-hot-toast';

const TournamentTeamRegistrationForm = ({ tournament, token, onSuccess, onClose }) => {
  const [teamPlayers, setTeamPlayers] = useState([
    { bgmiUid: '', ignName: '', isValid: false, playerId: null, username: '', registrationError: null },
    { bgmiUid: '', ignName: '', isValid: false, playerId: null, username: '', registrationError: null },
    { bgmiUid: '', ignName: '', isValid: false, playerId: null, username: '', registrationError: null }
  ]);
  const [loading, setLoading] = useState(false);

  const handlePlayerChange = (index, playerData) => {
    const newPlayers = [...teamPlayers];
    newPlayers[index] = { ...newPlayers[index], ...playerData };
    setTeamPlayers(newPlayers);
  };

  const handleValidationChange = (index, isValid) => {
    const newPlayers = [...teamPlayers];
    newPlayers[index].isValid = isValid;
    setTeamPlayers(newPlayers);
  };

  const allPlayersValid = teamPlayers.every(p => p.isValid);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if all players are validated
    if (!allPlayersValid) {
      toast.error('All players must be validated before registration', {
        duration: 3000,
        position: 'top-center'
      });
      return;
    }

    setLoading(true);

    try {
      // Get API URL with smart detection
      let API_URL = process.env.REACT_APP_API_URL;
      if (!API_URL && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
          API_URL = 'http://127.0.0.1:5001';
        } else {
          const protocol = window.location.protocol;
          API_URL = `${protocol}//${hostname}`;
        }
      }
      if (!API_URL) {
        API_URL = 'http://127.0.0.1:5001';
      }

      const response = await axios.post(
        `${API_URL}/api/tournaments/${tournament._id}/join-with-players`,
        {
          teamPlayers: teamPlayers.map(p => ({
            bgmiUid: p.bgmiUid,
            ignName: p.ignName,
            playerId: p.playerId
          }))
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Tournament registration successful! 🎉', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.response?.data?.error?.code === 'INVALID_PLAYERS') {
        const invalidPlayers = error.response.data.error.invalidPlayers;
        
        // Map errors to player indices
        const newPlayers = [...teamPlayers];
        invalidPlayers.forEach(invalidPlayer => {
          // Find the player index that matches this invalid player
          const playerIndex = newPlayers.findIndex(p => 
            p.bgmiUid === invalidPlayer.bgmiUid || 
            p.ignName === invalidPlayer.ignName
          );
          
          if (playerIndex !== -1) {
            newPlayers[playerIndex].registrationError = invalidPlayer.message;
          }
        });
        
        setTeamPlayers(newPlayers);
        
        // Show summary toast
        const message = invalidPlayers
          .map(p => `${p.ignName || p.bgmiUid} - ${p.message}`)
          .join('\n');
        
        toast.error(`Registration failed:\n${message}`, {
          duration: 5000,
          position: 'top-center'
        });
      } else {
        toast.error(error.response?.data?.error?.message || 'Registration failed', {
          duration: 3000,
          position: 'top-center'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-white text-lg font-bold mb-2">Add Team Players</h3>
        <p className="text-gray-400 text-sm flex items-center gap-2">
          <FiAlertCircle className="w-4 h-4" />
          All players must be registered on our platform
        </p>
      </div>

      {/* Player Inputs */}
      <div className="space-y-3">
        {teamPlayers.map((player, index) => (
          <PlayerInputWithValidation
            key={index}
            playerIndex={index}
            onPlayerChange={handlePlayerChange}
            onValidationChange={handleValidationChange}
            token={token}
            registrationError={player.registrationError}
          />
        ))}
      </div>

      {/* Validation Summary */}
      <div className="bg-gaming-charcoal p-4 rounded-lg border border-gaming-border">
        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
          <FiCheckCircle className="w-5 h-5" />
          Registration Status
        </h4>
        <div className="space-y-2">
          {teamPlayers.map((player, index) => (
            <div key={index} className="flex items-center gap-3 text-sm">
              {player.isValid ? (
                <>
                  <span className="text-green-400 font-bold">✅</span>
                  <span className="text-gray-300">
                    Player {index + 1}: <span className="text-green-400 font-medium">{player.ignName || player.username}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-red-400 font-bold">❌</span>
                  <span className="text-gray-400">Player {index + 1}: Not validated</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
        <p className="text-blue-300 text-sm">
          💡 <span className="font-medium">Tip:</span> You can search players by their BGMI UID or IGN name. Make sure all players are registered on our platform before registering for the tournament.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !allPlayersValid}
          className="flex-1 py-3 bg-gaming-gold hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-black rounded-lg font-bold transition-colors"
        >
          {loading ? 'Registering...' : 'Register for Tournament'}
        </button>
      </div>
    </form>
  );
};

export default TournamentTeamRegistrationForm;
