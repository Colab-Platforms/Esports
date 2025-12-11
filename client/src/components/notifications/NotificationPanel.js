import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiX, FiCheck, FiTrash2, FiExternalLink } from 'react-icons/fi';
import { 
  selectNotifications, 
  selectUnreadCount,
  setNotifications,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications
} from '../../store/slices/notificationSlice';
import { selectAuth } from '../../store/slices/authSlice';
import axios from 'axios';

const NotificationPanel = () => {
  const dispatch = useDispatch();
  const { token } = useSelector(selectAuth);
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Fetch notifications on mount and every 30 seconds
  useEffect(() => {
    if (token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        dispatch(setNotifications(response.data.data));
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      await axios.put(
        `${API_URL}/api/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      dispatch(markAsRead(notificationId));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      await axios.put(
        `${API_URL}/api/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      dispatch(markAllAsRead());
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleRemoveNotification = async (notificationId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      await axios.delete(`${API_URL}/api/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      dispatch(removeNotification(notificationId));
    } catch (error) {
      console.error('Error removing notification:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      await axios.delete(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      dispatch(clearAllNotifications());
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification._id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    
    setIsOpen(false);
  };

  // Filter and search notifications
  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = searchQuery === '' || 
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterType === 'all' || 
      (filterType === 'unread' && !notification.isRead) ||
      (filterType === 'read' && notification.isRead) ||
      notification.type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'friend_request': return '👥';
      case 'friend_accepted': return '✅';
      case 'challenge': return '⚔️';
      case 'tournament': return '🎮';
      case 'match': return '⚔️';
      case 'achievement': return '🏆';
      case 'system': return '⚙️';
      case 'security': return '🔒';
      default: return '📢';
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-300 hover:text-gaming-gold transition-colors duration-200 relative"
      >
        <FiBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-96 bg-gaming-card border border-gaming-border rounded-lg shadow-xl z-50 max-h-[500px] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gaming-border">
                <div className="flex items-center space-x-2">
                  <FiBell className="w-4 h-4 text-gaming-neon" />
                  <h3 className="font-semibold text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-gaming-neon hover:text-gaming-neon/80"
                      title="Mark all as read"
                    >
                      <FiCheck className="w-4 h-4" />
                    </button>
                  )}
                  
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-gray-400 hover:text-red-400"
                      title="Clear all"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="p-3 border-b border-gaming-border bg-gaming-dark/30">
                {/* Search Bar */}
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent"
                  />
                  <FiBell className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-1">
                  {['all', 'unread', 'tournament', 'match', 'system'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setFilterType(filter)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        filterType === filter
                          ? 'bg-gaming-neon text-black font-medium'
                          : 'text-gray-400 hover:text-white bg-gaming-dark'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-64 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <FiBell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No notifications yet</p>
                    <p className="text-gray-500 text-sm mt-1">
                      You'll see tournament updates here
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gaming-border">
                    {filteredNotifications.map((notification) => (
                      <div
                        key={notification._id}
                        className={`p-4 hover:bg-gaming-dark/50 transition-colors cursor-pointer ${
                          !notification.isRead ? 'bg-gaming-neon/5 border-l-2 border-l-gaming-neon' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 text-lg">
                            {getNotificationIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className={`text-sm font-medium ${
                                  !notification.isRead ? 'text-white' : 'text-gray-300'
                                }`}>
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {formatTimeAgo(notification.createdAt)}
                                </p>
                              </div>
                              
                              <div className="flex items-center space-x-1 ml-2">
                                {notification.actionUrl && (
                                  <FiExternalLink className="w-3 h-3 text-gray-500" />
                                )}
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveNotification(notification._id);
                                  }}
                                  className="text-gray-500 hover:text-red-400 p-1"
                                  title="Remove"
                                >
                                  <FiX className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-gaming-border bg-gaming-dark/30">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      // Navigate to full notifications page if exists
                    }}
                    className="w-full text-center text-sm text-gaming-neon hover:text-gaming-neon/80"
                  >
                    View All Notifications
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationPanel;