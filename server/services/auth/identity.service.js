const Identity = require('../../models/Identity');

class IdentityAlreadyLinkedError extends Error {
  constructor(provider) {
    super(`This ${provider} account is already connected to another user.`);
    this.name = 'IdentityAlreadyLinkedError';
    this.code = 'IDENTITY_ALREADY_LINKED';
  }
}

/**
 * Find the Identity for a given (provider, providerId) pair, or null.
 */
async function findByProviderIdentity(provider, providerId) {
  return Identity.findOne({ provider, providerId });
}

/**
 * All identities connected to a given application user.
 */
async function findByUser(userId) {
  return Identity.find({ userId }).sort({ createdAt: 1 });
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
}) {
  try {
    return await Identity.create({
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
    });
  } catch (error) {
    if (error && error.code === 11000) {
      throw new IdentityAlreadyLinkedError(provider);
    }
    throw error;
  }
}

async function updateIdentity(identityId, updates) {
  return Identity.findByIdAndUpdate(identityId, { $set: updates }, { new: true });
}

async function touchLastUsed(identityId) {
  return Identity.findByIdAndUpdate(identityId, { $set: { lastUsedAt: new Date() } });
}

async function deleteIdentity(identityId) {
  return Identity.findByIdAndDelete(identityId);
}

module.exports = {
  findByProviderIdentity,
  findByUser,
  createIdentity,
  updateIdentity,
  touchLastUsed,
  deleteIdentity,
  IdentityAlreadyLinkedError
};
