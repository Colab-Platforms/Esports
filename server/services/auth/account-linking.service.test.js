const test = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('./account-linking.service');
const identityServicePath = require.resolve('./identity.service');
const userModelPath = require.resolve('../../models/User');
const verifiedGameIdServicePath = require.resolve('./verified-game-id.service');

function loadServiceWithMocks({ identities = [], user = { passwordHash: 'hash' }, failUserSync = false, failIdentityCreate = false } = {}) {
  const calls = {
    created: [],
    updatedIdentities: [],
    updatedUsers: [],
    deletedIdentities: []
  };

  class IdentityAlreadyLinkedError extends Error {
    constructor(provider) {
      super(`This ${provider} account is already connected to another user.`);
      this.code = 'IDENTITY_ALREADY_LINKED';
    }
  }

  class RiotAccountAlreadyConnectedError extends Error {
    constructor() {
      super('A different Riot account is already connected. Disconnect it before connecting another Riot account.');
      this.code = 'RIOT_ACCOUNT_ALREADY_CONNECTED';
    }
  }

  const identityServiceMock = {
    IdentityAlreadyLinkedError,
    RiotAccountAlreadyConnectedError,
    findByProviderIdentity: async (provider, providerId) =>
      identities.find((identity) => identity.provider === provider && identity.providerId === providerId) || null,
    findByUser: async () => identities,
    createIdentity: async (identity) => {
      if (failIdentityCreate) {
        const error = new Error('identity create failed');
        error.code = 'IDENTITY_CREATE_FAILED';
        throw error;
      }
      calls.created.push(identity);
      return { _id: 'new-identity', ...identity };
    },
    updateIdentity: async (identityId, updates) => {
      calls.updatedIdentities.push({ identityId, updates });
      return { _id: identityId, ...updates };
    },
    touchLastUsed: async () => {},
    deleteIdentity: async (identityId) => {
      calls.deletedIdentities.push(identityId);
    }
  };

  const UserMock = {
    findByIdAndUpdate: async (userId, update) => {
      if (failUserSync) {
        throw new Error('user sync failed');
      }
      calls.updatedUsers.push({ userId, update });
      return { _id: userId, gameIds: { valorant: update.$set['gameIds.valorant'] } };
    },
    findById: () => ({
      select: async () => user
    })
  };

  delete require.cache[servicePath];
  require.cache[identityServicePath] = { exports: identityServiceMock };
  require.cache[userModelPath] = { exports: UserMock };
  delete require.cache[verifiedGameIdServicePath];

  return { service: require('./account-linking.service'), calls };
}

const riotIdentity = {
  providerId: 'riot-puuid-123',
  canLogin: false,
  displayName: 'RealName#IND',
  profile: { gameName: 'RealName', tagLine: 'IND' },
  metadata: { verifiedAt: new Date('2026-01-01T00:00:00.000Z') }
};

test('connectIdentity stores Riot with canLogin false and syncs User.gameIds.valorant', async () => {
  const { service, calls } = loadServiceWithMocks();

  await service.connectIdentity('user-a', 'riot', riotIdentity);

  assert.equal(calls.created[0].provider, 'riot');
  assert.equal(calls.created[0].providerId, 'riot-puuid-123');
  assert.equal(calls.created[0].canLogin, false);
  assert.deepEqual(calls.created[0].profile, { gameName: 'RealName', tagLine: 'IND' });
  assert.deepEqual(calls.updatedUsers[0], {
    userId: 'user-a',
    update: { $set: { 'gameIds.valorant': 'RealName#IND' } }
  });
});

test('connectIdentity rejects a Riot PUUID already linked to another user', async () => {
  const { service } = loadServiceWithMocks({
    identities: [{ _id: 'identity-a', userId: 'user-a', provider: 'riot', providerId: 'riot-puuid-123' }]
  });

  await assert.rejects(
    () => service.connectIdentity('user-b', 'riot', riotIdentity),
    { code: 'IDENTITY_ALREADY_LINKED' }
  );
});

test('connectIdentity refreshes same-user Riot display data for an existing PUUID', async () => {
  const { service, calls } = loadServiceWithMocks({
    identities: [{
      _id: 'identity-a',
      userId: 'user-a',
      provider: 'riot',
      providerId: 'riot-puuid-123',
      displayName: 'OldName#OLD',
      profile: { gameName: 'OldName', tagLine: 'OLD' },
      metadata: {}
    }]
  });

  await service.connectIdentity('user-a', 'riot', riotIdentity);

  assert.equal(calls.created.length, 0);
  assert.equal(calls.updatedIdentities[0].identityId, 'identity-a');
  assert.equal(calls.updatedIdentities[0].updates.displayName, 'RealName#IND');
  assert.deepEqual(calls.updatedUsers[0].update, { $set: { 'gameIds.valorant': 'RealName#IND' } });
});

test('connectIdentity rejects a different Riot PUUID for a user that already has Riot connected', async () => {
  const { service } = loadServiceWithMocks({
    identities: [{
      _id: 'identity-a',
      userId: 'user-a',
      provider: 'riot',
      providerId: 'old-puuid',
      displayName: 'OldName#OLD',
      profile: { gameName: 'OldName', tagLine: 'OLD' },
      metadata: {}
    }]
  });

  await assert.rejects(
    () => service.connectIdentity('user-a', 'riot', riotIdentity),
    { code: 'RIOT_ACCOUNT_ALREADY_CONNECTED' }
  );
});

test('connectIdentity rolls back new Riot Identity if trusted game ID sync fails', async () => {
  const { service, calls } = loadServiceWithMocks({ failUserSync: true });

  await assert.rejects(
    () => service.connectIdentity('user-a', 'riot', riotIdentity),
    /user sync failed/
  );

  assert.equal(calls.created.length, 1);
  assert.deepEqual(calls.deletedIdentities, ['new-identity']);
});

test('connectIdentity leaves User.gameIds unchanged if Riot Identity creation fails', async () => {
  const { service, calls } = loadServiceWithMocks({ failIdentityCreate: true });

  await assert.rejects(
    () => service.connectIdentity('user-a', 'riot', riotIdentity),
    { code: 'IDENTITY_CREATE_FAILED' }
  );

  assert.equal(calls.updatedUsers.length, 0);
});

test('disconnectIdentity removes Riot Identity and does not clear User.gameIds.valorant', async () => {
  const { service, calls } = loadServiceWithMocks({
    identities: [{ _id: 'riot-identity', userId: 'user-a', provider: 'riot', providerId: 'riot-puuid-123', canLogin: false }]
  });

  await service.disconnectIdentity('user-a', 'riot');

  assert.deepEqual(calls.deletedIdentities, ['riot-identity']);
  assert.equal(calls.updatedUsers.length, 0);
});

test('sanitizeRedirectPath only permits relative app paths', () => {
  const { service } = loadServiceWithMocks();

  assert.equal(service.sanitizeRedirectPath('/profile/settings?tab=gameids'), '/profile/settings?tab=gameids');
  assert.equal(service.sanitizeRedirectPath('https://evil.example'), '');
  assert.equal(service.sanitizeRedirectPath('//evil.example'), '');
  assert.equal(service.sanitizeRedirectPath('/\\evil'), '');
});

test('consumeConnectIntent rejects wrong provider and expired Riot intents', () => {
  const { service } = loadServiceWithMocks();

  const wrongProviderReq = { session: {} };
  service.issueConnectIntent(wrongProviderReq, 'user-a', 'steam', '/profile/settings');
  assert.equal(service.consumeConnectIntent(wrongProviderReq, 'riot'), null);

  const expiredReq = {
    session: {
      connectIntent: {
        userId: 'user-a',
        provider: 'riot',
        redirectPath: '/profile/settings',
        issuedAt: Date.now() - (11 * 60 * 1000)
      }
    }
  };
  assert.equal(service.consumeConnectIntent(expiredReq, 'riot'), null);
});
