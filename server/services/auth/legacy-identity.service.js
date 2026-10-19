const User = require('../../models/User');

function fromUser(user, provider) {
  const profile = provider === 'google' ? user.socialAccounts?.google : provider === 'steam' ? user.steamProfile : null;
  const providerId = provider === 'google' ? profile?.id : profile?.steamId;
  // Old Passport logins matched the stored subject even when isConnected had
  // its default false value. New disconnects remove the subject itself.
  if (!providerId) return null;
  return { userId: user._id, provider, providerId, canLogin: true, legacy: true,
    email: provider === 'google' ? profile.email || user.email : '',
    emailVerifiedByProvider: provider === 'google' && Boolean(user.isEmailVerified),
    displayName: profile.name || profile.displayName || user.username,
    avatarUrl: profile.picture || profile.avatar || user.avatarUrl || '',
    profile: { profileUrl: profile.profileUrl || '', realName: profile.realName || '', countryCode: profile.countryCode || '' },
    metadata: { steamGames: user.steamGames }, createdAt: profile.connectedAt || user.createdAt };
}

async function findOwner(provider, providerId, session) {
  const field = provider === 'google' ? 'socialAccounts.google.id' : provider === 'steam' ? 'steamProfile.steamId' : null;
  if (!field) return null;
  const users = await User.find({ [field]: providerId }).limit(2).session(session || null);
  const owners = users.filter(user => fromUser(user, provider));
  if (owners.length > 1) throw Object.assign(new Error('Legacy provider ownership requires review'), { code: 'IDENTITY_ALREADY_LINKED' });
  return owners[0] || null;
}

function clearUpdate(provider) {
  if (provider === 'google') return { $unset: { 'socialAccounts.google': '' } };
  if (provider === 'steam') return { $unset: { steamProfile: '', steamGames: '' } };
  return null;
}

function compatibilityUpdate(provider, normalized) {
  if (provider === 'steam') return { $set: {
    'steamProfile.steamId': normalized.providerId,
    'steamProfile.displayName': normalized.displayName || '',
    'steamProfile.profileUrl': normalized.profile?.profileUrl || '',
    'steamProfile.avatar': normalized.avatarUrl || '',
    'steamProfile.countryCode': normalized.profile?.countryCode || '',
    'steamProfile.realName': normalized.profile?.realName || '',
    'steamProfile.isConnected': true,
    'gameIds.steam': normalized.providerId
  } };
  return null;
}

module.exports = { fromUser, findOwner, clearUpdate, compatibilityUpdate };
