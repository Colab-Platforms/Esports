const User = require('../../models/User');
const mongoose = require('mongoose');
const identityService = require('./identity.service');
const verifiedGameIdService = require('./verified-game-id.service');
const { IdentityAlreadyLinkedError, RiotAccountAlreadyConnectedError } = identityService;

const CONNECT_INTENT_SESSION_KEY = 'connectIntent';
const CONNECT_INTENT_TTL_MS = 10 * 60 * 1000;

/**
 * "Connect <provider>" from an authenticated settings page. Throws
 * IdentityAlreadyLinkedError if the external account is already linked to a
 * different Colab Esports user - callers must turn that into a 409, never
 * merge accounts automatically.
 */
async function connectIdentity(userId, provider, normalizedIdentity) {
  if (provider === 'riot') {
    return connectRiotIdentity(userId, normalizedIdentity);
  }

  const existing = await identityService.findByProviderIdentity(provider, normalizedIdentity.providerId);

  if (existing) {
    if (String(existing.userId) !== String(userId)) {
      throw new IdentityAlreadyLinkedError(provider);
    }
    const updates = { lastUsedAt: new Date() };
    if (provider === 'riot') {
      updates.canLogin = false;
      updates.displayName = normalizedIdentity.displayName || existing.displayName || '';
      updates.profile = normalizedIdentity.profile || existing.profile || {};
      updates.metadata = {
        ...(existing.metadata || {}),
        ...(normalizedIdentity.metadata || {}),
        verifiedAt: normalizedIdentity.metadata?.verifiedAt || new Date()
      };
    }
    const identity = await identityService.updateIdentity(existing._id, updates);
    return { identity, alreadyConnected: true };
  }

  const identity = await identityService.createIdentity({
    userId,
    provider,
    providerId: normalizedIdentity.providerId,
    canLogin: normalizedIdentity.canLogin !== undefined ? Boolean(normalizedIdentity.canLogin) : true,
    email: normalizedIdentity.email || '',
    emailVerifiedByProvider: Boolean(normalizedIdentity.emailVerifiedByProvider),
    displayName: normalizedIdentity.displayName || '',
    username: normalizedIdentity.username || '',
    avatarUrl: normalizedIdentity.avatarUrl || '',
    profile: normalizedIdentity.profile || {},
    metadata: normalizedIdentity.metadata || {},
    linkedVia: 'manual-connect'
  });

  return { identity, alreadyConnected: false };
}

function buildIdentityPayload(userId, provider, normalizedIdentity) {
  return {
    userId,
    provider,
    providerId: normalizedIdentity.providerId,
    canLogin: normalizedIdentity.canLogin !== undefined ? Boolean(normalizedIdentity.canLogin) : true,
    email: normalizedIdentity.email || '',
    emailVerifiedByProvider: Boolean(normalizedIdentity.emailVerifiedByProvider),
    displayName: normalizedIdentity.displayName || '',
    username: normalizedIdentity.username || '',
    avatarUrl: normalizedIdentity.avatarUrl || '',
    profile: normalizedIdentity.profile || {},
    metadata: normalizedIdentity.metadata || {},
    linkedVia: 'manual-connect'
  };
}

function isTransactionUnsupportedError(error) {
  const message = (error && error.message) || '';
  return message.includes('Transaction numbers are only allowed') ||
    message.includes('transactions are not supported') ||
    message.includes('Transaction not supported');
}

async function connectRiotIdentity(userId, normalizedIdentity) {
  let session;
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.client) {
      session = await mongoose.startSession();
      let result;
      await session.withTransaction(async () => {
        result = await connectRiotIdentityUnit(userId, normalizedIdentity, { session });
      });
      return result;
    }
  } catch (error) {
    if (!isTransactionUnsupportedError(error)) {
      throw error;
    }
  } finally {
    if (session) {
      await session.endSession();
    }
  }

  return connectRiotIdentityWithRollback(userId, normalizedIdentity);
}

async function connectRiotIdentityUnit(userId, normalizedIdentity, { session } = {}) {
  const existingExternal = await identityService.findByProviderIdentity('riot', normalizedIdentity.providerId, { session });

  if (existingExternal && String(existingExternal.userId) !== String(userId)) {
    throw new IdentityAlreadyLinkedError('riot');
  }

  const existingUserRiot = (await identityService.findByUser(userId, { session }))
    .find((identity) => identity.provider === 'riot');

  if (existingUserRiot && existingUserRiot.providerId !== normalizedIdentity.providerId) {
    throw new RiotAccountAlreadyConnectedError();
  }

  if (existingExternal) {
    const updates = {
      lastUsedAt: new Date(),
      canLogin: false,
      displayName: normalizedIdentity.displayName || existingExternal.displayName || '',
      profile: normalizedIdentity.profile || existingExternal.profile || {},
      metadata: {
        ...(existingExternal.metadata || {}),
        ...(normalizedIdentity.metadata || {}),
        verifiedAt: normalizedIdentity.metadata?.verifiedAt || new Date()
      }
    };
    const identity = await identityService.updateIdentity(existingExternal._id, updates, { session });
    await verifiedGameIdService.syncTrustedRiotGameId(userId, normalizedIdentity, { session });
    return { identity, alreadyConnected: true };
  }

  const identity = await identityService.createIdentity(
    buildIdentityPayload(userId, 'riot', { ...normalizedIdentity, canLogin: false }),
    { session }
  );
  await verifiedGameIdService.syncTrustedRiotGameId(userId, normalizedIdentity, { session });
  return { identity, alreadyConnected: false };
}

async function connectRiotIdentityWithRollback(userId, normalizedIdentity) {
  let createdIdentity = null;
  let existingIdentity = null;
  let previousIdentityState = null;

  try {
    const existingExternal = await identityService.findByProviderIdentity('riot', normalizedIdentity.providerId);

    if (existingExternal && String(existingExternal.userId) !== String(userId)) {
      throw new IdentityAlreadyLinkedError('riot');
    }

    const existingUserRiot = (await identityService.findByUser(userId))
      .find((identity) => identity.provider === 'riot');

    if (existingUserRiot && existingUserRiot.providerId !== normalizedIdentity.providerId) {
      throw new RiotAccountAlreadyConnectedError();
    }

    if (existingExternal) {
      existingIdentity = existingExternal;
      previousIdentityState = {
        canLogin: existingExternal.canLogin,
        displayName: existingExternal.displayName,
        profile: existingExternal.profile || {},
        metadata: existingExternal.metadata || {},
        lastUsedAt: existingExternal.lastUsedAt
      };

      const identity = await identityService.updateIdentity(existingExternal._id, {
        lastUsedAt: new Date(),
        canLogin: false,
        displayName: normalizedIdentity.displayName || existingExternal.displayName || '',
        profile: normalizedIdentity.profile || existingExternal.profile || {},
        metadata: {
          ...(existingExternal.metadata || {}),
          ...(normalizedIdentity.metadata || {}),
          verifiedAt: normalizedIdentity.metadata?.verifiedAt || new Date()
        }
      });
      await verifiedGameIdService.syncTrustedRiotGameId(userId, normalizedIdentity);
      return { identity, alreadyConnected: true };
    }

    createdIdentity = await identityService.createIdentity(
      buildIdentityPayload(userId, 'riot', { ...normalizedIdentity, canLogin: false })
    );
    await verifiedGameIdService.syncTrustedRiotGameId(userId, normalizedIdentity);
    return { identity: createdIdentity, alreadyConnected: false };
  } catch (error) {
    if (createdIdentity && createdIdentity._id) {
      await identityService.deleteIdentity(createdIdentity._id).catch(() => {});
    }
    if (existingIdentity && previousIdentityState) {
      await identityService.updateIdentity(existingIdentity._id, previousIdentityState).catch(() => {});
    }
    throw error;
  }
}

/**
 * Disconnect an identity, refusing to leave the user unable to log in.
 * A user can disconnect a provider only if they still have a password set
 * or at least one other login-capable identity afterwards.
 */
async function disconnectIdentity(userId, provider) {
  const [user, identities] = await Promise.all([
    User.findById(userId).select('passwordHash'),
    identityService.findByUser(userId)
  ]);

  const target = identities.find((identity) => identity.provider === provider);
  if (!target) {
    const error = new Error(`No connected ${provider} account found.`);
    error.code = 'IDENTITY_NOT_FOUND';
    throw error;
  }

  const hasPassword = Boolean(user && user.passwordHash);
  const otherLoginCapableIdentities = identities.filter(
    (identity) => identity.provider !== provider && identity.canLogin
  );

  if (!hasPassword && otherLoginCapableIdentities.length === 0) {
    const error = new Error('Cannot disconnect your only login method. Set a password or connect another provider first.');
    error.code = 'CANNOT_DISCONNECT_LAST_LOGIN_METHOD';
    throw error;
  }

  await identityService.deleteIdentity(target._id);
  return { disconnected: true };
}

/**
 * Records "user X wants to connect provider Y" on the session, right before
 * a full-page redirect into that provider's OAuth/OpenID flow. Full-page
 * redirects can't carry an Authorization header, so this is how the
 * provider's callback (a plain GET, no header either) still knows which
 * already-authenticated user it's connecting to - it rides the session
 * cookie set by the authenticated POST that called this, not a client-
 * supplied id (unlike the old, spoofable `?state=<userId>` pattern this
 * replaces - see the dead routes/steam.js this superseded).
 */
function sanitizeRedirectPath(redirectPath = '') {
  if (typeof redirectPath !== 'string') return '';
  if (!redirectPath.startsWith('/')) return '';
  if (redirectPath.startsWith('//')) return '';
  if (redirectPath.includes('\\')) return '';
  return redirectPath;
}

function issueConnectIntent(req, userId, provider, redirectPath = '') {
  req.session[CONNECT_INTENT_SESSION_KEY] = {
    userId: String(userId),
    provider,
    redirectPath: sanitizeRedirectPath(redirectPath),
    issuedAt: Date.now()
  };
}

function hasValidConnectIntent(req, provider) {
  const stored = req.session && req.session[CONNECT_INTENT_SESSION_KEY];
  if (!stored) return false;
  if (stored.provider !== provider) return false;
  if (Date.now() - stored.issuedAt > CONNECT_INTENT_TTL_MS) return false;
  return true;
}

/**
 * Reads back and clears the connect intent for this session, validating it
 * matches the provider whose callback we're in and hasn't expired. Returns
 * null if there's no valid intent - callers must treat that as "this wasn't
 * a legitimate connect attempt," not fall back to any other user id.
 */
function consumeConnectIntent(req, provider) {
  const stored = req.session && req.session[CONNECT_INTENT_SESSION_KEY];
  if (req.session) {
    req.session[CONNECT_INTENT_SESSION_KEY] = undefined;
  }

  if (!stored) return null;
  if (stored.provider !== provider) return null;
  if (Date.now() - stored.issuedAt > CONNECT_INTENT_TTL_MS) return null;

  return stored;
}

/**
 * Shared connect-branch for every provider's OAuth callback (Google,
 * Facebook, Steam, Xbox all funnel connect attempts through their existing
 * login callback - see routes/auth.js and its comments for why). If a
 * connect intent was recorded for this session/provider, this consumes it,
 * performs the connect, redirects, and returns true - callers must return
 * immediately in that case without running their own login logic. Returns
 * false (no response sent) when there was no connect intent, meaning this
 * really is a plain login attempt and the caller should proceed as normal.
 */
async function handleConnectCallback(req, res, provider, err, normalizedIdentity) {
  const intent = consumeConnectIntent(req, provider);
  if (!intent) return false;

  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
  const redirectTarget = intent.redirectPath || '/';

  if (err || !normalizedIdentity) {
    res.redirect(`${CLIENT_URL}${redirectTarget}?connect_error=auth_failed`);
    return true;
  }

  try {
    await connectIdentity(intent.userId, provider, normalizedIdentity);
    res.redirect(`${CLIENT_URL}${redirectTarget}?connected=${provider}`);
  } catch (error) {
    if (error.code === 'IDENTITY_ALREADY_LINKED') {
      res.redirect(`${CLIENT_URL}${redirectTarget}?connect_error=already_linked`);
    } else if (error.code === 'RIOT_ACCOUNT_ALREADY_CONNECTED') {
      res.redirect(`${CLIENT_URL}${redirectTarget}?connect_error=riot_already_connected`);
    } else {
      console.error(`❌ ${provider} connect callback error:`, error);
      res.redirect(`${CLIENT_URL}${redirectTarget}?connect_error=connect_failed`);
    }
  }
  return true;
}

module.exports = {
  connectIdentity,
  disconnectIdentity,
  issueConnectIntent,
  consumeConnectIntent,
  hasValidConnectIntent,
  sanitizeRedirectPath,
  handleConnectCallback
};
