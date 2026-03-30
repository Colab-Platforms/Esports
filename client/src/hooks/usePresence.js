import { useState, useEffect } from 'react';
import { getSocket } from '../utils/socket';

/**
 * Hook to track online/offline presence of clan members
 * @param {string} clanId - The clan ID
 * @returns {Object} Map of userId -> 'online'|'offline'
 */
export const usePresence = (clanId) => {
  const [presence, setPresence] = useState({});
  const socket = getSocket();

  useEffect(() => {
    if (!socket || !clanId) return;

    // Listen for presence updates
    const handlePresenceUpdate = (data) => {
      console.log('👥 Presence update:', data);
      setPresence((prev) => ({
        ...prev,
        [data.userId]: data.status // 'online' or 'offline'
      }));
    };

    // Listen for initial presence list
    const handlePresenceList = (data) => {
      console.log('👥 Presence list:', data);
      setPresence(data.presence || {});
    };

    socket.on('PRESENCE_UPDATE', handlePresenceUpdate);
    socket.on('PRESENCE_LIST', handlePresenceList);

    // Request initial presence list
    socket.emit('get-presence', { clanId });

    // Cleanup
    return () => {
      socket.off('PRESENCE_UPDATE', handlePresenceUpdate);
      socket.off('PRESENCE_LIST', handlePresenceList);
    };
  }, [socket, clanId]);

  return presence;
};

export default usePresence;
