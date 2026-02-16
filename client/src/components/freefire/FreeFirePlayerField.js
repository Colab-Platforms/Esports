import { motion } from 'framer-motion';
import { useState, useCallback, useMemo } from 'react';

const FreeFirePlayerField = ({
  playerNumber,
  player,
  isRemovable,
  onNameChange,
  onUidChange,
  onPlayerIdChange,
  onRemove,
  errors,
  isOriginalMember,
  friends,
  allPlayers,
  isUnregistered
}) => {
  const [showFriendDropdown, setShowFriendDropdown] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');

  // Filter friends based on search query and exclude already added players
  const filteredFriends = useMemo(() => {
    if (!friends || friends.length === 0) return [];
    
    const addedPlayerIds = allPlayers
      .filter(p => p.playerId)
      .map(p => p.playerId);
    
    return friends.filter(friend => {
      // Exclude already added players
      if (addedPlayerIds.includes(friend._id)) return false;
      
      // Filter by search query
      if (friendSearchQuery) {
        const query = friendSearchQuery.toLowerCase();
        const username = (friend.username || '').toLowerCase();
        const ignName = (friend.freeFireIgnName || '').toLowerCase();
        return username.includes(query) || ignName.includes(query);
      }
      
      return true;
    });
  }, [friends, friendSearchQuery, allPlayers]);

  // Handle friend selection from dropdown
  const handleSelectFriend = useCallback((friend) => {
    const friendIgn = friend.freeFireIgnName || friend.username || '';
    const friendUid = friend.freeFireUid || '';
    
    onNameChange(playerNumber - 1, friendIgn);
    onUidChange(playerNumber - 1, friendUid);
    onPlayerIdChange(playerNumber - 1, friend._id);
    
    setShowFriendDropdown(false);
    setFriendSearchQuery('');
  }, [playerNumber, onNameChange, onUidChange, onPlayerIdChange]);

  const playerErrors = errors[playerNumber - 1] || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`bg-gaming-charcoal border rounded-lg p-4 ${
        isUnregistered 
          ? 'border-red-500/50 bg-red-500/5' 
          : 'border-gaming-slate'
      }`}
    >
      {/* Player Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-orange-500 font-bold">Player #{playerNumber}</span>
          {isOriginalMember && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
              Original
            </span>
          )}
          {isUnregistered && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
              Not Registered
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {/* Friend Selector Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFriendDropdown(!showFriendDropdown)}
              className="px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-500 rounded text-xs hover:bg-orange-500/20 transition-colors"
            >
              👥 Friends
            </button>
            
            {/* Friend Dropdown */}
            {showFriendDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-64 bg-gaming-dark border border-gaming-slate rounded-lg shadow-xl z-50 max-h-64 overflow-hidden flex flex-col"
              >
                {/* Search Input */}
                <div className="p-2 border-b border-gaming-slate">
                  <input
                    type="text"
                    value={friendSearchQuery}
                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                    placeholder="Search friends..."
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded text-white text-sm focus:border-orange-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                
                {/* Friends List */}
                <div className="overflow-y-auto flex-1">
                  {filteredFriends.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      {friendSearchQuery ? 'No friends found' : 'No friends available'}
                    </div>
                  ) : (
                    filteredFriends.map(friend => (
                      <button
                        key={friend._id}
                        type="button"
                        onClick={() => handleSelectFriend(friend)}
                        className="w-full px-3 py-2 text-left hover:bg-gaming-slate transition-colors flex items-center space-x-2"
                      >
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 font-bold text-sm">
                          {(friend.username || 'U')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">
                            {friend.username}
                          </div>
                          {friend.freeFireIgnName && (
                            <div className="text-orange-500 text-xs truncate">
                              {friend.freeFireIgnName}
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                
                {/* Close Button */}
                <div className="p-2 border-t border-gaming-slate">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFriendDropdown(false);
                      setFriendSearchQuery('');
                    }}
                    className="w-full px-3 py-1 bg-gaming-slate text-white rounded text-xs hover:bg-gaming-charcoal transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </div>
          
          {/* Remove Button */}
          {isRemovable && (
            <motion.button
              type="button"
              onClick={() => onRemove(playerNumber - 1)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/20 transition-colors"
            >
              Remove
            </motion.button>
          )}
        </div>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">IGN Name *</label>
          <input
            type="text"
            value={player.name}
            onChange={(e) => onNameChange(playerNumber - 1, e.target.value)}
            placeholder="Enter IGN name"
            className={`w-full px-3 py-2 bg-gaming-slate border rounded text-white text-sm focus:outline-none ${
              playerErrors.name 
                ? 'border-red-500 focus:border-red-500' 
                : 'border-gray-600 focus:border-orange-500'
            }`}
            required
          />
          {playerErrors.name && (
            <p className="text-red-400 text-xs mt-1">{playerErrors.name}</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Free Fire UID *</label>
          <input
            type="text"
            value={player.freeFireId}
            onChange={(e) => onUidChange(playerNumber - 1, e.target.value)}
            placeholder="Enter Free Fire UID"
            className={`w-full px-3 py-2 bg-gaming-slate border rounded text-white text-sm focus:outline-none ${
              playerErrors.freeFireId 
                ? 'border-red-500 focus:border-red-500' 
                : 'border-gray-600 focus:border-orange-500'
            }`}
            required
          />
          {playerErrors.freeFireId && (
            <p className="text-red-400 text-xs mt-1">{playerErrors.freeFireId}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default FreeFirePlayerField;
