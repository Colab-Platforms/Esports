import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import api from '../../services/api';
import FreeFirePlayerField from './FreeFirePlayerField';

const FreeFireDynamicPlayerForm = ({
  teamSize,
  existingTeamMembers,
  onSubmit,
  onCancel,
  tournament
}) => {
  const currentUser = useSelector(selectUser);
  // Initialize players array with existing team members only
  const initializePlayers = () => {
    const players = [];
    
    // Add existing team members (only the required number)
    if (existingTeamMembers && existingTeamMembers.length > 0) {
      existingTeamMembers.slice(0, teamSize).forEach(member => {
        players.push({
          name: member.username || member.name || '',
          freeFireId: member.gameId || member.freeFireId || '',
          playerId: member._id || null,
          isAdded: false // Mark as original member
        });
      });
    }
    
    // If no existing members, start with one empty player
    if (players.length === 0) {
      players.push({
        name: '',
        freeFireId: '',
        playerId: null,
        isAdded: false
      });
    }
    
    return players;
  };

  const [players, setPlayers] = useState(initializePlayers());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [unregisteredPlayerIndices, setUnregisteredPlayerIndices] = useState([]);

  // Validation functions
  const validateIGN = (ign) => {
    if (!ign || !ign.trim()) {
      return 'IGN is required';
    }
    return null;
  };

  const validateUID = (uid) => {
    // UID is optional if not filled yet (will be auto-filled from friend)
    if (!uid || !uid.trim()) {
      return null; // Allow empty UID (will be filled from friend selection)
    }
    if (!/^\d+$/.test(uid)) {
      return 'UID must contain only numbers';
    }
    return null;
  };

  const checkDuplicateUIDs = (playersList) => {
    const uids = playersList
      .filter(p => p.freeFireId && p.freeFireId.trim())
      .map(p => p.freeFireId.trim());
    
    const uniqueUids = new Set(uids);
    return uids.length !== uniqueUids.size;
  };

  const validateForm = useCallback(() => {
    const newErrors = {};
    let hasErrors = false;

    // Check if we have exactly 3 players (Free Fire = 4 total with leader)
    if (players.length < 3) {
      return { hasErrors: true, message: '3 players are required' };
    }

    players.forEach((player, index) => {
      const playerErrors = {};
      
      const ignError = validateIGN(player.name);
      if (ignError) {
        playerErrors.name = ignError;
        hasErrors = true;
      }

      // UID is required only if IGN is filled
      if (player.name && player.name.trim()) {
        if (!player.freeFireId || !player.freeFireId.trim()) {
          playerErrors.freeFireId = 'UID is required';
          hasErrors = true;
        } else {
          const uidError = validateUID(player.freeFireId);
          if (uidError) {
            playerErrors.freeFireId = uidError;
            hasErrors = true;
          }
        }
      }

      if (Object.keys(playerErrors).length > 0) {
        newErrors[index] = playerErrors;
      }
    });

    // Check for duplicate UIDs
    if (checkDuplicateUIDs(players)) {
      hasErrors = true;
      players.forEach((player, index) => {
        if (player.freeFireId && player.freeFireId.trim()) {
          if (!newErrors[index]) {
            newErrors[index] = {};
          }
          newErrors[index].freeFireId = 'Duplicate UID detected';
        }
      });
    }

    setErrors(newErrors);
    return { hasErrors, errors: newErrors };
  }, [players]);

  // Fetch friends list
  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    setFriendsError('');
    try {
      const response = await api.get('/api/users/friends');
      let friendsList = response.data?.friends || response.friends || [];
      
      // Add current user to the beginning of friends list so they can add themselves
      if (currentUser) {
        const currentUserInList = {
          _id: currentUser._id,
          username: currentUser.username,
          freeFireUid: currentUser.gameIds?.freefire?.uid || currentUser.freeFireUid || '',
          freeFireIgnName: currentUser.gameIds?.freefire?.ign || currentUser.freeFireIgnName || '',
          avatarUrl: currentUser.avatarUrl
        };
        
        // Add current user at the beginning if not already in the list
        friendsList = [currentUserInList, ...friendsList];
      }
      
      setFriends(friendsList);
    } catch (error) {
      console.error('Error fetching friends:', error);
      setFriendsError('Unable to load friend list. Please try again.');
    } finally {
      setLoadingFriends(false);
    }
  }, [currentUser]);

  // Fetch friends list on component mount
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Handle add player button - add only one player at a time
  const handleAddPlayer = useCallback(() => {
    if (players.length < 3) {
      setPlayers(prev => [
        ...prev,
        {
          name: '',
          freeFireId: '',
          playerId: null,
          isAdded: true
        }
      ]);
    }
  }, [players.length]);

  // Handle remove player
  const handleRemovePlayer = useCallback((playerIndex) => {
    setPlayers(prev => prev.filter((_, index) => index !== playerIndex));
    setErrors(prev => {
      const updated = { ...prev };
      delete updated[playerIndex];
      return updated;
    });
  }, []);

  // Handle name change
  const handleNameChange = useCallback((playerIndex, value) => {
    setPlayers(prev => {
      const updated = [...prev];
      updated[playerIndex] = {
        ...updated[playerIndex],
        name: value
      };
      return updated;
    });
  }, []);

  // Handle UID change
  const handleUidChange = useCallback((playerIndex, value) => {
    setPlayers(prev => {
      const updated = [...prev];
      updated[playerIndex] = {
        ...updated[playerIndex],
        freeFireId: value
      };
      return updated;
    });
  }, []);

  // Handle player ID change (when friend is selected from dropdown)
  const handlePlayerIdChange = useCallback((playerIndex, playerId) => {
    setPlayers(prev => {
      const updated = [...prev];
      updated[playerIndex] = {
        ...updated[playerIndex],
        playerId: playerId
      };
      return updated;
    });
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const validationResult = validateForm();
    
    if (validationResult.hasErrors) {
      // Store validation error in a way parent can access it
      window.dynamicFormValidationError = validationResult.message;
      return;
    }

    setLoading(true);
    try {
      // Validate that all players exist in Users collection
      console.log('🔍 Validating players exist in Users collection...');
      console.log('👥 Players to validate:', players);
      
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

      console.log('🔗 Using API URL:', API_URL);

      // Validate each player
      const validationPromises = players.map((player, idx) => {
        console.log(`📤 Validating player ${idx + 1}:`, player);
        return fetch(`${API_URL}/api/tournaments/validate-player`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            freeFireUid: player.freeFireId,
            ignName: player.name,
            playerId: player.playerId
          })
        })
        .then(res => {
          console.log(`📥 Response status for player ${idx + 1}:`, res.status);
          return res.json();
        })
        .then(data => {
          console.log(`✅ Validation result for player ${idx + 1}:`, data);
          return data;
        })
        .catch(err => {
          console.error(`❌ Validation error for player ${idx + 1}:`, err);
          return { success: false, error: err.message };
        });
      });

      const validationResults = await Promise.all(validationPromises);
      
      console.log('📊 All validation results:', validationResults);
      
      // Check if all players are registered
      const unregisteredPlayers = [];
      validationResults.forEach((result, index) => {
        console.log(`Player ${index + 1} - isRegistered:`, result.data?.isRegistered);
        if (!result.data?.isRegistered) {
          unregisteredPlayers.push(`Player ${index + 1}: ${players[index].name}`);
        }
      });

      console.log('🚨 Unregistered players:', unregisteredPlayers);

      if (unregisteredPlayers.length > 0) {
        // Mark which players are unregistered
        const unregisteredIndices = [];
        validationResults.forEach((result, index) => {
          if (!result.data?.isRegistered) {
            unregisteredIndices.push(index);
          }
        });
        setUnregisteredPlayerIndices(unregisteredIndices);
        
        const errorMsg = `⚠️ The following players are not registered on our platform:\n${unregisteredPlayers.join('\n')}\n\nAll team members must be registered before tournament registration.`;
        console.error('❌ Validation failed:', errorMsg);
        window.dynamicFormValidationError = errorMsg;
        setLoading(false);
        return;
      }

      // Clear unregistered players list if validation passes
      setUnregisteredPlayerIndices([]);

      // Call parent's onSubmit with players data
      await onSubmit(players);
    } catch (error) {
      console.error('Error submitting form:', error);
      window.dynamicFormValidationError = 'Error validating players. Please try again.';
    } finally {
      setLoading(false);
    }
  }, [players, validateForm, onSubmit]);

  const canAddMore = players.length < 3;

  return (
    <div className="space-y-4">
      {/* Player Count Display */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">
          👥 Team Players
        </h3>
        <div className="text-sm text-gray-400">
          <span className="text-orange-500 font-medium">{players.length}</span>
          <span className="text-gray-500">/3 Players</span>
        </div>
      </div>

      {/* Players List */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-3">
          {players.map((player, index) => (
            <div key={`player-${index}`} className="flex items-start gap-2">
              <div className="flex-1">
                <FreeFirePlayerField
                  playerNumber={index + 1}
                  player={player}
                  isRemovable={index >= teamSize}
                  onNameChange={handleNameChange}
                  onUidChange={handleUidChange}
                  onPlayerIdChange={handlePlayerIdChange}
                  onRemove={handleRemovePlayer}
                  errors={errors}
                  isOriginalMember={index < teamSize}
                  friends={friends}
                  allPlayers={players}
                  isUnregistered={unregisteredPlayerIndices.includes(index)}
                />
              </div>
              
              {/* Add Player Button - Right side of player card */}
              {canAddMore && index === players.length - 1 && (
                <motion.button
                  type="button"
                  onClick={handleAddPlayer}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-3 py-2 bg-orange-500/10 border border-orange-500 text-orange-500 rounded-lg font-medium hover:bg-orange-500/20 transition-colors text-xs h-fit mt-8"
                  title="Add another player"
                >
                  + Add
                </motion.button>
              )}
            </div>
          ))}
        </div>
      </AnimatePresence>

      {/* Error Message */}
      {friendsError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
        >
          <p className="text-red-400 text-sm">{friendsError}</p>
        </motion.div>
      )}

      {/* Hidden Submit Button - Triggered by parent */}
      <button
        type="button"
        data-dynamic-form-submit
        onClick={handleSubmit}
        style={{ display: 'none' }}
      >
        Submit
      </button>
    </div>
  );
};

export default FreeFireDynamicPlayerForm;
