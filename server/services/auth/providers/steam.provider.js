const SteamStrategy = require('passport-steam').Strategy;
const { providers, isProviderEnabled, PROVIDERS } = require('../../../config/providers.config');
const steamService = require('../../steamService');

// Turns a raw passport-steam (OpenID) identifier/profile pair into the
// normalized identity shape every provider adapter must produce. Deliberately
// does not touch User/Identity/Mongo - that orchestration lives in
// auth.service.js / account-linking.service.js.
//
// Steam never provides an email (OpenID has no email claim, and Steam's Web
// API doesn't expose one) - callers must never treat a Steam identity's
// empty email as something to match accounts on.
function normalizeProfile(identifier, profile) {
  const steamId = identifier.split('/').pop();

  return {
    providerId: steamId,
    email: '',
    emailVerifiedByProvider: false,
    displayName: profile.displayName || '',
    username: '',
    avatarUrl: (profile.photos && profile.photos[2] && profile.photos[2].value) || '',
    profile: {
      profileUrl: (profile._json && profile._json.profileurl) || '',
      realName: (profile._json && profile._json.realname) || '',
      countryCode: (profile._json && profile._json.loccountrycode) || ''
    },
    metadata: {}
  };
}

// Refreshes CS2/CSGO ownership + playtime for a Steam identity from Steam's
// Web API. Mirrors the requirements the old (dead) routes/steam.js used, so
// eligibility results stay consistent with what shipped before this refactor.
async function fetchGamesSnapshot(steamId) {
  const games = await steamService.getSteamGames(steamId);

  const cs2Game = games.find((game) => game.appid === 730 || game.appid === 740);
  const csgoGame = games.find((game) => game.appid === 730);

  const snapshot = {
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

  if (cs2Game) {
    snapshot.cs2 = {
      owned: true,
      playtime: cs2Game.playtime_forever || 0,
      lastPlayed: cs2Game.rtime_last_played ? new Date(cs2Game.rtime_last_played * 1000) : null,
      achievements: 0,
      verified: (cs2Game.playtime_forever || 0) >= 120 // minimum 2 hours
    };
  }

  if (csgoGame) {
    snapshot.csgo = {
      owned: true,
      playtime: csgoGame.playtime_forever || 0,
      lastPlayed: csgoGame.rtime_last_played ? new Date(csgoGame.rtime_last_played * 1000) : null,
      rank: ''
    };
  }

  return snapshot;
}

function configure(passport) {
  if (!isProviderEnabled(PROVIDERS.STEAM)) {
    console.warn('Steam OAuth not configured - missing STEAM_API_KEY');
    return;
  }

  const config = providers[PROVIDERS.STEAM];

  passport.use(new SteamStrategy({
    returnURL: config.returnUrl,
    realm: config.realm,
    apiKey: config.apiKey
  }, (identifier, profile, done) => {
    try {
      done(null, normalizeProfile(identifier, profile));
    } catch (error) {
      done(error, null);
    }
  }));
}

module.exports = { configure, normalizeProfile, fetchGamesSnapshot };
