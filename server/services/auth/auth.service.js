const User = require('../../models/User');
const identityService = require('./identity.service');
const legacy = require('./legacy-identity.service');
const { isValidProvider } = require('../../config/providers.config');

async function generateUniqueUsername(seed, session) {
  const base = (String(seed || 'user').toLowerCase().replace(/[^a-z0-9]/g, '') || 'user').slice(0, 22).padEnd(3, '0');
  let username = base;
  for (let counter = 1; await User.findOne({ username }).session(session || null); counter++) username = `${base}${counter}`;
  return username;
}

function assertActive(user) {
  if (!user || !user.isActive) throw Object.assign(new Error('Account is unavailable'), { code: 'ACCOUNT_UNAVAILABLE' });
}

// Resolve by provider subject, never by matching email. A legacy subject is
// migrated only when that exact external account successfully authenticates.
async function loginWithIdentity(provider, normalized) {
  if (!isValidProvider(provider) || typeof normalized?.providerId !== 'string' || !normalized.providerId.trim()) {
    throw Object.assign(new Error('Invalid provider identity'), { code: 'PROVIDER_AUTH_FAILED' });
  }
  await identityService.ready();
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await identityService.transaction(async session => {
        const existing = await identityService.findByProviderIdentity(provider, normalized.providerId, { session });
        if (existing) {
          const user = await User.findByIdAndUpdate(existing.userId, { $inc: { __v: 1 } }, { new: true, session });
          assertActive(user);
          if (!existing.canLogin) throw Object.assign(new Error('Identity cannot sign in'), { code: 'ACCOUNT_UNAVAILABLE' });
          await identityService.touchLastUsed(existing._id, { session });
          return { user, identity: existing, isNewUser: false };
        }
        let user = await legacy.findOwner(provider, normalized.providerId, session);
        const migrated = Boolean(user);
        if (user) {
          user = await User.findByIdAndUpdate(user._id, { $inc: { __v: 1 } }, { new: true, session });
          assertActive(user);
          if (!legacy.fromUser(user, provider)) throw Object.assign(new Error('Provider was disconnected'), { code: 'ACCOUNT_UNAVAILABLE' });
        } else {
          const email = (normalized.email || '').trim().toLowerCase();
          if (email && await User.findOne({ email }).session(session)) {
            throw Object.assign(new Error(`Log in with your existing method and connect ${provider} in account settings.`), {
              code: 'ACCOUNT_LINK_REQUIRED', provider
            });
          }
          const username = await generateUniqueUsername(normalized.username || normalized.displayName, session);
          const displayName = String(normalized.displayName || '').trim().slice(0, 50);
          [user] = await User.create([{
            username, fullName: displayName.length >= 3 ? displayName : username,
            email: email || `${normalized.providerId}@${provider}.invalid`,
            avatarUrl: normalized.avatarUrl || '', isEmailVerified: Boolean(email && normalized.emailVerifiedByProvider), authProvider: provider
          }], { session });
        }
        const identity = await identityService.createIdentity({
          ...normalized, userId: user._id, provider, canLogin: true,
          createdAt: migrated ? legacy.fromUser(user, provider).createdAt : undefined,
          profile: { ...(migrated ? legacy.fromUser(user, provider).profile : {}), ...normalized.profile },
          metadata: { ...(migrated ? legacy.fromUser(user, provider).metadata : {}), ...normalized.metadata },
          linkedVia: migrated ? 'migrated' : 'signup'
        }, { session });
        const compatibility = legacy.compatibilityUpdate(provider, normalized);
        if (compatibility) await User.updateOne({ _id: user._id }, compatibility, { session });
        return { user, identity, isNewUser: !migrated };
      });
    } catch (error) {
      if (attempt < 3 && (error.code === 11000 || error.code === 'IDENTITY_ALREADY_LINKED')) continue;
      throw error;
    }
  }
}

module.exports = { loginWithIdentity, generateUniqueUsername };
