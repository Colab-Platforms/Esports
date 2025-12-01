const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, skip = 0 } = req.query;

    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch notifications',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: { notification },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to mark notification as read',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to mark all notifications as read',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete notification',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/notifications
// @desc    Delete all notifications
// @access  Private
router.delete('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    await Notification.deleteMany({ user: userId });

    res.json({
      success: true,
      message: 'All notifications deleted',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error deleting all notifications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete all notifications',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
