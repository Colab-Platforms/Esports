import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FiX, FiCheck, FiAlertCircle, FiUser } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

const GAME_FILTERS = [
  { key: 'all', label: '🎮 All' },
  { key: 'bgmi', label: '🟡 BGMI' },
  { key: 'freefire', label: '🔴 Free Fire' },
];

const GAME_BADGE = {
  bgmi: { label: 'BGMI', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' },
  freefire: { label: 'Free Fire', color: 'bg-red-500/20 text-red-400 border border-red-500/40' },
  all: { label: 'All Games', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/40' },
};

// Extract UID from profile based on game type
const getUidFromProfile = (profile, game) => {
  if (!profile) return '';
  if (game === 'bgmi')     return profile.gameIds?.bgmi?.uid     || profile.bgmiUid     || '';
  if (game === 'freefire') return profile.gameIds?.freefire?.uid || profile.freeFireUid || '';
  return '';
};

const StorePage = () => {
  const navigate = useNavigate();
  const [gameFilter, setGameFilter] = useState('all');
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  // Modal states
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalState, setModalState] = useState(null); // 'uid_missing' | 'confirm'
  const [playerID, setPlayerID] = useState('');
  const [claiming, setClaiming] = useState(false);

  const [claims, setClaims] = useState([]);
  const [storeItems, setStoreItems] = useState([]);

  useEffect(() => {
    fetchWallet();
    fetchStoreItems();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/users/me');
      if (response.success) setUserProfile(response.data.user);
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
  };

  const fetchStoreItems = async () => {
    try {
      const response = await api.get('/api/store');
      setStoreItems(response.success ? response.data.items : []);
    } catch (error) {
      console.error('Error fetching store items:', error);
      setStoreItems([]);
    }
  };

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/wallet');
      if (response.success) setWallet(response.data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  // Main claim button handler — detects game, checks UID
  const handleClaimItem = (item) => {
    setSelectedItem(item);
    setPlayerID('');

    // For game-specific items, auto-detect UID from profile
    if (item.game === 'bgmi' || item.game === 'freefire') {
      const uid = getUidFromProfile(userProfile, item.game);
      if (!uid) {
        setModalState('uid_missing');
      } else {
        setPlayerID(uid);
        setModalState('confirm');
      }
    } else {
      // 'all' items — let user type their ID
      setModalState('confirm');
    }
  };

  const handleCloseModal = () => {
    setModalState(null);
    setSelectedItem(null);
    setPlayerID('');
  };

  const handleConfirmClaim = async () => {
    if (!playerID.trim()) {
      toast.error('Please enter your Player ID');
      return;
    }
    if ((wallet?.balance || 0) < selectedItem.price) {
      toast.error('Insufficient coins');
      return;
    }
    try {
      setClaiming(true);
      const response = await api.post(`/api/store/buy/${selectedItem._id}`, { playerID });
      if (response.success) {
        setClaims(prev => [{
          id: Date.now(),
          item: selectedItem,
          playerID,
          timestamp: new Date(),
          coins: selectedItem.price
        }, ...prev]);
        setWallet(prev => ({ ...prev, balance: response.data.newBalance }));
        toast.success(`✅ ${selectedItem.name} claimed for ${playerID}!`);
        handleCloseModal();
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to claim item');
    } finally {
      setClaiming(false);
    }
  };

  const currentItems = (storeItems || []).filter(
    item => gameFilter === 'all' || item.game === gameFilter || item.game === 'all'
  );

  return (
    <div className="min-h-screen bg-theme-bg-primary py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-theme-text-primary mb-2">
              🛍️ Colab Store
            </h1>
            <p className="text-theme-text-secondary">
              Redeem your Colab Coins for exclusive items
            </p>
          </div>

          {/* Right Section - Balance + Orders Link */}
          <div className="flex flex-col gap-4 items-end">
            {/* Balance Display */}
            <div className="bg-theme-bg-card border border-theme-border rounded-lg p-6">
              <p className="text-theme-text-muted text-sm mb-2">Your Balance</p>
              <p className="text-3xl font-bold text-theme-accent">
                {wallet?.balance || 0} CC
              </p>
            </div>
            
            {/* Orders Link */}
            <button
              onClick={() => navigate('/store/orders')}
              className="px-6 py-2 bg-gaming-gold text-black rounded-lg font-semibold hover:bg-yellow-500 transition-all"
            >
              📦 My Orders
            </button>
          </div>
        </div>

        {/* Game Filter Tabs */}
        <div className="flex gap-2 mb-8">
          {GAME_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setGameFilter(f.key)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                gameFilter === f.key
                  ? 'bg-gaming-gold text-black'
                  : 'bg-gaming-charcoal text-gaming-gold hover:bg-gaming-dark border border-gaming-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="text-center py-12 text-theme-text-secondary">Loading items...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {currentItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-theme-bg-card border-2 rounded-lg p-6 transition-all ${
                  item.featured
                    ? 'border-theme-accent shadow-lg shadow-theme-accent/20'
                    : 'border-theme-border hover:border-theme-accent/50'
                }`}
              >
                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {/* Game badge */}
                  {item.game && GAME_BADGE[item.game] && (
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${GAME_BADGE[item.game].color}`}>
                      {GAME_BADGE[item.game].label}
                    </span>
                  )}
                  {item.metadata?.featured && (
                    <span className="px-3 py-1 bg-theme-accent/20 text-theme-accent text-xs font-bold rounded">
                      ⭐ Featured
                    </span>
                  )}
                  {item.metadata?.badge && (
                    <span className={`px-3 py-1 text-xs font-bold rounded ${
                      item.metadata.badge === 'Best Value'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {item.metadata.badge === 'Best Value' ? '💰' : '🔥'} {item.metadata.badge}
                    </span>
                  )}
                </div>

                {/* Item Info */}
                <h3 className="text-xl font-bold text-theme-text-primary mb-2">
                  {item.name}
                </h3>
                <p className="text-theme-text-secondary text-sm mb-4">
                  {item.description || item.metadata?.type || 'Store Item'}
                </p>

                {/* Price */}
                <div className="flex items-center justify-between pt-4 border-t border-theme-border">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-theme-accent">
                      {item.price}
                    </span>
                    <span className="text-theme-text-muted">CC</span>
                  </div>

                  <button
                    onClick={() => handleClaimItem(item)}
                    disabled={(wallet?.balance || 0) < item.price}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      (wallet?.balance || 0) < item.price
                        ? 'bg-theme-bg-hover text-theme-text-muted cursor-not-allowed'
                        : 'bg-theme-accent text-black hover:bg-theme-accent/80'
                    }`}
                  >
                    Claim
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Claims Tracker */}
        {claims.length > 0 && (
          <div className="bg-theme-bg-card border border-theme-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-theme-text-primary mb-4">
              📋 Claims Tracker (Session)
            </h2>
            <div className="space-y-3">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between p-4 bg-theme-bg-hover rounded-lg"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <FiCheck className="text-green-400 w-5 h-5" />
                    <div>
                      <p className="font-semibold text-theme-text-primary">
                        {claim.item.name}
                      </p>
                      <p className="text-sm text-theme-text-secondary">
                        Player ID: {claim.playerID}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-theme-accent">-{claim.coins} CC</p>
                    <p className="text-xs text-theme-text-muted">
                      {claim.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Claim Modal */}
      <AnimatePresence>
        {modalState && selectedItem && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-theme-bg-card border border-theme-border rounded-lg max-w-md w-full p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-theme-text-primary">
                  {modalState === 'uid_missing' ? '⚠️ UID Not Set' : 'Claim Item'}
                </h2>
                <button onClick={handleCloseModal} className="text-theme-text-secondary hover:text-theme-text-primary">
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              {/* Item summary */}
              <div className="bg-theme-bg-hover rounded-lg p-4 mb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold text-theme-text-primary">{selectedItem.name}</p>
                    {selectedItem.game && GAME_BADGE[selectedItem.game] && (
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold rounded ${GAME_BADGE[selectedItem.game].color}`}>
                        {GAME_BADGE[selectedItem.game].label}
                      </span>
                    )}
                  </div>
                  <span className="text-2xl font-bold text-theme-accent">{selectedItem.price} CC</span>
                </div>
              </div>

              {/* UID Missing state */}
              {modalState === 'uid_missing' && (
                <>
                  <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-5">
                    <FiAlertCircle className="text-red-400 w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-red-400 font-semibold text-sm mb-1">
                        {selectedItem.game === 'bgmi' ? 'BGMI UID not set' : 'Free Fire UID not set'}
                      </p>
                      <p className="text-theme-text-secondary text-sm">
                        You need to set your {selectedItem.game === 'bgmi' ? 'BGMI' : 'Free Fire'} UID in your profile before claiming this item.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-theme-bg-hover text-theme-text-primary rounded-lg font-semibold hover:bg-theme-border transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={() => navigate('/profile/settings', { state: { activeTab: 'gameids' } })}
                      className="flex-1 px-4 py-2 bg-theme-accent text-black rounded-lg font-semibold hover:bg-theme-accent/80 transition-colors flex items-center justify-center gap-2"
                    >
                      <FiUser className="w-4 h-4" />
                      Go to Profile
                    </button>
                  </div>
                </>
              )}

              {/* Confirm state */}
              {modalState === 'confirm' && (
                <>
                  {/* UID field */}
                  <div className="mb-5">
                    <label className="block text-theme-text-secondary text-sm mb-2">
                      {selectedItem.game === 'bgmi' ? 'BGMI UID' : selectedItem.game === 'freefire' ? 'Free Fire UID' : 'Player ID (UID)'}
                    </label>
                    <input
                      type="text"
                      value={playerID}
                      onChange={(e) => setPlayerID(e.target.value)}
                      readOnly={selectedItem.game === 'bgmi' || selectedItem.game === 'freefire'}
                      placeholder="Your in-game UID"
                      className={`w-full px-4 py-2 border rounded-lg text-black focus:outline-none focus:border-theme-accent ${
                        selectedItem.game === 'bgmi' || selectedItem.game === 'freefire'
                          ? 'bg-theme-bg-hover/50 border-theme-border cursor-not-allowed opacity-80'
                          : 'bg-theme-bg-hover border-theme-border'
                      }`}
                    />
                    {(selectedItem.game === 'bgmi' || selectedItem.game === 'freefire') && (
                      <p className="text-xs text-theme-text-muted mt-1 flex items-center gap-1">
                        <FiCheck className="text-green-400 w-3 h-3" />
                        Auto-filled from your profile
                      </p>
                    )}
                  </div>

                  {/* Insufficient balance warning */}
                  {(wallet?.balance || 0) < selectedItem.price && (
                    <div className="mb-5 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                      <p className="text-red-400 text-sm">
                        ❌ Insufficient coins. You need {selectedItem.price - (wallet?.balance || 0)} more CC.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-theme-bg-hover text-theme-text-primary rounded-lg font-semibold hover:bg-theme-border transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmClaim}
                      disabled={claiming || (wallet?.balance || 0) < selectedItem.price}
                      className="flex-1 px-4 py-2 bg-theme-accent text-black rounded-lg font-semibold hover:bg-theme-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {claiming ? (
                        <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> Claiming...</>
                      ) : (
                        <><FiCheck className="w-4 h-4" /> Confirm Claim</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StorePage;
