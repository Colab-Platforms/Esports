import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { selectAuth } from '../store/slices/authSlice';
import api from '../services/api';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const ClanContext = createContext();

export const useClan = () => {
  const context = useContext(ClanContext);
  if (!context) {
    throw new Error('useClan must be used within ClanProvider');
  }
  return context;
};

export const ClanProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useSelector(selectAuth);

  // State
  const [myClan, setMyClan] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // ============================================================================
  // FETCH UNREAD COUNT
  // ============================================================================

  const fetchUnreadCount = useCallback(async (clanId, since) => {
    if (!clanId || !since) return;

    try {
      const sinceDate = new Date(since).toISOString();
      const response = await api.get(
        `/api/clans/${clanId}/unread?since=${encodeURIComponent(sinceDate)}`
      );

      if (response.success) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      console.error('❌ Error fetching unread count:', error);
    }
  }, []);

  // ============================================================================
  // FETCH USER'S CLAN
  // ============================================================================

  const fetchMyClan = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const response = await api.get('/api/clans/me/clan');

      if (response.success) {
        if (response.data && response.data.clan) {
          // User is in a clan - store the full data object
          setMyClan(response.data);

          // Store last seen timestamp
          const lastSeenAt = Date.now();
          localStorage.setItem(
            `clan_last_seen_${response.data.clan._id}`,
            lastSeenAt.toString()
          );

          // Fetch unread count
          await fetchUnreadCount(response.data.clan._id, lastSeenAt);
        } else {
          // User has no clan
          setMyClan(null);
          setUnreadCount(0);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching clan:', error);
      setMyClan(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchUnreadCount]);

  // ============================================================================
  // CLEAR UNREAD
  // ============================================================================

  const clearUnread = useCallback(() => {
    setUnreadCount(0);

    if (myClan) {
      const now = Date.now();
      localStorage.setItem(`clan_last_seen_${myClan.clan._id}`, now.toString());
    }
  }, [myClan]);

  // ============================================================================
  // REFRESH CLAN
  // ============================================================================

  const refreshMyClan = useCallback(async () => {
    if (!token) {
      setMyClan(null);
      return;
    }

    try {
      const response = await api.get('/api/clans/me/clan');

      if (response.success) {
        if (response.data && response.data.clan) {
          // User is in a clan - store the full data object
          console.log('✅ refreshMyClan: User has clan', response.data);
          setMyClan(response.data);

          // Store last seen timestamp
          const lastSeenAt = Date.now();
          localStorage.setItem(
            `clan_last_seen_${response.data.clan._id}`,
            lastSeenAt.toString()
          );

          // Fetch unread count
          await fetchUnreadCount(response.data.clan._id, lastSeenAt);
        } else {
          // User has no clan
          console.log('✅ refreshMyClan: User has no clan');
          setMyClan(null);
          setUnreadCount(0);
        }
      }
    } catch (error) {
      console.error('❌ Error refreshing clan:', error);
      setMyClan(null);
    }
  }, [token, fetchUnreadCount]);

  // ============================================================================
  // SOCKET INTEGRATION - LISTEN FOR CLAN EVENTS
  // ============================================================================

  useEffect(() => {
    const socket = getSocket();
    console.log('🔌 Socket in ClanContext:', socket ? '✅ Available' : '❌ NULL');
    if (!socket || !myClan) {
      console.log('⚠️ Socket or myClan not available for listeners');
      return;
    }

    console.log('🔌 Setting up clan socket listeners for clan:', myClan.clan._id);

    // Handle new messages
    const handleMessageNew = (data) => {
      console.log('📨 MESSAGE_NEW received:', data);
      // Only increment unread if NOT on the clan chat page
      if (!window.location.pathname.includes('/chat')) {
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          console.log('📊 Unread count updated:', prev, '→', newCount);
          return newCount;
        });
      }
    };

    // Handle role updates
    const handleRoleUpdated = (data) => {
      console.log('👤 ROLE_UPDATED received:', data);
      if (data.userId === user?._id) {
        setMyClan((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            role: data.newRole
          };
          console.log('✅ Role updated:', prev.role, '→', data.newRole);
          toast.info(`Your role has been updated to ${data.newRole}`);
          return updated;
        });
      }
    };

    // Handle member banned
    const handleMemberBanned = (data) => {
      console.log('🚫 MEMBER_BANNED received:', data);
      if (data.userId === user?._id) {
        console.log('❌ User banned from clan');
        setMyClan(null);
        setUnreadCount(0);
        localStorage.removeItem(`clan_last_seen_${data.clanId}`);
        toast.error('You have been banned from the clan');
        navigate('/clans');
      }
    };

    // Register listeners
    socket.on('MESSAGE_NEW', handleMessageNew);
    socket.on('ROLE_UPDATED', handleRoleUpdated);
    socket.on('MEMBER_BANNED', handleMemberBanned);

    console.log('✅ Clan socket listeners registered');

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up clan socket listeners');
      socket.off('MESSAGE_NEW', handleMessageNew);
      socket.off('ROLE_UPDATED', handleRoleUpdated);
      socket.off('MEMBER_BANNED', handleMemberBanned);
    };
  }, [myClan, user, navigate]);

  // ============================================================================
  // PAGE VISIBILITY API - SYNC UNREAD ON TAB FOCUS
  // ============================================================================

  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Only sync when page becomes visible
      if (document.visibilityState === 'visible' && myClan) {
        // Don't sync if user is on the clan chat page
        if (location.pathname.includes(`/clans/${myClan.clan._id}/chat`)) {
          return;
        }

        // Fetch latest unread count
        try {
          const lastSeenAt = localStorage.getItem(`clan_last_seen_${myClan.clan._id}`);
          if (lastSeenAt) {
            const sinceDate = new Date(parseInt(lastSeenAt)).toISOString();
            const response = await api.get(
              `/api/clans/${myClan.clan._id}/unread?since=${encodeURIComponent(sinceDate)}`
            );

            if (response.success) {
              setUnreadCount(response.data.count);
            }
          }
        } catch (error) {
          console.error('❌ Error syncing unread count:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [myClan, location.pathname]);

  // ============================================================================
  // INITIAL FETCH ON MOUNT
  // ============================================================================

  useEffect(() => {
    if (token && user) {
      console.log('🔄 ClanContext: Fetching clan on mount (token and user available)');
      fetchMyClan();
    } else {
      console.log('⚠️ ClanContext: No token or user, setting myClan to null');
      setMyClan(null);
      setUnreadCount(0);
    }
  }, [token, user, fetchMyClan]);

  // ============================================================================
  // VALUE
  // ============================================================================

  const value = {
    myClan,
    unreadCount,
    isLoading,
    clearUnread,
    refreshMyClan
  };

  return (
    <ClanContext.Provider value={value}>
      {children}
    </ClanContext.Provider>
  );
};

export default ClanContext;
