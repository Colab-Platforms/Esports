import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import PlayerField from './PlayerField';

const BGMIDynamicPlayerForm = ({
  teamSize,
  existingTeamMembers,
  onSubmit,
  onCancel,
  tournament
}) => {
  // Initialize players array with existing team members only
  const initializePlayers = () => {
    const players = [];
    
    // Add existing team members (only the required number)
    if (existingTeamMembers && existingTeamMembers.length > 0) {
      existingTeamMembers.slice(0, teamSize).forEach(member => {
        players.push({
          name: member.username || member.name || '',
          bgmiId: member.gameId || member.bgmiId || '',
          isAdded: false // Mark as original member
        });
      });
    }
    
    // If no existing members, start with one empty player
    if (players.length === 0) {
      players.push({
        name: '',
        bgmiId: '',
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

  // Validation functions
  const validateIGN = (ign) => {
    if (!ign || !ign.trim()) {
      return 'IGN is required';
    }
    if (ign.length < 3) {
      return 'IGN must be at least 3 characters';
    }
    if (ign.length > 20) {
      return 'IGN cannot exceed 20 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(ign)) {
      return 'IGN can only contain letters, numbers, and underscores';
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
      .filter(p => p.bgmiId && p.bgmiId.trim())
      .map(p => p.bgmiId.trim());
    
    const uniqueUids = new Set(uids);
    return uids.length !== uniqueUids.size;
  };

  const validateForm = useCallback(() => {
    const newErrors = {};
    let hasErrors = false;

    // Check if we have exactly 4 players
    if (players.length < 4) {
      // This will be handled by parent component with snackbar
      return { hasErrors: true, message: '4 players are required' };
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
        if (!player.bgmiId || !player.bgmiId.trim()) {
          playerErrors.bgmiId = 'UID is required';
          hasErrors = true;
        } else {
          const uidError = validateUID(player.bgmiId);
          if (uidError) {
            playerErrors.bgmiId = uidError;
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
        if (player.bgmiId && player.bgmiId.trim()) {
          if (!newErrors[index]) {
            newErrors[index] = {};
          }
          newErrors[index].bgmiId = 'Duplicate UID detected';
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
      const friendsList = response.data?.friends || response.friends || [];
      setFriends(friendsList);
    } catch (error) {
      console.error('Error fetching friends:', error);
      setFriendsError('Unable to load friend list. Please try again.');
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  // Fetch friends list on component mount
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Handle add from friends button - removed, now using dropdown
  // Friend selection happens directly in PlayerField dropdown

  // Handle add player button - add only one player at a time
  const handleAddPlayer = useCallback(() => {
    if (players.length < 4) {
      setPlayers(prev => [
        ...prev,
        {
          name: '',
          bgmiId: '',
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
        bgmiId: value
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
      // Call parent's onSubmit with players data
      await onSubmit(players);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  }, [players, validateForm, onSubmit]);

  const isFormValid = Object.keys(errors).length === 0 && 
                      players.every(p => p.name && p.name.trim() && p.bgmiId && p.bgmiId.trim());
  const canAddMore = players.length < 4;

  return (
    <div className="space-y-4">
      {/* Player Count Display */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">
          👥 Team Players
        </h3>
        <div className="text-sm text-gray-400">
          <span className="text-gaming-neon font-medium">{players.length}</span>
          <span className="text-gray-500">/4 Players</span>
        </div>
      </div>

      {/* Players List */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-3">
          {players.map((player, index) => (
            <div key={`player-${index}`} className="flex items-start gap-2">
              <div className="flex-1">
                <PlayerField
                  playerNumber={index + 1}
                  player={player}
                  isRemovable={index >= teamSize}
                  onNameChange={handleNameChange}
                  onUidChange={handleUidChange}
                  onRemove={handleRemovePlayer}
                  errors={errors}
                  isOriginalMember={index < teamSize}
                  friends={friends}
                  allPlayers={players}
                />
              </div>
              
              {/* Add Player Button - Right side of player card */}
              {canAddMore && index === players.length - 1 && (
                <motion.button
                  type="button"
                  onClick={handleAddPlayer}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-3 py-2 bg-gaming-neon/10 border border-gaming-neon text-gaming-neon rounded-lg font-medium hover:bg-gaming-neon/20 transition-colors text-xs h-fit mt-8"
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

export default BGMIDynamicPlayerForm;
