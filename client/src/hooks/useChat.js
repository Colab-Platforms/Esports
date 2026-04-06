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
      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some(m => m._id === data._id)) return prev;
        return [...prev, data];
      });
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

    // Listen for message updates (edits)
    const handleUpdateMessage = (data) => {
      console.log('📝 Message updated:', data);
      setMessages((prev) => prev.map(m => m._id === data._id ? { ...m, ...data } : m));
    };

    // Listen for message deletions
    const handleDeleteMessage = (data) => {
      console.log('🗑️ Message deleted:', data);
      setMessages((prev) => prev.filter(m => m._id !== data.messageId));
    };

    // Listen for reactions
    const handleMessageReacted = (data) => {
      console.log('😊 Message reacted:', data);
      setMessages((prev) => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
    };

    // Listen for membership changes (kicks/bans)
    const handleMemberRemoved = (data) => {
      console.log('🚫 Member removed/banned:', data);
      // We'll let the main component handle the redirect if needed, 
      // but we update the messages list with a system message if relevant
    };

    const onConnect = () => {
      console.log('🔌 Socket reconnected, syncing messages...');
      socket.emit('join-clan', clanId);
    };

    socket.on('MESSAGE_NEW', handleNewMessage);
    socket.on('MESSAGE_UPDATED', handleUpdateMessage);
    socket.on('MESSAGE_DELETED', handleDeleteMessage);
    socket.on('MESSAGE_REACTED', handleMessageReacted);
    socket.on('MEMBER_REMOVED', handleMemberRemoved);
    socket.on('MEMBER_BANNED', handleMemberRemoved);
    socket.on('connect', onConnect);
    socket.on('USER_TYPING', handleUserTyping);

    // Cleanup
    return () => {
      socket.off('MESSAGE_NEW', handleNewMessage);
      socket.off('MESSAGE_UPDATED', handleUpdateMessage);
      socket.off('MESSAGE_DELETED', handleDeleteMessage);
      socket.off('MESSAGE_REACTED', handleMessageReacted);
      socket.off('MEMBER_REMOVED', handleMemberRemoved);
      socket.off('MEMBER_BANNED', handleMemberRemoved);
      socket.off('connect', onConnect);
      socket.off('USER_TYPING', handleUserTyping);
      socket.emit('leave-clan', clanId);
    };
  }, [socket, clanId]);

  // Send message
  const sendMessage = useCallback(
    async (content, replyToId = null) => {
      if (!content.trim() || !clanId) return;

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        _id: tempId,
        content: content.trim(),
        sender: null, // Will be filled or handled in UI
        replyTo: replyToId,
        status: 'sending',
        createdAt: new Date().toISOString(),
        seq: Infinity // Place at end
      };

      // Add optimistic message
      setMessages(prev => [...prev, optimisticMessage]);

      try {
        // Emit via socket for real-time delivery
        if (socket) {
          socket.emit('clan-message', {
            clanId,
            content: content.trim(),
            replyTo: replyToId
          });
        }

        // Send via API for persistence
        const response = await api.post(`/api/clans/${clanId}/messages`, {
          content: content.trim(),
          replyTo: replyToId
        });

        if (response.success) {
          console.log('✅ Message sent successfully');
          // Replace optimistic message with real message
          setMessages(prev => prev.map(m => m._id === tempId ? response.data.message : m));
        }
        return response;
      } catch (error) {
        console.error('❌ Error sending message:', error);
        // Mark as failed
        setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
        
        const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to send message';
        toast.error(errorMsg);
        throw error;
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

  // Edit message
  const editMessage = useCallback(
    async (messageId, newContent) => {
      if (!newContent.trim() || !clanId) return;

      try {
        const response = await api.put(`/api/clans/${clanId}/messages/${messageId}`, {
          content: newContent.trim()
        });

        if (response.success) {
          toast.success('Message updated');
          // Update local state is handled by socket, but we can do it optimistically
          setMessages(prev => prev.map(m => m._id === messageId ? { ...m, content: newContent.trim(), editedAt: new Date() } : m));
        }
        return response;
      } catch (error) {
        console.error('❌ Error editing message:', error);
        toast.error('Failed to update message');
        throw error;
      }
    },
    [clanId]
  );

  return {
    messages,
    sendMessage,
    editMessage,
    typingUsers,
    sendTyping,
    loading
  };
};

export default useChat;
