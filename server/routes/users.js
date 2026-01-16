const express = require('express');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/me
// @desc    Get current user's full profile data
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ User data fetched for:', user.username, {
      steamId: user.gameIds?.steam,
      isConnected: user.steamProfile?.isConnected
    });

    res.json({
      success: true,
      data: { user },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching user data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch user data',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/users/count
// @desc    Get total users count
// @access  Public
router.get('/count', async (req, res) => {
  try {
    const count = await User.countDocuments({ isActive: true });
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error fetching user count:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/players
// @desc    Get all players with search and filter
// @access  Private
router.get('/players', auth, async (req, res) => {
  try {
    const { search, game } = req.query;
    const currentUserId = req.user.userId;

    let query = { _id: { $ne: currentUserId }, isActive: true };

    // Global search - search in username, email, bio, country
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by favorite game
    if (game) {
      query.favoriteGame = game;
    }

    const players = await User.find(query)
      .select('username email avatarUrl level currentRank tournamentsWon favoriteGame bio country friends games')
      .limit(50)
      .lean();
    
    console.log(`📊 Found ${players.length} players for user ${currentUserId}`);

    // Check friend request status for each player
    const FriendRequest = require('../models/FriendRequest');
    const playersWithStats = await Promise.all(players.map(async (player) => {
      // Check if already friends - ensure friends is an array
      const friendsArray = Array.isArray(player.friends) ? player.friends : [];
      const isFriend = friendsArray.some(
        friendId => friendId.toString() === currentUserId
      );

      // Check if friend request already sent
      const existingRequest = await FriendRequest.findOne({
        sender: currentUserId,
        recipient: player._id,
        status: 'pending'
      });

      console.log(`👤 Player: ${player.username}, friends: ${friendsArray.length}, isFriend: ${isFriend}, requestSent: ${!!existingRequest}`);

      return {
        _id: player._id, // Use _id instead of id for consistency
        id: player._id,
        username: player.username,
        email: player.email,
        avatarUrl: player.avatarUrl,
        level: player.level,
        currentRank: player.currentRank,
        tournamentsWon: player.tournamentsWon,
        favoriteGame: player.favoriteGame,
        bio: player.bio,
        country: player.country,
        winRate: Math.floor(Math.random() * 40) + 30, // Mock win rate
        friendRequestSent: !!existingRequest,
        isFriend: isFriend,
        games: player.games || (player.favoriteGame ? [player.favoriteGame] : []), // Use games array from DB
        wins: player.tournamentsWon || 0,
        rank: player.currentRank || 'Unranked'
      };
    }));

    res.json({
      success: true,
      data: { players: playersWithStats },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching players:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch players',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/users/friend-request
// @desc    Send friend request
// @access  Private
router.post('/friend-request', auth, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user.userId;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_RECIPIENT',
          message: 'Recipient ID is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (senderId === recipientId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Cannot send friend request to yourself',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Recipient not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if already friends
    const sender = await User.findById(senderId);
    if (sender.friends.includes(recipientId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_FRIENDS',
          message: 'You are already friends with this user',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if request already exists
    const existingRequest = await FriendRequest.findOne({
      sender: senderId,
      recipient: recipientId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REQUEST_EXISTS',
          message: 'Friend request already sent',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create friend request
    const friendRequest = new FriendRequest({
      sender: senderId,
      recipient: recipientId,
      status: 'pending'
    });

    await friendRequest.save();

    // Create notification for recipient
    const Notification = require('../models/Notification');
    const notification = new Notification({
      user: recipientId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${sender.username} sent you a friend request`,
      actionUrl: '/profile?tab=teams&subtab=requests',
      isRead: false
    });

    await notification.save();

    console.log(`📨 Friend request from ${sender.username} to ${recipient.username}`);

    res.json({
      success: true,
      message: 'Friend request sent successfully',
      data: {
        requestId: friendRequest._id
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error sending friend request:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to send friend request',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/users/challenge
// @desc    Send game challenge (Deprecated - use /api/challenges instead)
// @access  Private
router.post('/challenge', auth, async (req, res) => {
  try {
    const { opponentId, game } = req.body;
    
    // Redirect to new challenges API
    return res.status(301).json({
      success: false,
      error: {
        code: 'DEPRECATED',
        message: 'This endpoint is deprecated. Please use POST /api/challenges instead',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error sending challenge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to send challenge',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/users/friends
// @desc    Get user's friends list
// @access  Private
router.get('/friends', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { search } = req.query;

    const user = await User.findById(userId).populate('friends', 'username email avatarUrl level currentRank tournamentsWon favoriteGame bio country');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    let friends = user.friends || [];

    // Filter by search if provided
    if (search) {
      friends = friends.filter(friend => 
        friend.username.toLowerCase().includes(search.toLowerCase())
      );
    }

    const formattedFriends = friends.map(friend => ({
      _id: friend._id, // Use _id for consistency
      id: friend._id, // Keep id for backward compatibility
      username: friend.username,
      email: friend.email,
      avatarUrl: friend.avatarUrl,
      level: friend.level,
      currentRank: friend.currentRank,
      tournamentsWon: friend.tournamentsWon,
      favoriteGame: friend.favoriteGame,
      bio: friend.bio,
      country: friend.country,
      winRate: Math.floor(Math.random() * 40) + 30, // Mock win rate
      isFriend: true
    }));

    res.json({
      success: true,
      data: { friends: formattedFriends },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching friends:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch friends',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/users/friend-requests
// @desc    Get friend requests
// @access  Private
router.get('/friend-requests', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const requests = await FriendRequest.find({
      recipient: userId,
      status: 'pending'
    })
    .populate('sender', 'username email avatarUrl level currentRank')
    .sort({ createdAt: -1 });

    const formattedRequests = requests.map(req => ({
      id: req._id,
      sender: {
        id: req.sender._id,
        username: req.sender.username,
        email: req.sender.email,
        avatarUrl: req.sender.avatarUrl,
        level: req.sender.level,
        currentRank: req.sender.currentRank
      },
      createdAt: req.createdAt.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      }),
      message: req.message
    }));

    res.json({
      success: true,
      data: { requests: formattedRequests },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching friend requests:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch friend requests',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/users/friend-request/:requestId/accept
// @desc    Accept friend request
// @access  Private
router.post('/friend-request/:requestId/accept', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Friend request not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (friendRequest.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to accept this request',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'This request has already been processed',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update request status
    friendRequest.status = 'accepted';
    await friendRequest.save();

    // Add to friends list
    await User.findByIdAndUpdate(userId, {
      $addToSet: { friends: friendRequest.sender }
    });

    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: userId }
    });

    console.log(`✅ Friend request accepted: ${friendRequest.sender} <-> ${userId}`);

    res.json({
      success: true,
      message: 'Friend request accepted',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error accepting friend request:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to accept friend request',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/users/friend-request/:requestId/reject
// @desc    Reject friend request
// @access  Private
router.post('/friend-request/:requestId/reject', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Friend request not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (friendRequest.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to reject this request',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update request status
    friendRequest.status = 'rejected';
    await friendRequest.save();

    console.log(`❌ Friend request rejected: ${friendRequest.sender} -> ${userId}`);

    res.json({
      success: true,
      message: 'Friend request rejected',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error rejecting friend request:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to reject friend request',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/users/players/public
// @desc    Get all players (public - no auth required)
// @access  Public
router.get('/players/public', async (req, res) => {
  try {
    const { search, game } = req.query;

    let query = {};  // Remove isActive filter - show all users

    // Global search - search in username, email, bio, country
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by game (check in games array)
    if (game && game !== 'all') {
      query.games = game;
    }

    console.log('🔍 Public players query:', query);

    const players = await User.find(query)
      .select('username email avatarUrl level currentRank tournamentsWon favoriteGame games bio country createdAt')
      .limit(50)
      .lean();
    
    console.log(`✅ Found ${players.length} players`);

    // Format response
    const formattedPlayers = players.map(player => ({
      _id: player._id,
      username: player.username,
      email: player.email,
      avatar: player.avatarUrl,
      level: player.level || 1,
      rank: player.currentRank || 'Unranked',
      wins: player.tournamentsWon || 0,
      games: player.games || [],
      favoriteGame: player.favoriteGame,
      bio: player.bio,
      country: player.country,
      joinedAt: player.createdAt
    }));

    res.json({
      success: true,
      data: {
        players: formattedPlayers,
        total: formattedPlayers.length
      }
    });
  } catch (error) {
    console.error('Error fetching public players:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch players',
        code: 'SERVER_ERROR'
      }
    });
  }
});

// @route   GET /api/users/stats/public
// @desc    Get public stats (total users, teams, etc.)
// @access  Public
router.get('/stats/public', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const onlineUsers = await User.countDocuments({
      isActive: true,
      lastActive: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Last 15 mins
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        onlineUsers,
        totalTeams: 0 // TODO: Add when Team model exists
      }
    });
  } catch (error) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch stats',
        code: 'SERVER_ERROR'
      }
    });
  }
});

// @route   GET /api/users/profile/:username
// @desc    Get public player profile by username
// @access  Public (but returns friend status if authenticated)
router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;

    console.log(`🔍 Fetching profile for: ${username}`);

    const player = await User.findOne({ username })
      .select('username avatarUrl level currentRank tournamentsWon favoriteGame games bio country friends createdAt gameIds steamProfile')
      .populate('friends', 'username avatarUrl')
      .lean();

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    console.log(`✅ Found player: ${player.username}`);

    // Calculate stats from actual match data
    let gamesPlayed = 0;
    let wins = 0;
    let statsSource = 'fallback'; // Track where stats came from

    // For CS2 players - query CS2Match collection
    if (player.gameIds?.steam || player.steamProfile?.steamId) {
      try {
        const steamId = player.gameIds?.steam || player.steamProfile?.steamId;
        const CS2Match = require('../models/CS2Match');
        
        console.log(`🎮 Fetching CS2 stats for Steam ID: ${steamId}`);
        
        // Get all matches for this player
        const cs2Matches = await CS2Match.aggregate([
          { $match: { accountid: parseInt(steamId) } },
          {
            $group: {
              _id: '$match_id',
              match_number: { $first: '$match_number' },
              match_date: { $first: '$match_date' },
              kills: { $sum: '$kills' },
              deaths: { $sum: '$deaths' },
              team: { $first: '$team' }
            }
          }
        ]);
        
        gamesPlayed = cs2Matches.length;
        console.log(`📊 CS2 Games Played: ${gamesPlayed}`);
        
        // For now, estimate wins (would need team data to calculate accurately)
        // Assuming ~40% win rate for CS2 players
        wins = Math.round(gamesPlayed * 0.4);
        console.log(`🏆 CS2 Estimated Wins: ${wins}`);
        
        if (gamesPlayed > 0) {
          statsSource = 'cs2_matches';
        }
        
      } catch (error) {
        console.error('❌ Error fetching CS2 stats:', error.message);
      }
    }
    
    // If no CS2 data, try BGMI tournament registrations
    if (gamesPlayed === 0 && player.games && player.games.includes('bgmi')) {
      try {
        const TournamentRegistration = require('../models/TournamentRegistration');
        const Leaderboard = require('../models/Leaderboard');
        const Team = require('../models/Team');
        
        console.log(`🎮 Fetching BGMI tournament stats for user: ${player.username}`);
        
        // Get all tournament registrations for this user
        const registrations = await TournamentRegistration.find({
          userId: player._id,
          status: { $in: ['verified', 'images_uploaded'] }
        }).populate('tournamentId', 'name status _id');
        
        console.log(`📋 Found ${registrations.length} tournament registrations for user`);
        
        if (registrations.length > 0) {
          // Count tournaments participated in
          gamesPlayed = registrations.length;
          
          // Check for tournament wins by looking at leaderboard entries
          // A user "won" a tournament if they have a rank 1 entry in tournament leaderboard
          let tournamentWins = 0;
          
          for (const registration of registrations) {
            try {
              // Check if user has rank 1 in this tournament's leaderboard
              const leaderboardEntry = await Leaderboard.findOne({
                userId: player._id,
                tournamentId: registration.tournamentId._id,
                leaderboardType: 'tournament',
                rank: 1
              });
              
              if (leaderboardEntry) {
                tournamentWins++;
                console.log(`🏆 Found tournament win: ${registration.tournamentId.name}`);
              }
            } catch (error) {
              console.error(`❌ Error checking leaderboard for tournament ${registration.tournamentId.name}:`, error.message);
            }
          }
          
          wins = tournamentWins;
          console.log(`📊 BGMI Tournaments Participated: ${gamesPlayed}, Wins: ${wins}`);
          
          if (gamesPlayed > 0) {
            statsSource = 'bgmi_tournaments';
          }
        }
        
        // Also try to get BGMI match data if available
        try {
          const BGMIMatch = require('../models/BGMIMatch');
          
          // Get user's teams - check both captain and members
          const userTeams = await Team.find({
            $or: [
              { captain: player._id },
              { 'members.userId': player._id }
            ]
          }).select('_id');
          
          const teamIds = userTeams.map(t => t._id);
          
          console.log(`👥 Found ${teamIds.length} teams for user`);
          
          if (teamIds.length > 0) {
            // Get matches for these teams
            const bgmiMatches = await BGMIMatch.find({
              'teamResults.teamId': { $in: teamIds }
            });
            
            const matchGamesPlayed = bgmiMatches.length;
            const matchWins = bgmiMatches.filter(m => 
              m.teamResults.some(t => t.placement === 1)
            ).length;
            
            console.log(`📊 BGMI Match Data - Games: ${matchGamesPlayed}, Wins: ${matchWins}`);
            
            // Use match data if it's more complete than tournament data
            if (matchGamesPlayed > gamesPlayed) {
              gamesPlayed = matchGamesPlayed;
              wins = matchWins;
              statsSource = 'bgmi_matches';
            }
          }
        } catch (error) {
          console.error('❌ Error fetching BGMI match data:', error.message);
        }
        
      } catch (error) {
        console.error('❌ Error fetching BGMI tournament stats:', error.message);
      }
    }
    
    // Final fallback to tournamentsWon
    if (gamesPlayed === 0) {
      gamesPlayed = player.tournamentsWon ? player.tournamentsWon * 2 : 0;
      wins = player.tournamentsWon || 0;
      statsSource = 'tournaments_won';
    }
    
    console.log(`✅ Final stats - Games: ${gamesPlayed}, Wins: ${wins}, Source: ${statsSource}`);

    // Check friend status if user is authenticated
    let friendStatus = null;
    let currentUserId = null;
    
    // Try to get current user from token
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUserId = decoded.userId;
        
        console.log(`🔍 Checking friend status between ${currentUserId} and ${player._id}`);
        
        // Check if already friends - handle both populated and non-populated friends
        const friendsArray = Array.isArray(player.friends) ? player.friends : [];
        const isFriend = friendsArray.some(friend => {
          const friendId = friend._id ? friend._id.toString() : friend.toString();
          return friendId === currentUserId;
        });
        console.log(`👥 Player has ${friendsArray.length} friends, Are they friends? ${isFriend}`);
        
        if (isFriend) {
          friendStatus = 'friends';
        } else {
          // Check if friend request exists in FriendRequest collection
          const FriendRequest = require('../models/FriendRequest');
          
          // Check if current user sent request to this player
          const sentRequest = await FriendRequest.findOne({
            sender: currentUserId,
            recipient: player._id,
            status: 'pending'
          });
          console.log(`📤 Sent request found:`, sentRequest ? 'YES' : 'NO');
          
          // Check if this player sent request to current user
          const receivedRequest = await FriendRequest.findOne({
            sender: player._id,
            recipient: currentUserId,
            status: 'pending'
          });
          console.log(`📥 Received request found:`, receivedRequest ? 'YES' : 'NO');
          
          if (sentRequest) {
            friendStatus = 'pending';
          } else if (receivedRequest) {
            friendStatus = 'received';
          }
        }
        
        console.log(`✅ Final friend status: ${friendStatus}`);
      } catch (err) {
        // Token invalid or expired, continue without friend status
        console.log('❌ Token verification failed, continuing without friend status:', err.message);
      }
    }

    // Format response
    const formattedPlayer = {
      _id: player._id,
      username: player.username,
      avatar: player.avatarUrl,
      level: player.level || 1,
      rank: player.currentRank || 'Unranked',
      wins: wins,
      gamesPlayed: gamesPlayed,
      games: player.games || [],
      favoriteGame: player.favoriteGame,
      bio: player.bio,
      country: player.country,
      friends: player.friends || [],
      joinedAt: player.createdAt,
      team: null, // TODO: Add team info when Team model exists
      friendStatus: friendStatus // 'friends', 'pending', 'received', or null
    };

    res.json(formattedPlayer);
  } catch (error) {
    console.error('❌ Error fetching player profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch player profile'
    });
  }
});

// @route   GET /api/users/testimonials
// @desc    Get user testimonials for landing page
// @access  Public
router.get('/testimonials', async (req, res) => {
  try {
    // Fetch users who have provided testimonials (have testimonial field)
    const users = await User.find({
      isActive: true,
      'testimonial.text': { $exists: true, $ne: '' },
      'testimonial.rating': { $gte: 4 } // Only show 4+ star reviews
    })
    .select('username avatarUrl testimonial favoriteGame games level')
    .limit(10)
    .sort({ 'testimonial.createdAt': -1 }) // Most recent first
    .lean();

    console.log(`✅ Found ${users.length} user testimonials`);

    // Format testimonials for frontend
    const testimonials = users.map(user => ({
      name: user.username,
      gameTitle: getGameTitle(user.favoriteGame || (user.games && user.games[0]) || 'bgmi'),
      gameType: user.favoriteGame || (user.games && user.games[0]) || 'bgmi',
      text: user.testimonial.text,
      rating: user.testimonial.rating,
      avatar: user.avatarUrl,
      level: user.level || 1,
      createdAt: user.testimonial.createdAt || new Date()
    }));

    // If no real testimonials, provide fallback
    if (testimonials.length === 0) {
      const fallbackTestimonials = [
        { 
          name: 'Rahul K.', 
          gameTitle: 'CS2 Player', 
          gameType: 'cs2', 
          text: 'Best platform for competitive CS2 in India. Auto stats tracking is amazing!', 
          rating: 5,
          avatar: null,
          level: 15
        },
        { 
          name: 'Priya S.', 
          gameTitle: 'BGMI Player', 
          gameType: 'bgmi', 
          text: 'Love the free tournaments and smooth registration process. Highly recommended!', 
          rating: 5,
          avatar: null,
          level: 12
        },
        { 
          name: 'Arjun M.', 
          gameTitle: 'Pro Gamer', 
          gameType: 'valorant', 
          text: 'Finally a platform that takes esports seriously. Great prizes and fair play.', 
          rating: 5,
          avatar: null,
          level: 20
        }
      ];
      
      return res.json({
        success: true,
        data: fallbackTestimonials,
        source: 'fallback'
      });
    }

    res.json({
      success: true,
      data: testimonials,
      source: 'database'
    });

  } catch (error) {
    console.error('❌ Error fetching testimonials:', error);
    
    // Return fallback testimonials on error
    const fallbackTestimonials = [
      { 
        name: 'Rahul K.', 
        gameTitle: 'CS2 Player', 
        gameType: 'cs2', 
        text: 'Best platform for competitive CS2 in India. Auto stats tracking is amazing!', 
        rating: 5,
        avatar: null,
        level: 15
      },
      { 
        name: 'Priya S.', 
        gameTitle: 'BGMI Player', 
        gameType: 'bgmi', 
        text: 'Love the free tournaments and smooth registration process. Highly recommended!', 
        rating: 5,
        avatar: null,
        level: 12
      },
      { 
        name: 'Arjun M.', 
        gameTitle: 'Pro Gamer', 
        gameType: 'valorant', 
        text: 'Finally a platform that takes esports seriously. Great prizes and fair play.', 
        rating: 5,
        avatar: null,
        level: 20
      }
    ];

    res.json({
      success: true,
      data: fallbackTestimonials,
      source: 'fallback'
    });
  }
});

// Helper function to get game title
function getGameTitle(gameType) {
  const gameTitles = {
    'cs2': 'CS2 Player',
    'bgmi': 'BGMI Player', 
    'valorant': 'Valorant Player',
    'freefire': 'Free Fire Player',
    'ml': 'Mobile Legends Player',
    'apex': 'Apex Legends Player',
    'rainbow6': 'Rainbow Six Player',
    'fc24': 'FC 24 Player'
  };
  
  return gameTitles[gameType] || 'Pro Gamer';
}

module.exports = router;

// @route   GET /api/users/tournament-history/:username
// @desc    Get user's tournament history with ranks
// @access  Public
router.get('/tournament-history/:username', async (req, res) => {
  try {
    const { username } = req.params;

    console.log(`🏆 Fetching tournament history for: ${username}`);

    // Get user
    const user = await User.findOne({ username }).select('_id username');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all tournament registrations
    const TournamentRegistration = require('../models/TournamentRegistration');
    const Leaderboard = require('../models/Leaderboard');
    const Tournament = require('../models/Tournament');

    const registrations = await TournamentRegistration.find({
      userId: user._id,
      status: { $in: ['verified', 'images_uploaded', 'pending'] }
    }).populate('tournamentId', 'name gameType startDate endDate');

    console.log(`📋 Found ${registrations.length} tournament registrations`);

    // Get rank for each tournament
    const tournamentHistory = await Promise.all(
      registrations.map(async (reg) => {
        try {
          // Get leaderboard entry for this tournament
          const leaderboardEntry = await Leaderboard.findOne({
            userId: user._id,
            tournamentId: reg.tournamentId._id,
            leaderboardType: 'tournament'
          });

          return {
            tournamentId: reg.tournamentId._id,
            tournamentName: reg.tournamentId.name,
            gameType: reg.tournamentId.gameType,
            teamName: reg.teamName,
            registrationStatus: reg.status,
            rank: leaderboardEntry?.rank || 'N/A',
            points: leaderboardEntry?.stats?.points || 0,
            matchesWon: leaderboardEntry?.stats?.matchesWon || 0,
            registeredAt: reg.registeredAt,
            tournamentDate: {
              start: reg.tournamentId.startDate,
              end: reg.tournamentId.endDate
            }
          };
        } catch (error) {
          console.error(`❌ Error fetching leaderboard for tournament:`, error.message);
          return {
            tournamentId: reg.tournamentId._id,
            tournamentName: reg.tournamentId.name,
            gameType: reg.tournamentId.gameType,
            teamName: reg.teamName,
            registrationStatus: reg.status,
            rank: 'N/A',
            points: 0,
            matchesWon: 0,
            registeredAt: reg.registeredAt,
            tournamentDate: {
              start: reg.tournamentId.startDate,
              end: reg.tournamentId.endDate
            }
          };
        }
      })
    );

    // Sort by registration date (newest first)
    tournamentHistory.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

    console.log(`✅ Tournament history fetched for ${username}`);

    res.json({
      success: true,
      data: {
        username: user.username,
        totalTournaments: tournamentHistory.length,
        tournaments: tournamentHistory
      }
    });

  } catch (error) {
    console.error('❌ Error fetching tournament history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tournament history'
    });
  }
});

module.exports = router;
