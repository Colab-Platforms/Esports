import { memo, useState } from 'react';
import { motion } from 'framer-motion';

const PlayerField = memo(({
  playerNumber,
  player,
  isRemovable,
  onNameChange,
  onUidChange,
  onRemove,
  onPlayerIdChange,
  errors,
  isOriginalMember,
  friends,
  allPlayers,
  isUnregistered
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const playerErrors = errors?.[playerNumber - 1] || {};

  // Get list of already selected player names (excluding current player)
  const selectedPlayerNames = allPlayers
    ?.map((p, idx) => idx !== playerNumber - 1 ? p.name?.toLowerCase() : null)
    .filter(Boolean) || [];

  // Filter friends based on search input and exclude already selected players
  const availableFriends = friends?.filter(friend => {
    // Don't show if already selected
    if (selectedPlayerNames.includes(friend.username?.toLowerCase())) {
      return false;
    }
    
    // If player name is empty, show all available friends
    if (!player?.name || player.name.trim() === '') {
      return true;
    }
    
    // Otherwise filter by name
    return friend.username.toLowerCase().includes(player.name.toLowerCase());
  }) || [];

  const handleFriendSelect = (friend) => {
    console.log('🎮 Friend selected:', {
      username: friend.username,
      bgmiUid: friend.bgmiUid,
      playerId: friend._id,
      playerNumber: playerNumber
    });
    onNameChange(playerNumber - 1, friend.username);
    onUidChange(playerNumber - 1, friend.bgmiUid || '');
    if (onPlayerIdChange) {
      onPlayerIdChange(playerNumber - 1, friend._id);
    }
    setShowDropdown(false);
  };

  const handleNameChange = (value) => {
    onNameChange(playerNumber - 1, value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gaming-charcoal rounded-lg p-4 border border-gaming-slate hover:border-gaming-slate/80 transition-colors"
    >
      {/* Player Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white">
          {playerNumber === 1 ? '👑 Player 1 (Team Leader)' : `👤 Player ${playerNumber}`}
        </h4>
      </div>

      {/* Input Fields - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* IGN Field - Manual Input with Dropdown Suggestion */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            IGN (In-Game Name) *
          </label>
          <div className="relative">
            <input
              type="text"
              value={player?.name || ''}
              onChange={(e) => {
                handleNameChange(e.target.value);
                if (e.target.value.trim()) {
                  setShowDropdown(true);
                }
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Enter player IGN or select from friends"
              className={`w-full px-3 py-2 bg-gaming-slate border rounded text-white text-sm focus:outline-none transition-colors pr-8 ${
                playerErrors.name
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-600 focus:border-gaming-neon'
              }`}
            />
            
            {/* Dropdown Icon - Clickable */}
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gaming-neon transition-colors p-1"
              title={showDropdown ? 'Close dropdown' : 'Open dropdown'}
            >
              <svg 
                className={`w-4 h-4 transition-transform ${
                  showDropdown ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && availableFriends.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-1 bg-gaming-slate border border-gray-600 rounded shadow-lg z-10 max-h-48 overflow-y-auto"
              >
                {availableFriends.map((friend) => (
                  <button
                    key={friend._id}
                    type="button"
                    onClick={() => handleFriendSelect(friend)}
                    className="w-full px-3 py-2 text-left text-white hover:bg-gaming-neon/20 transition-colors text-sm flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <span>{friend.bgmiIgnName || friend.username}</span>
                      {friend.bgmiUid && (
                        <p className="text-gaming-neon text-xs">UID: {friend.bgmiUid}</p>
                      )}
                      {!friend.bgmiUid && (
                        <p className="text-gray-400 text-xs">No UID set</p>
                      )}
                    </div>
                    {friend.bgmiUid && (
                      <span className="text-gaming-neon text-xs ml-2">✓</span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}

            {playerErrors.name && (
              <p className="text-red-400 text-xs mt-1">{playerErrors.name}</p>
            )}
          </div>
        </div>

        {/* UID Input */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            UID (BGMI ID) *
          </label>
          <input
            type="text"
            value={player?.bgmiId || ''}
            onChange={(e) => onUidChange(playerNumber - 1, e.target.value)}
            placeholder={player?.name ? "Enter BGMI UID" : "Select friend first"}
            disabled={!player?.name}
            className={`w-full px-3 py-2 bg-gaming-slate border rounded text-white text-sm focus:outline-none transition-colors ${
              !player?.name ? 'opacity-50 cursor-not-allowed' : 'cursor-text'
            } ${
              player?.bgmiId ? 'border-gaming-neon/50 bg-gaming-neon/5' : 'border-gray-600'
            } ${
              playerErrors.bgmiId
                ? 'border-red-500'
                : ''
            }`}
          />
          {player?.bgmiId && (
            <p className="text-gaming-neon text-xs mt-1">✓ UID set</p>
          )}
          {!player?.bgmiId && player?.name && (
            <p className="text-gray-400 text-xs mt-1">Enter BGMI UID manually</p>
          )}
          {playerErrors.bgmiId && (
            <p className="text-red-400 text-xs mt-1">{playerErrors.bgmiId}</p>
          )}
        </div>
      </div>

      {/* Unregistered Warning */}
      {isUnregistered && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-xs font-medium">
            ⚠️ This player is not registered on our platform
          </p>
          <p className="text-red-300 text-xs mt-1">
            Player must sign up before tournament registration
          </p>
        </div>
      )}

      {/* Remove Button - Bottom */}
      {playerNumber !== 1 && (
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={() => onRemove(playerNumber - 1)}
            className="px-3 py-1 bg-red-500/10 border border-red-500 text-red-400 rounded text-xs font-medium hover:bg-red-500/20 transition-colors"
            title="Remove player"
          >
            ✕ Remove
          </button>
        </div>
      )}
    </motion.div>
  );
});

PlayerField.displayName = 'PlayerField';

export default PlayerField;
