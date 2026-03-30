import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import api from '../services/api';
import toast from 'react-hot-toast';

/**
 * Hook to manage clan chat messages and real-time updates
 * @param {string} clanId - The clan ID
 * @returns {Object} { messages, sendMessage, typingUsers, sendTyping, loading }
 */
export const useChat = (clanId) => {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const socket = getSocket();

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!clanId) return;

      try {
        setLoading(true);
        const response = await api.get(`/api/clans/${clanId}/messages?limit=50`);
        
        if (response.success) {
          setMessages(response.data.messages || []);
        }
      } catch (error) {
        console.error('❌ Error fetching messages:', error);
        toast.error('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [clanId]);

  // Join clan socket room and listen for messages
  useEffect(() => {
    if (!socket || !clanId) return;

    // Join clan room
    socket.emit('join-clan', clanId);
    console.log(`🔌 Joined clan room: ${clanId}`);

    // Listen for new messages
    const handleNewMessage = (data) => {
      console.log('📨 New message received:', data);
      setMessages((prev) => [...prev, data]);
    };

    // Listen for typing indicators
    const handleUserTyping = (data) => {
      console.log('⌨️ User typing:', data);
      setTypingUsers((prev) => {
        if (!prev.includes(data.userId)) {
          return [...prev, data.userId];
        }
        return prev;
      });

      // Remove after 3 seconds
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
      }, 3000);
    };

    socket.on('MESSAGE_NEW', handleNewMessage);
    socket.on('USER_TYPING', handleUserTyping);

    // Cleanup
    return () => {
      socket.off('MESSAGE_NEW', handleNewMessage);
      socket.off('USER_TYPING', handleUserTyping);
      socket.emit('leave-clan', clanId);
    };
  }, [socket, clanId]);

  // Send message
  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || !clanId) return;

      try {
        // Emit via socket for real-time delivery
        if (socket) {
          socket.emit('clan-message', {
            clanId,
            content: content.trim()
          });
        }

        // Send via API for persistence
        const response = await api.post(`/api/clans/${clanId}/messages`, {
          content: content.trim()
        });

        if (response.success) {
          console.log('✅ Message sent successfully');
        }
      } catch (error) {
        console.error('❌ Error sending message:', error);
        console.error('Response:', error.response?.data);
        const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to send message';
        toast.error(errorMsg);
      }
    },
    [clanId, socket]
  );

  // Send typing indicator
  const sendTyping = useCallback(
    (isTyping) => {
      if (!socket || !clanId) return;

      socket.emit('user-typing', {
        clanId,
        isTyping
      });
    },
    [socket, clanId]
  );

  return {
    messages,
    sendMessage,
    typingUsers,
    sendTyping,
    loading
  };
};

export default useChat;
