const express = require('express');
const router = express.Router();
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const User = require('../models/User');
const auth = require('../middleware/auth');
const { getSteamProfile, getSteamGames, getSteamPlayerStats } = require('../services/steamService');

// Steam OAuth configuration
passport.use(new SteamStrategy({
    returnURL: `${process.env.SERVER_URL}/api/steam/auth/return`,
    realm: process.env.SERVER_URL,
    apiKey: process.env.STEAM_API_KEY
  },
  async (identifier, profile, done) => {
    try {
      // Extract Steam ID from identifier
      const steamId = identifier.split('/').pop();
      
      // Store Steam profile data temporarily
      const steamData = {
        steamId,
        profileUrl: profile._json.profileurl,
        avatar: profile._json.avatarfull,
        displayName: profile.displayName,
        realName: profile._json.realname || '',
        countryCode: profile._json.loccountrycode || ''
      };
      
      return done(null, steamData);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Initialize Steam OAuth
router.get('/auth', passport.authenticate('steam'));

// Steam OAuth callback
router.get('/auth/return', 
  passport.authenticate('steam', { session: false }),
  async (req, res) => {
    try {
      const steamData = req.user;
      const userId = req.query.state; // Pass user ID in state parameter
      
      if (!userId) {
        return res.redirect(`${process.env.CLIENT_URL}/games?error=missing_user`);
      }

      // Update user with Steam profile
      const user = await User.findById(userId);
      if (!user) {
        return res.redirect(`${process.env.CLIENT_URL}/games?error=user_not_found`);
      }

      // Get detailed Steam profile and games
      const [steamProfile, steamGames] = await Promise.all([
        getSteamProfile(steamData.steamId),
        getSteamGames(steamData.steamId)
      ]);

      // Check CS2 ownership and playtime
      const cs2Game = steamGames.find(game => 
        game.appid === 730 || // CS2
        game.appid === 740    // CS2 Beta
      );

      const csgoGame = steamGames.find(game => game.appid === 730); // CSGO

      // Update user profile
      user.gameIds.steam = steamData.steamId;
      user.steamProfile = {
        ...steamData,
        isConnected: true,
        connectedAt: new Date(),
        lastSync: new Date()
      };

      // Update CS2 game data
      if (cs2Game) {
        user.steamGames.cs2 = {
          owned: true,
          playtime: cs2Game.playtime_forever || 0,
          lastPlayed: cs2Game.rtime_last_played ? new Date(cs2Game.rtime_last_played * 1000) : null,
          verified: cs2Game.playtime_forever >= 120 // Minimum 2 hours
        };
      }

      // Update CSGO data for legacy players
      if (csgoGame) {
        user.steamGames.csgo = {
          owned: true,
          playtime: csgoGame.playtime_forever || 0,
          lastPlayed: csgoGame.rtime_last_played ? new Date(csgoGame.rtime_last_played * 1000) : null
        };
      }

      await user.save();

      // Redirect back to games page with success
      res.redirect(`${process.env.CLIENT_URL}/games?steam_connected=true`);
      
    } catch (error) {
      console.error('Steam OAuth error:', error);
      res.redirect(`${process.env.CLIENT_URL}/games?error=steam_connection_failed`);
    }
  }
);

// Get Steam connection status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('steamProfile steamGames gameIds');
    
    res.json({
      isConnected: user.steamProfile?.isConnected || false,
      steamProfile: user.steamProfile || null,
      steamGames: user.steamGames || null,
      steamId: user.gameIds?.steam || null
    });
  } catch (error) {
    console.error('Error fetching Steam status:', error);
    res.status(500).json({ message: 'Error fetching Steam status' });
  }
});

// Disconnect Steam account
router.post('/disconnect', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Reset Steam data
    user.gameIds.steam = '';
    user.steamProfile = {
      steamId: '',
      profileUrl: '',
      avatar: '',
      displayName: '',
      realName: '',
      countryCode: '',
      isConnected: false,
      connectedAt: null,
      lastSync: null
    };
    user.steamGames = {
      cs2: {
        owned: false,
        playtime: 0,
        lastPlayed: null,
        achievements: 0,
        verified: false
      },
      csgo: {
        owned: false,
        playtime: 0,
        lastPlayed: null,
        rank: ''
      }
    };

    await user.save();

    res.json({ message: 'Steam account disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Steam:', error);
    res.status(500).json({ message: 'Error disconnecting Steam account' });
  }
});

// Sync Steam data (refresh games and stats)
router.post('/sync', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.steamProfile?.isConnected || !user.gameIds?.steam) {
      return res.status(400).json({ message: 'Steam account not connected' });
    }

    const steamId = user.gameIds.steam;

    // Get updated Steam data
    const [steamProfile, steamGames, cs2Stats] = await Promise.all([
      getSteamProfile(steamId),
      getSteamGames(steamId),
      getSteamPlayerStats(steamId, 730) // CS2 app ID
    ]);

    // Update CS2 game data
    const cs2Game = steamGames.find(game => game.appid === 730);
    if (cs2Game) {
      user.steamGames.cs2 = {
        owned: true,
        playtime: cs2Game.playtime_forever || 0,
        lastPlayed: cs2Game.rtime_last_played ? new Date(cs2Game.rtime_last_played * 1000) : null,
        achievements: cs2Stats?.achievements?.length || 0,
        verified: cs2Game.playtime_forever >= 120
      };
    }

    user.steamProfile.lastSync = new Date();
    await user.save();

    res.json({
      message: 'Steam data synced successfully',
      steamGames: user.steamGames,
      lastSync: user.steamProfile.lastSync
    });

  } catch (error) {
    console.error('Error syncing Steam data:', error);
    res.status(500).json({ message: 'Error syncing Steam data' });
  }
});

// Check CS2 eligibility for tournaments
router.get('/cs2/eligibility', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('steamProfile steamGames');
    
    if (!user.steamProfile?.isConnected) {
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

    const cs2Data = user.steamGames?.cs2;
    const requirements = {
      steamConnected: user.steamProfile.isConnected,
      cs2Owned: cs2Data?.owned || false,
      minimumHours: (cs2Data?.playtime || 0) >= 120, // 2 hours minimum
      accountAge: user.steamProfile.connectedAt && 
                  (Date.now() - new Date(user.steamProfile.connectedAt).getTime()) >= 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    const eligible = Object.values(requirements).every(req => req === true);

    res.json({
      eligible,
      reason: eligible ? 'Eligible for CS2 tournaments' : 'Requirements not met',
      requirements,
      cs2Data: cs2Data || null
    });

  } catch (error) {
    console.error('Error checking CS2 eligibility:', error);
    res.status(500).json({ message: 'Error checking CS2 eligibility' });
  }
});

module.exports = router;