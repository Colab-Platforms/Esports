import { useState } from 'react';
import { FiCheck, FiX, FiLoader } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';

const PlayerInputWithValidation = ({ 
  playerIndex, 
  onPlayerChange, 
  onValidationChange,
  token 
}) => {
  const [bgmiUid, setBgmiUid] = useState('');
  const [ignName, setIgnName] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null); // null, 'valid', 'invalid'
  const [validationMessage, setValidationMessage] = useState('');
  const [playerData, setPlayerData] = useState(null);

  const validatePlayer = async () => {
    // BGMI UID is required for validation
    if (!bgmiUid) {
      setValidationStatus('invalid');
      setValidationMessage('❌ BGMI UID is required');
      onValidationChange(playerIndex, false);
      return;
    }

    // IGN name is optional but if provided, use it; otherwise use empty string
    const playerIgnName = ignName || '';

    setValidating(true);
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

      console.log('🔗 Validating player with BGMI UID:', bgmiUid);
      
      const response = await axios.post(
        `${API_URL}/api/tournaments/validate-player`,
        { bgmiUid, ignName: playerIgnName },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.data.isRegistered) {
        setValidationStatus('valid');
        setValidationMessage('✅ Player found on platform');
        setPlayerData(response.data.data.player);
        onValidationChange(playerIndex, true);
        // Use user-provided IGN name, or fallback to player's bgmiIgnName from database
        const finalIgnName = playerIgnName || response.data.data.player.bgmiIgnName || response.data.data.player.username;
        onPlayerChange(playerIndex, {
          bgmiUid,
          ignName: finalIgnName,
          playerId: response.data.data.player._id,
          username: response.data.data.player.username,
          bgmiIgnName: response.data.data.player.bgmiIgnName
        });
      } else {
        setValidationStatus('invalid');
        setValidationMessage('❌ Player not registered on platform with this BGMI UID');
        setPlayerData(null);
        onValidationChange(playerIndex, false);
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationStatus('invalid');
      setValidationMessage('❌ Error validating player');
      setPlayerData(null);
      onValidationChange(playerIndex, false);
    } finally {
      setValidating(false);
    }
  };

  const handleClear = () => {
    setBgmiUid('');
    setIgnName('');
    setValidationStatus(null);
    setValidationMessage('');
    setPlayerData(null);
    onValidationChange(playerIndex, false);
  };

  return (
    <div className="space-y-2 mb-4 p-4 bg-gaming-charcoal border border-gaming-border rounded-lg">
      <label className="block text-white font-medium">
        Player {playerIndex + 1}
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="BGMI UID"
          value={bgmiUid}
          onChange={(e) => {
            setBgmiUid(e.target.value);
            setValidationStatus(null);
          }}
          disabled={validationStatus === 'valid'}
          className="flex-1 px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gaming-gold disabled:opacity-50"
        />

        <input
          type="text"
          placeholder="IGN Name"
          value={ignName}
          onChange={(e) => {
            setIgnName(e.target.value);
            setValidationStatus(null);
          }}
          disabled={validationStatus === 'valid'}
          className="flex-1 px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gaming-gold disabled:opacity-50"
        />

        {validationStatus === 'valid' ? (
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <FiX className="w-4 h-4" />
            Clear
          </button>
        ) : (
          <button
            type="button"
            onClick={validatePlayer}
            disabled={validating || !bgmiUid}
            className="px-4 py-2 bg-gaming-gold hover:bg-yellow-500 disabled:bg-gray-600 text-black rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            {validating ? (
              <>
                <FiLoader className="animate-spin w-4 h-4" />
                Checking...
              </>
            ) : (
              'Validate'
            )}
          </button>
        )}
      </div>

      {/* Validation Status */}
      {validationStatus && (
        <div className={`flex items-start gap-3 p-3 rounded-lg ${
          validationStatus === 'valid' 
            ? 'bg-green-900/30 border border-green-600/50' 
            : 'bg-red-900/30 border border-red-600/50'
        }`}>
          {validationStatus === 'valid' ? (
            <FiCheck className="text-green-400 w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <FiX className="text-red-400 w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={validationStatus === 'valid' ? 'text-green-400' : 'text-red-400'}>
              {validationMessage}
            </p>
            {playerData && validationStatus === 'valid' && (
              <div className="space-y-1">
                <p className="text-green-300 text-sm">
                  Username: <span className="font-medium">{playerData.username}</span>
                </p>
                {playerData.bgmiIgnName && (
                  <p className="text-green-300 text-sm">
                    IGN Name: <span className="font-medium">{playerData.bgmiIgnName}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerInputWithValidation;
