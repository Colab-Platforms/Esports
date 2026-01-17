import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FriendListModal = ({
  isOpen,
  friends,
  loading,
  onSelectFriend,
  onClose,
  currentTeamMembers
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter friends based on search query and exclude already selected members
  const filteredFriends = useMemo(() => {
    if (!friends) return [];
    
    const selectedUsernames = currentTeamMembers?.map(m => m.name.toLowerCase()) || [];
    
    return friends.filter(friend => {
      const matchesSearch = friend.username?.toLowerCase().includes(searchQuery.toLowerCase());
      const isNotSelected = !selectedUsernames.includes(friend.username?.toLowerCase());
      return matchesSearch && isNotSelected;
    });
  }, [friends, searchQuery, currentTeamMembers]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gaming-dark border border-gaming-slate rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gaming-dark border-b border-gaming-slate p-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Select Friend</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="p-4 border-b border-gaming-slate">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends..."
              className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded text-white text-sm focus:border-gaming-neon focus:outline-none"
            />
          </div>

          {/* Friends List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gaming-neon mx-auto mb-2"></div>
                  <p className="text-gray-400 text-sm">Loading friends...</p>
                </div>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <p className="text-gray-400 text-sm">
                    {friends?.length === 0 ? 'No friends yet' : 'No matching friends'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredFriends.map((friend) => (
                  <motion.button
                    key={friend._id}
                    type="button"
                    onClick={() => {
                      onSelectFriend(friend);
                      setSearchQuery('');
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full p-3 bg-gaming-charcoal border border-gaming-slate rounded hover:border-gaming-neon/50 hover:bg-gaming-slate transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 bg-gaming-neon/20 rounded-full flex items-center justify-center flex-shrink-0">
                        {friend.profilePicture ? (
                          <img
                            src={friend.profilePicture}
                            alt={friend.username}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-gaming-neon font-bold text-sm">
                            {friend.username?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Friend Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">
                          {friend.username}
                        </h4>
                        {friend.bgmiUid && (
                          <p className="text-gaming-neon text-xs">
                            UID: {friend.bgmiUid}
                          </p>
                        )}
                      </div>

                      {/* Status Indicator */}
                      {friend.bgmiUid ? (
                        <div className="text-gaming-neon text-xs font-medium">✓</div>
                      ) : (
                        <div className="text-gray-500 text-xs">○</div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="bg-gaming-charcoal border-t border-gaming-slate p-3 text-xs text-gray-400">
            <p>✓ = Has BGMI UID set</p>
            <p>○ = No BGMI UID (you'll need to enter it)</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FriendListModal;
