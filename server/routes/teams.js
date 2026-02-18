const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const TeamInvitation = require('../models/TeamInvitation');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST /api/teams
// @desc    Create a new team
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, tag, game, logo, description, maxMembers, privacy, memberIds } = req.body;
    const userId = req.user.userId;
    const redisService = require('../services/redisService');

    const members = [{
      userId,
      role: 'captain',
      joinedAt: new Date()
    }];

    if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
      const effectiveMax = maxMembers || 5;
      if (memberIds.length + 1 > effectiveMax) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_MEMBERS',
            message: `Cannot add ${memberIds.length} members. Max team size is ${effectiveMax} (including captain).`,
            timestamp: new Date().toISOString()
          }
        });
      }

      const users = await User.find({ _id: { $in: memberIds } });
      if (users.length !== memberIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MEMBERS',
            message: 'One or more selected users do not exist',
            timestamp: new Date().toISOString()
          }
        });
      }

      for (const memberId of memberIds) {
        if (memberId.toString() === userId.toString()) continue;
        members.push({
          userId: memberId,
          role: 'member',
          joinedAt: new Date()
        });
      }
    }

    const team = new Team({
      name,
      tag,
      game,
      logo,
      description,
      captain: userId,
      members,
      maxMembers: maxMembers || 5,
      privacy: privacy || 'public'
    });

    await team.save();
    await team.populate('captain', 'username avatarUrl gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid');
    await team.populate('members.userId', 'username avatarUrl gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid');

    const cacheKeysToDelete = [`teams:v2:my-teams:${userId}`];
    if (memberIds && Array.isArray(memberIds)) {
      for (const mid of memberIds) {
        cacheKeysToDelete.push(`teams:v2:my-teams:${mid}`);
      }
    }
    await Promise.all(cacheKeysToDelete.map(k => redisService.delete(k)));

    res.status(201).json({
      success: true,
      data: { team },
      message: 'Team created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to create team',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/teams
// @desc    Get all public teams
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { game, search } = req.query;
    
    const query = { isActive: true, privacy: 'public' };
    
    if (game) {
      query.game = game;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tag: { $regex: search, $options: 'i' } }
      ];
    }

    const teams = await Team.find(query)
      .populate('captain', 'username avatarUrl')
      .populate('members.userId', 'username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: { teams },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch teams',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/teams/my-teams
// @desc    Get user's teams
// @access  Private
router.get('/my-teams', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const redisService = require('../services/redisService');

    // Create cache key
    const cacheKey = `teams:v2:my-teams:${userId}`;

    if (!req.query.fresh) {
      const cachedData = await redisService.get(cacheKey);
      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    const teams = await Team.find({
      'members.userId': userId,
      isActive: true
    })
      .populate('captain', 'username avatarUrl gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid')
      .populate('members.userId', 'username avatarUrl gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid')
      .sort({ createdAt: -1 });

    console.log(`Found ${teams.length} teams for user ${userId}`);
    teams.forEach(team => {
      console.log(`   Team: ${team.name}, Captain ID: ${team.captain?._id}, Captain Username: ${team.captain?.username}`);
    });

    const responseData = { teams };

    // Cache for 5 minutes
    await redisService.set(cacheKey, responseData, 300);

    res.json({
      success: true,
      data: responseData,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching user teams:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch teams',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/teams/:id
// @desc    Get team details
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('captain', 'username avatarUrl level')
      .populate('members.userId', 'username avatarUrl level');

    if (!team) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: { team },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch team',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/teams/:id
// @desc    Update team (captain only)
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is captain
    if (!team.isCaptain(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_CAPTAIN',
          message: 'Only team captain can update team',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { name, memberIds } = req.body;
    
    if (name) team.name = name;

    if (memberIds && Array.isArray(memberIds)) {
      const captainId = team.captain.toString();
      const currentMemberIds = team.members.map(m => (m.userId?._id || m.userId).toString());
      const newMemberIds = [captainId, ...memberIds.filter(id => id !== captainId)];

      const removedIds = currentMemberIds.filter(id => !newMemberIds.includes(id));
      const addedIds = newMemberIds.filter(id => !currentMemberIds.includes(id));

      team.members = team.members.filter(m => {
        const mid = (m.userId?._id || m.userId).toString();
        return newMemberIds.includes(mid);
      });

      for (const addId of addedIds) {
        team.members.push({ userId: addId, role: 'member', joinedAt: new Date() });
      }

      team.maxMembers = Math.max(team.maxMembers, team.members.length);

      const redisService = require('../services/redisService');
      for (const rid of removedIds) {
        await redisService.delete(`teams:v2:my-teams:${rid}`);
      }
    }

    await team.save();
    await team.populate('captain', 'username avatarUrl gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid');
    await team.populate('members.userId', 'username avatarUrl gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid');

    const redisService = require('../services/redisService');
    const allMemberIds = team.members.map(m => m.userId?._id || m.userId).filter(Boolean);
    
    for (const memberId of allMemberIds) {
      await redisService.delete(`teams:v2:my-teams:${memberId}`);
    }

    res.json({
      success: true,
      data: { team },
      message: 'Team updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to update team',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/teams/:id
// @desc    Delete team (captain only)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is captain
    if (!team.isCaptain(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_CAPTAIN',
          message: 'Only team captain can delete team',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Block deletion if the team is registered in any active/ongoing tournament
    const TournamentRegistration = require('../models/TournamentRegistration');
    const Tournament = require('../models/Tournament');
    const activeRegistration = await TournamentRegistration.findOne({
      teamId: team._id,
      status: { $in: ['pending', 'images_uploaded', 'verified'] }
    }).populate('tournamentId', 'name status');

    if (activeRegistration) {
      const t = activeRegistration.tournamentId;
      const isOver = t && ['completed', 'cancelled', 'inactive'].includes(t.status);
      if (!isOver) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TEAM_IN_ACTIVE_TOURNAMENT',
            message: t
              ? `This team is registered in an active tournament "${t.name}". You can only delete the team after the tournament ends.`
              : 'This team is registered in an active tournament. You can only delete the team after the tournament ends.',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Collect all member IDs before deactivating (for cache invalidation)
    const allMemberIds = team.members
      .map(m => (m.userId?._id || m.userId)?.toString())
      .filter(Boolean);

    team.isActive = false;
    await team.save();

    // Invalidate Redis cache for captain and all members
    const redisService = require('../services/redisService');
    const captainId = (team.captain?._id || team.captain)?.toString();
    const cacheKeysToDelete = new Set(allMemberIds.map(id => `teams:v2:my-teams:${id}`));
    if (captainId) cacheKeysToDelete.add(`teams:v2:my-teams:${captainId}`);
    await Promise.all([...cacheKeysToDelete].map(k => redisService.delete(k)));

    res.json({
      success: true,
      message: 'Team deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete team',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/teams/:id/leave
// @desc    Leave team
// @access  Private
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Captain cannot leave, must delete team or transfer captaincy
    if (team.isCaptain(req.user.userId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CAPTAIN_CANNOT_LEAVE',
          message: 'Captain cannot leave team. Delete team or transfer captaincy first.',
          timestamp: new Date().toISOString()
        }
      });
    }

    team.removeMember(req.user.userId);
    await team.save();

    // Invalidate cache for the user who left
    const redisService = require('../services/redisService');
    await redisService.delete(`teams:v2:my-teams:${req.user.userId}`);

    res.json({
      success: true,
      message: 'Left team successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error leaving team:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to leave team',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/teams/:id/invite
// @desc    Invite player to team (captain only)
// @access  Private
router.post('/:id/invite', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('📨 Invite request:', {
      teamId: req.params.id,
      invitedUserId: userId,
      invitedBy: req.user.userId
    });

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('👥 Team captain:', team.captain, 'Current user:', req.user.userId);

    // Check if user is captain
    if (!team.isCaptain(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_CAPTAIN',
          message: 'Only team captain can invite players',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TEAM_FULL',
          message: 'Team is full',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is already a member
    if (team.isMember(userId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_MEMBER',
          message: 'User is already a team member',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if invitation already exists
    const existingInvitation = await TeamInvitation.findOne({
      teamId: team._id,
      invitedUser: userId,
      status: 'pending'
    });

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVITATION_EXISTS',
          message: 'Invitation already sent',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create invitation
    const invitation = new TeamInvitation({
      teamId: team._id,
      invitedBy: req.user.userId,
      invitedUser: userId
    });

    await invitation.save();
    await invitation.populate('teamId', 'name tag game logo');
    await invitation.populate('invitedBy', 'username avatarUrl');

    // Create notification for invited user
    const Notification = require('../models/Notification');
    const invitedUserData = await User.findById(userId).select('username');
    const invitingUserData = await User.findById(req.user.userId).select('username');
    
    const notification = new Notification({
      user: userId,
      type: 'team_invitation',
      title: 'Team Invitation',
      message: `${invitingUserData.username} invited you to join ${team.name}`,
      actionUrl: `/teams?tab=teams`,
      isRead: false,
      metadata: {
        teamId: team._id,
        teamName: team.name,
        invitedBy: req.user.userId,
        invitationId: invitation._id
      }
    });

    await notification.save();

    console.log(`📬 Notification created for user ${userId} about team invitation`);

    res.status(201).json({
      success: true,
      data: { invitation },
      message: 'Invitation sent successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to send invitation',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/teams/invitations
// @desc    Get user's team invitations
// @access  Private
router.get('/invitations/my-invitations', auth, async (req, res) => {
  try {
    const redisService = require('../services/redisService');
    const cacheKey = `teams:invitations:${req.user.userId}`;

    // Try to get from cache
    const cachedData = await redisService.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for key: ${cacheKey}`);
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    const invitations = await TeamInvitation.find({
      invitedUser: req.user.userId,
      status: 'pending'
    })
      .populate('teamId', 'name tag game logo maxMembers')
      .populate('invitedBy', 'username avatarUrl')
      .sort({ createdAt: -1 });

    // Filter out expired invitations
    const validInvitations = invitations.filter(inv => !inv.isExpired());

    const responseData = { invitations: validInvitations };

    // Cache for 2 minutes (invitations change frequently)
    await redisService.set(cacheKey, responseData, 120);

    res.json({
      success: true,
      data: responseData,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch invitations',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/teams/invitations/:id/accept
// @desc    Accept team invitation
// @access  Private
router.post('/invitations/:id/accept', auth, async (req, res) => {
  try {
    const redisService = require('../services/redisService');
    const invitation = await TeamInvitation.findById(req.params.id)
      .populate('teamId');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Invitation not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if invitation is for this user
    if (invitation.invitedUser.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_YOUR_INVITATION',
          message: 'This invitation is not for you',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVITATION_NOT_PENDING',
          message: 'Invitation is no longer pending',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if expired
    if (invitation.isExpired()) {
      invitation.status = 'expired';
      await invitation.save();
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVITATION_EXPIRED',
          message: 'Invitation has expired',
          timestamp: new Date().toISOString()
        }
      });
    }

    const team = invitation.teamId;

    // Add user to team
    team.addMember(req.user.userId);
    await team.save();

    // Update invitation status
    invitation.status = 'accepted';
    await invitation.save();

    // Invalidate cache for the user
    await redisService.delete(`teams:v2:my-teams:${req.user.userId}`);
    await redisService.delete(`teams:invitations:${req.user.userId}`);

    res.json({
      success: true,
      message: 'Joined team successfully',
      data: { team },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to accept invitation',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/teams/invitations/:id/reject
// @desc    Reject team invitation
// @access  Private
router.post('/invitations/:id/reject', auth, async (req, res) => {
  try {
    const redisService = require('../services/redisService');
    const invitation = await TeamInvitation.findById(req.params.id);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Invitation not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if invitation is for this user
    if (invitation.invitedUser.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_YOUR_INVITATION',
          message: 'This invitation is not for you',
          timestamp: new Date().toISOString()
        }
      });
    }

    invitation.status = 'rejected';
    await invitation.save();

    // Invalidate cache
    await redisService.delete(`teams:invitations:${req.user.userId}`);

    res.json({
      success: true,
      message: 'Invitation rejected',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error rejecting invitation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to reject invitation',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/teams/:id/remove-member
// @desc    Remove a member from team (captain only)
// @access  Private
router.post('/:id/remove-member', auth, async (req, res) => {
  try {
    const { memberId } = req.body;
    const captainId = req.user.userId;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_MEMBER_ID',
          message: 'Member ID is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is captain
    if (team.captain.toString() !== captainId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_CAPTAIN',
          message: 'Only team captain can remove members',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Cannot remove captain
    if (memberId === captainId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_REMOVE_CAPTAIN',
          message: 'Cannot remove team captain',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Remove member
    team.removeMember(memberId);
    await team.save();
    await team.populate('captain', 'username avatarUrl');
    await team.populate('members.userId', 'username avatarUrl');

    // Invalidate cache for both the removed member and the team captain
    const redisService = require('../services/redisService');
    await redisService.delete(`teams:v2:my-teams:${memberId}`);
    await redisService.delete(`teams:v2:my-teams:${captainId}`);

    console.log(`✅ Member ${memberId} removed from team ${team.name}`);

    res.json({
      success: true,
      message: 'Member removed successfully',
      data: { team },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to remove member',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/teams/:id/add-member
// @desc    Add a member to team directly (captain only)
// @access  Private
router.post('/:id/add-member', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const captainId = req.user.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is captain
    if (team.captain.toString() !== captainId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_CAPTAIN',
          message: 'Only team captain can add members',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TEAM_FULL',
          message: 'Team is full',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is already a member
    if (team.isMember(userId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_MEMBER',
          message: 'User is already a team member',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user exists
    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Add member
    team.addMember(userId);
    await team.save();
    await team.populate('captain', 'username avatarUrl');
    await team.populate('members.userId', 'username avatarUrl');

    // Invalidate cache for the added member
    const redisService = require('../services/redisService');
    await redisService.delete(`teams:v2:my-teams:${userId}`);

    console.log(`✅ Member ${userId} added to team ${team.name}`);

    res.json({
      success: true,
      message: 'Member added successfully',
      data: { team },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add member',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
