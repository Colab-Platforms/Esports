const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { isValidProvider, isProviderEnabled, providers } = require('../config/providers.config');
const identityService = require('../services/auth/identity.service');
const accountLinkingService = require('../services/auth/account-linking.service');
const steamProvider = require('../services/auth/providers/steam.provider');

function serializeConnectedAccount(identity) {
  const base = {
    provider: identity.provider,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl,
    canLogin: identity.canLogin,
    connectedAt: identity.createdAt,
    lastUsedAt: identity.lastUsedAt
  };

  if (identity.provider === 'riot') {
    return {
      ...base,
      profile: {
        gameName: identity.profile?.gameName || '',
        tagLine: identity.profile?.tagLine || ''
      },
      metadata: {
        verifiedAt: identity.metadata?.verifiedAt || null
      }
    };
  }

  if (identity.provider === 'steam') {
    return {
      ...base,
      profile: {
        profileUrl: identity.profile?.profileUrl || '',
        realName: identity.profile?.realName || '',
        countryCode: identity.profile?.countryCode || ''
      },
      metadata: {
        lastSync: identity.metadata?.lastSync || null
      }
    };
  }

  if (identity.provider === 'xbox') {
    return {
      ...base,
      profile: {
        gamertag: identity.profile?.gamertag || '',
        xuid: identity.profile?.xuid || ''
      },
      metadata: {}
    };
  }

  return {
    ...base,
    profile: {},
    metadata: {}
  };
}

// @route   GET /api/accounts
// @desc    List every provider identity connected to the current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const identities = await identityService.findByUser(req.user.userId);

    res.json({
      success: true,
      data: {
        accounts: identities.map(serializeConnectedAccount)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error listing connected accounts:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ACCOUNTS_LIST_FAILED', message: 'Failed to load connected accounts.', timestamp: new Date().toISOString() }
    });
  }
});

// ---------------------------------------------------------------------------
// Steam - status / connect / disconnect / sync
// ---------------------------------------------------------------------------

// @route   GET /api/accounts/steam/status
// @desc    Current user's Steam connection status - same response shape the
//          old (dead, never-mounted) routes/steam.js used, so existing
//          frontend consumers (SteamSettingsPage, SteamConnectionModal/
//          Widget) only need their URL repointed, not their parsing logic.
// @access  Private
router.get('/steam/status', auth, async (req, res) => {
  try {
    const identity = await identityService.findByUser(req.user.userId)
      .then((identities) => identities.find((i) => i.provider === 'steam'));

    if (!identity) {
      return res.json({ isConnected: false, steamProfile: null, steamGames: null, steamId: null });
    }

    res.json({
      isConnected: true,
      steamProfile: {
        steamId: identity.providerId,
        profileUrl: identity.profile.profileUrl || '',
        avatar: identity.avatarUrl || '',
        displayName: identity.displayName || '',
        realName: identity.profile.realName || '',
        countryCode: identity.profile.countryCode || '',
        isConnected: true,
        connectedAt: identity.createdAt,
        lastSync: (identity.metadata && identity.metadata.lastSync) || null
      },
      steamGames: (identity.metadata && identity.metadata.steamGames) || null,
      steamId: identity.providerId
    });
  } catch (error) {
    console.error('❌ Error fetching Steam status:', error);
    res.status(500).json({ message: 'Error fetching Steam status' });
  }
});

// ---------------------------------------------------------------------------
// Generic connect / disconnect - works for any provider (Google, Facebook,
// Steam, Xbox). "Status" and "sync" stay provider-specific above/below since
// their response shape is inherently provider-specific (gamertag/games data
// has no equivalent for Google/Facebook/Xbox) - GET /api/accounts already
// covers "is provider X connected" generically for those three.
// ---------------------------------------------------------------------------

// @route   POST /api/accounts/:provider/connect/start
// @desc    Authenticated first step of "connect <provider> from settings" -
//          records which user is connecting on the session, then hands back
//          the URL to full-page-redirect to. See account-linking.service.js's
//          issueConnectIntent for why this replaces the old, Steam-only
//          `?state=<userId>` pattern (which required no proof of identity at
//          all).
//
//          The redirect target is each provider's existing /api/auth/*
//          login-initiate route, not a separate one: every strategy here
//          (Google, Facebook, Steam, Xbox) has its callback URL fixed at
//          registration time, so there is deliberately no separate
//          /api/accounts/:provider/connect/callback endpoint - it would
//          never be reachable. See handleConnectCallback in
//          account-linking.service.js for the branch that actually runs.
// @access  Private
router.post('/:provider/connect/start', auth, (req, res) => {
  const { provider } = req.params;

  if (!isValidProvider(provider)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PROVIDER', message: `Unknown provider: ${provider}`, timestamp: new Date().toISOString() }
    });
  }

  if (!isProviderEnabled(provider)) {
    const code = provider === 'riot' ? 'RIOT_OAUTH_NOT_CONFIGURED' : 'OAUTH_NOT_CONFIGURED';
    return res.status(503).json({
      success: false,
      error: { code, message: `${providers[provider].label} is not properly configured.`, timestamp: new Date().toISOString() }
    });
  }

  const redirectPath = typeof req.body.redirectPath === 'string' ? req.body.redirectPath : '';
  accountLinkingService.issueConnectIntent(req, req.user.userId, provider, redirectPath);

  const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5001';
  res.json({
    success: true,
    data: { connectUrl: `${SERVER_URL}/api/auth/${provider}` },
    timestamp: new Date().toISOString()
  });
});

// @route   POST /api/accounts/:provider/disconnect
// @desc    Disconnect a provider - refuses if it's the user's only login
//          method (see account-linking.service.js's disconnectIdentity).
// @access  Private
router.post('/:provider/disconnect', auth, async (req, res) => {
  const { provider } = req.params;

  if (!isValidProvider(provider)) {
    return res.status(400).json({ message: `Unknown provider: ${provider}`, code: 'INVALID_PROVIDER' });
  }

  try {
    await accountLinkingService.disconnectIdentity(req.user.userId, provider);
    res.json({ message: `${providers[provider].label} account disconnected successfully` });
  } catch (error) {
    if (error.code === 'CANNOT_DISCONNECT_LAST_LOGIN_METHOD') {
      return res.status(400).json({ message: error.message, code: error.code });
    }
    if (error.code === 'IDENTITY_NOT_FOUND') {
      return res.status(404).json({ message: error.message, code: error.code });
    }
    console.error(`❌ Error disconnecting ${provider}:`, error);
    res.status(500).json({ message: `Error disconnecting ${provider} account` });
  }
});

// @route   POST /api/accounts/steam/sync
// @desc    Refresh CS2/CSGO ownership + playtime from Steam's Web API.
// @access  Private
router.post('/steam/sync', auth, async (req, res) => {
  try {
    const identities = await identityService.findByUser(req.user.userId);
    const identity = identities.find((i) => i.provider === 'steam');

    if (!identity) {
      return res.status(400).json({ message: 'Steam account not connected' });
    }

    const steamGames = await steamProvider.fetchGamesSnapshot(identity.providerId);
    const lastSync = new Date();

    await identityService.updateIdentity(identity._id, {
      metadata: { ...identity.metadata, steamGames, lastSync }
    });

    res.json({
      message: 'Steam data synced successfully',
      steamGames,
      lastSync
    });
  } catch (error) {
    console.error('❌ Error syncing Steam data:', error);
    res.status(500).json({ message: 'Error syncing Steam data' });
  }
});

module.exports = router;
