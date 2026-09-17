const Identity = require('../../models/Identity');
const User = require('../../models/User');

function applySession(query, session) {
  return session && typeof query.session === 'function' ? query.session(session) : query;
}

function formatRiotGameId(identity) {
  const gameName = identity && identity.profile && identity.profile.gameName;
  const tagLine = identity && identity.profile && identity.profile.tagLine;
  return gameName && tagLine ? `${gameName}#${tagLine}` : '';
}

async function findRiotIdentity(userId, { session } = {}) {
  const query = Identity.findOne({ userId, provider: 'riot' });
  return applySession(query, session);
}

async function getTrustedRiotGameId(userId, options = {}) {
  const identity = await findRiotIdentity(userId, options);
  return formatRiotGameId(identity);
}

async function syncTrustedRiotGameId(userId, normalizedIdentity, { session } = {}) {
  const trustedGameId = formatRiotGameId(normalizedIdentity);
  if (!trustedGameId) {
    const error = new Error('Riot account did not include a complete Riot ID.');
    error.code = 'RIOT_PROFILE_INCOMPLETE';
    throw error;
  }

  const query = User.findByIdAndUpdate(
    userId,
    { $set: { 'gameIds.valorant': trustedGameId } },
    { new: true }
  );
  const updatedUser = await applySession(query, session);

  if (!updatedUser) {
    const error = new Error('User not found while synchronizing Riot ID.');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  return trustedGameId;
}

async function applyUntrustedValorantUpdate(userId, update, requestedValorantId, { session } = {}) {
  if (requestedValorantId === undefined) return { protected: false, trustedGameId: '' };

  const trustedGameId = await getTrustedRiotGameId(userId, { session });
  update['gameIds.valorant'] = trustedGameId || requestedValorantId;

  return {
    protected: Boolean(trustedGameId),
    trustedGameId
  };
}

module.exports = {
  applyUntrustedValorantUpdate,
  findRiotIdentity,
  formatRiotGameId,
  getTrustedRiotGameId,
  syncTrustedRiotGameId
};
