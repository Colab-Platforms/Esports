const User = require('../../models/User');
const identityService = require('./identity.service');

/**
 * Normalized shape every provider adapter must produce:
 * {
 *   providerId, email, emailVerifiedByProvider, displayName, username,
 *   avatarUrl, profile, metadata
 * }
 */

async function generateUniqueUsername(seed) {
  const base = String(seed || 'user')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'user';

  let username = base;
  let counter = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await User.findOne({ username })) {
    counter += 1;
    username = `${base}${counter}`;
  }
  return username;
}

/**
 * "Continue with <provider>" - log in if the identity already exists,
 * otherwise create a brand-new User + Identity. Never used for attaching a
 * provider to an already-logged-in user - see account-linking.service.js's
 * connectIdentity for that.
 */
async function loginWithIdentity(provider, normalizedIdentity) {
  const existing = await identityService.findByProviderIdentity(provider, normalizedIdentity.providerId);

  if (existing) {
    await identityService.touchLastUsed(existing._id);
    const user = await User.findById(existing.userId);
    return { user, identity: existing, isNewUser: false };
  }

  // No identity yet - if this would collide with an existing account by
  // email, do NOT silently attach the provider to it. This replaces the old
  // passport.js behavior that auto-linked Google to any account sharing its
  // email with no consent step (see the architecture audit, Phase 3 fix).
  // The user must log in with their existing method and connect the new
  // provider explicitly from account settings. Providers with no email
  // (Steam) never reach this branch, since normalizedIdentity.email is ''.
  if (normalizedIdentity.email) {
    const collidingUser = await User.findOne({ email: normalizedIdentity.email.toLowerCase() });
    if (collidingUser) {
      const error = new Error(`An account with this email already exists. Log in and connect ${provider} from your account settings instead.`);
      error.code = 'ACCOUNT_LINK_REQUIRED';
      error.provider = provider;
      error.email = normalizedIdentity.email;
      throw error;
    }
  }

  const user = await User.create({
    username: await generateUniqueUsername(normalizedIdentity.username || normalizedIdentity.displayName),
    fullName: normalizedIdentity.displayName || '',
    email: normalizedIdentity.email || `${normalizedIdentity.providerId}@${provider}.local`,
    avatarUrl: normalizedIdentity.avatarUrl || '',
    isEmailVerified: Boolean(normalizedIdentity.emailVerifiedByProvider),
    authProvider: provider
  });

  const identity = await identityService.createIdentity({
    userId: user._id,
    provider,
    providerId: normalizedIdentity.providerId,
    canLogin: true,
    email: normalizedIdentity.email || '',
    emailVerifiedByProvider: Boolean(normalizedIdentity.emailVerifiedByProvider),
    displayName: normalizedIdentity.displayName || '',
    username: normalizedIdentity.username || '',
    avatarUrl: normalizedIdentity.avatarUrl || '',
    profile: normalizedIdentity.profile || {},
    metadata: normalizedIdentity.metadata || {},
    linkedVia: 'signup'
  });

  return { user, identity, isNewUser: true };
}

module.exports = {
  loginWithIdentity,
  generateUniqueUsername
};
