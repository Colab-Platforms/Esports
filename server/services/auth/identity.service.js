const Identity = require('../../models/Identity');

class IdentityAlreadyLinkedError extends Error {
  constructor(provider) {
    super(`This ${provider} account is already connected to another user.`);
    this.name = 'IdentityAlreadyLinkedError';
    this.code = 'IDENTITY_ALREADY_LINKED';
  }
}

class RiotAccountAlreadyConnectedError extends Error {
  constructor() {
    super('A different Riot account is already connected. Disconnect it before connecting another Riot account.');
    this.name = 'RiotAccountAlreadyConnectedError';
    this.code = 'RIOT_ACCOUNT_ALREADY_CONNECTED';
  }
}

function applySession(query, session) {
  return session && typeof query.session === 'function' ? query.session(session) : query;
}

/**
 * Find the Identity for a given (provider, providerId) pair, or null.
 */
async function findByProviderIdentity(provider, providerId, { session } = {}) {
  return applySession(Identity.findOne({ provider, providerId }), session);
}

/**
 * All identities connected to a given application user.
 */
async function findByUser(userId, { session } = {}) {
  return applySession(Identity.find({ userId }).sort({ createdAt: 1 }), session);
}

/**
 * Create a new Identity document. Throws IdentityAlreadyLinkedError (rather
 * than a raw Mongo duplicate-key error) if the (provider, providerId) pair
 * is already claimed by any user - callers should check with
 * findByProviderIdentity first to decide whether that's actually a conflict
 * (same user reconnecting) or a real conflict (different user), but this
 * still guards the race at the database level.
 */
async function createIdentity({
  userId,
  provider,
  providerId,
  canLogin = true,
  email = '',
  emailVerifiedByProvider = false,
  displayName = '',
  username = '',
  avatarUrl = '',
  profile = {},
  metadata = {},
  linkedVia = 'signup'
}, { session } = {}) {
  try {
    const doc = {
      userId,
      provider,
      providerId,
      canLogin,
      email,
      emailVerifiedByProvider,
      displayName,
      username,
      avatarUrl,
      profile,
      metadata,
      linkedVia,
      lastUsedAt: new Date()
    };

    if (session) {
      const identities = await Identity.create([doc], { session });
      return identities[0];
    }

    return await Identity.create(doc);
  } catch (error) {
    if (error && error.code === 11000) {
      if (provider === 'riot' && error.keyPattern && error.keyPattern.userId && error.keyPattern.provider) {
        throw new RiotAccountAlreadyConnectedError();
      }
      throw new IdentityAlreadyLinkedError(provider);
    }
    throw error;
  }
}

async function updateIdentity(identityId, updates, { session } = {}) {
  return applySession(Identity.findByIdAndUpdate(identityId, { $set: updates }, { new: true }), session);
}

async function touchLastUsed(identityId, { session } = {}) {
  return applySession(Identity.findByIdAndUpdate(identityId, { $set: { lastUsedAt: new Date() } }), session);
}

async function deleteIdentity(identityId, { session } = {}) {
  return applySession(Identity.findByIdAndDelete(identityId), session);
}

module.exports = {
  findByProviderIdentity,
  findByUser,
  createIdentity,
  updateIdentity,
  touchLastUsed,
  deleteIdentity,
  IdentityAlreadyLinkedError,
  RiotAccountAlreadyConnectedError
};
