import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

const PlayerSearchAndAdd = ({
  onAddPlayer,
  currentTeamMembers,
  maxPlayers = 4,
  currentUserData
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search - triggers 800ms after user stops typing
  useEffect(() => {
    // Clear results if query is empty
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setError('');
      return;
    }

    // Set loading state immediately
    setLoading(true);
    setError('');

    // Debounce timer - wait 800ms before searching
    const debounceTimer = setTimeout(async () => {
      setHasSearched(true);
      
      console.log('🔍 Searching for:', searchQuery.trim());
      
      try {
        const response = await api.get('/api/users/players/public', {
          params: { search: searchQuery.trim() }
        });

        console.log('📦 API Response:', response.data);

        let players = response.data?.data?.players || response.data?.players || [];
        
        console.log('👥 Players found:', players.length);
        
        // Filter out already added players
        const addedUsernames = currentTeamMembers.map(m => m.name.toLowerCase());
        players = players.filter(p => !addedUsernames.includes(p.bgmiIgnName?.toLowerCase()));
        
        // Filter out current user if they're in results
        if (currentUserData?.username) {
          players = players.filter(p => p.username?.toLowerCase() !== currentUserData.username.toLowerCase());
        }

        console.log('✅ Final filtered players:', players.length);

        setSearchResults(players);
        
        if (players.length === 0 && searchQuery.trim()) {
          setError('No players found with both IGN name and BGMI UID set');
        }
      } catch (err) {
        console.error('❌ Search error:', err);
        console.error('Error response:', err.response?.data);
        setError('Failed to search players');
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 800); // 800ms debounce delay

    // Cleanup function - cancel timer if user types again
    return () => {
      clearTimeout(debounceTimer);
    };
  }, [searchQuery, currentTeamMembers, currentUserData]);

  // Handle input change
  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    // Show loading immediately when user types
    if (e.target.value.trim()) {
      setLoading(true);
    }
    else {
      setLoading(false);
    }
  };

  // Add player to team
  const handleAddPlayer = useCallback((player) => {
    if (currentTeamMembers.length >= maxPlayers) {
      setError(`Team is full (max ${maxPlayers} players)`);
      return;
    }

    const newPlayer = {
      name: player.bgmiIgnName,
      bgmiId: player.bgmiUid || '',
      playerId: player._id
    };

    onAddPlayer(newPlayer);
    
    // Remove from search results
    setSearchResults(prev => prev.filter(p => p._id !== player._id));
    
    // Clear search
    setSearchQuery('');
    setHasSearched(false);
  }, [currentTeamMembers, maxPlayers, onAddPlayer]);

  const isTeamFull = currentTeamMembers.length >= maxPlayers;

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          🔍 Search & Add Players
          {isTeamFull && <span className="text-red-400 ml-2">(Team Full)</span>}
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            placeholder={isTeamFull ? "Team is full" : "Search by IGN name or BGMI UID..."}
            disabled={isTeamFull}
            className={`w-full px-4 py-3 bg-gaming-charcoal border rounded-lg text-white focus:outline-none transition-colors ${
              isTeamFull
                ? 'border-red-500/30 bg-gaming-charcoal/50 cursor-not-allowed opacity-50'
                : 'border-gray-600 focus:border-gaming-neon'
            }`}
          />
          {loading && !isTeamFull && (
            <div className="absolute right-3 top-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gaming-neon"></div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
        >
          <p className="text-red-400 text-sm">{error}</p>
        </motion.div>
      )}

      {/* Search Results */}
      <AnimatePresence>
        {hasSearched && searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gaming-charcoal border border-gaming-slate rounded-lg overflow-hidden max-h-64 overflow-y-auto"
          >
            <div className="space-y-1 p-2">
              {searchResults.map((player) => (
                <motion.div
                  key={player._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-gaming-slate rounded hover:bg-gaming-slate/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      {/* Avatar */}
                      <div className="w-8 h-8 bg-gaming-neon/20 rounded-full flex items-center justify-center flex-shrink-0">
                        {player.avatar ? (
                          <img
                            src={player.avatar}
                            alt={player.bgmiIgnName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-gaming-neon font-bold text-xs">
                            {player.bgmiIgnName?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">
                          {player.bgmiIgnName}
                        </h4>
                        {player.bgmiUid && (
                          <p className="text-gaming-neon text-xs">
                            UID: {player.bgmiUid}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Add Button */}
                  <motion.button
                    type="button"
                    onClick={() => handleAddPlayer(player)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="ml-2 px-3 py-1 bg-gaming-neon text-gaming-dark font-medium rounded text-xs hover:bg-gaming-neon/90 transition-colors flex-shrink-0"
                  >
                    + Add
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Results Message */}
      {hasSearched && searchResults.length === 0 && !loading && searchQuery.trim() && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-4 text-gray-400 text-sm"
        >
          No players found matching "{searchQuery}"
        </motion.div>
      )}

      {/* Info Text */}
      <div className={`text-xs rounded p-2 ${
        isTeamFull
          ? 'bg-red-500/10 border border-red-500/20 text-red-400'
          : 'bg-gaming-charcoal/50 text-gray-400'
      }`}>
        <p>
          {isTeamFull
            ? '❌ Team is full. Remove a player to add more.'
            : '💡 Type to search by IGN name or BGMI UID. Results appear after 0.8s. Players must have both set to appear.'}
        </p>
      </div>
    </div>
  );
};

export default PlayerSearchAndAdd;
