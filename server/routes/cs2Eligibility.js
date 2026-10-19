const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const identityService = require('../services/auth/identity.service');

// @route   GET /api/cs2/eligibility
// @desc    CS2 tournament eligibility for the current user. This is
//          tournament/game business logic that happens to read Steam
//          identity data, not account-linking logic - deliberately kept
//          outside /api/accounts/* (see the architecture migration plan).
//          Requirements mirror the original (dead) routes/steam.js exactly.
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const identities = await identityService.findByUser(req.user.userId);
    const steamIdentity = identities.find((identity) => identity.provider === 'steam');

    if (!steamIdentity) {
      return res.json({
        eligible: false,
        reason: 'Steam account not connected',
        requirements: {
          steamConnected: false,
          cs2Owned: false,
          minimumHours: false,
          accountAge: false
        }
      });
    }

    const cs2Data = steamIdentity.metadata && steamIdentity.metadata.steamGames && steamIdentity.metadata.steamGames.cs2;
    const requirements = {
      steamConnected: true,
      cs2Owned: (cs2Data && cs2Data.owned) || false,
      minimumHours: ((cs2Data && cs2Data.playtime) || 0) >= 120, // 2 hours minimum
      accountAge: Boolean(steamIdentity.createdAt) &&
        (Date.now() - new Date(steamIdentity.createdAt).getTime()) >= 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    const eligible = Object.values(requirements).every((value) => value === true);

    res.json({
      eligible,
      reason: eligible ? 'Eligible for CS2 tournaments' : 'Requirements not met',
      requirements,
      cs2Data: cs2Data || null
    });
  } catch (error) {
    console.error('❌ Error checking CS2 eligibility:', error);
    res.status(500).json({ message: 'Error checking CS2 eligibility' });
  }
});

module.exports = router;
