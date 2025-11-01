import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    setNotifications: (state, action) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter(n => !n.isRead).length;
      state.isLoading = false;
      state.error = null;
    },
    addNotification: (state, action) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
    },
    markAsRead: (state, action) => {
      const notificationId = action.payload;
      const notification = state.notifications.find(n => n._id === notificationId);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.isRead = true;
      });
      state.unreadCount = 0;
    },
    removeNotification: (state, action) => {
      const notificationId = action.payload;
      const notificationIndex = state.notifications.findIndex(n => n._id === notificationId);
      if (notificationIndex !== -1) {
        const notification = state.notifications[notificationIndex];
        if (!notification.isRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications.splice(notificationIndex, 1);
      }
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    updateNotification: (state, action) => {
      const updatedNotification = action.payload;
      const index = state.notifications.findIndex(n => n._id === updatedNotification._id);
      if (index !== -1) {
        const oldNotification = state.notifications[index];
        state.notifications[index] = updatedNotification;
        
        // Update unread count if read status changed
        if (oldNotification.isRead !== updatedNotification.isRead) {
          if (updatedNotification.isRead) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          } else {
            state.unreadCount += 1;
          }
        }
      }
    }
  }
});

export const {
  setLoading,
  setError,
  clearError,
  setNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  updateNotification
} = notificationSlice.actions;

// Selectors
export const selectNotifications = (state) => state.notifications.notifications;
export const selectUnreadCount = (state) => state.notifications.unreadCount;
export const selectNotificationLoading = (state) => state.notifications.isLoading;
export const selectNotificationError = (state) => state.notifications.error;

// Get unread notifications
export const selectUnreadNotifications = (state) =>
  state.notifications.notifications.filter(notification => !notification.isRead);

// Get notifications by type
export const selectNotificationsByType = (type) => (state) =>
  state.notifications.notifications.filter(notification => notification.type === type);

// Get recent notifications
export const selectRecentNotifications = (limit = 10) => (state) =>
  state.notifications.notifications.slice(0, limit);

// Check if there are unread notifications
export const selectHasUnreadNotifications = (state) => state.notifications.unreadCount > 0;

export default notificationSlice.reducer;