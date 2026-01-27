// Add this endpoint to server/routes/tournaments.js
// Place it after the validate-player endpoint

// @route   POST /api/tournaments/:id/join-with-players
// @desc    Join tournament with validated players (BGMI only)
// @access  Private
router.post('/:id/join-with-players', auth, [
  body('teamPlayers')
    .isArray({ min: 3, max: 3 })
    .withMessage('Exactly 3 players are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { teamPlayers } = req.body;
    const userId = req.user.userId;

    console.log('🎮 Tournament registration with players:');
    console.log('  Tournament ID:', req.params.id);
    console.log('  User ID:', userId);
    console.log('  Team Players:', teamPlayers.length);

    // Get tournament
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Only allow for BGMI tournaments
    if (tournament.gameType !== 'bgmi') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GAME_TYPE',
          message: 'Player-based registration is only available for BGMI tournaments',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ Tournament is BGMI type');

    // Validate all players exist and are registered
    const User = require('../models/User');
    const TournamentRegistration = require('../models/TournamentRegistration');
    const invalidPlayers = [];
    const playerIds = [userId]; // Include team leader

    for (const player of teamPlayers) {
      console.log(`🔍 Validating player: ${player.ignName} (${player.bgmiUid})`);

      // Check if player exists
      const foundPlayer = await User.findById(player.playerId);
      
      if (!foundPlayer) {
        console.log(`❌ Player not found: ${player.playerId}`);
        invalidPlayers.push({
          bgmiUid: player.bgmiUid,
          ignName: player.ignName,
          message: 'Player not found on platform'
        });
        continue;
      }

      if (!foundPlayer.isActive) {
        console.log(`❌ Player is inactive: ${foundPlayer.username}`);
        invalidPlayers.push({
          bgmiUid: player.bgmiUid,
          ignName: player.ignName,
          message: 'Player is not active on platform'
        });
        continue;
      }

      if (!foundPlayer.gameIds?.bgmi) {
        console.log(`❌ Player has no BGMI ID: ${foundPlayer.username}`);
        invalidPlayers.push({
          bgmiUid: player.bgmiUid,
          ignName: player.ignName,
          message: 'Player does not have BGMI ID registered'
        });
        continue;
      }

      console.log(`✅ Player validated: ${foundPlayer.username}`);
      playerIds.push(foundPlayer._id);
    }

    // If any players are invalid, return error
    if (invalidPlayers.length > 0) {
      console.log('❌ Some players are invalid:', invalidPlayers);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLAYERS',
          message: 'Some players are not registered on platform',
          invalidPlayers: invalidPlayers,
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ All players are valid');

    // Check if user is already registered for this tournament
    const existingRegistration = await TournamentRegistration.findOne({
      tournamentId: tournament._id,
      userId: userId
    });

    if (existingRegistration) {
      console.log('❌ User already registered for this tournament');
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_REGISTERED',
          message: 'You are already registered for this tournament',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ User not already registered');

    // Create tournament registration
    const registration = new TournamentRegistration({
      userId: userId,
      tournamentId: tournament._id,
      teamPlayers: playerIds, // All player IDs including leader
      status: 'registered',
      registeredAt: new Date()
    });

    await registration.save();
    console.log('✅ Registration created:', registration._id);

    // Add user to tournament participants
    if (!tournament.participants) {
      tournament.participants = [];
    }

    tournament.participants.push({
      userId: userId,
      joinedAt: new Date()
    });

    await tournament.save();
    console.log('✅ User added to tournament participants');

    // Populate registration for response
    await registration.populate('userId', 'username avatarUrl');
    await registration.populate('teamPlayers', 'username avatarUrl gameIds');

    console.log('✅ Tournament registration successful!');

    res.status(201).json({
      success: true,
      message: '🎉 Tournament registration successful!',
      data: {
        registration: registration.toObject()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Tournament registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to register for tournament',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});
