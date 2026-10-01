const test = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('./account-linking.service');
const identityServicePath = require.resolve('./identity.service');
const userModelPath = require.resolve('../../models/User');

function loadServiceWithMocks({ identities = [], user = { passwordHash: 'hash' } } = {}) {
  const calls = {
    created: [],
    touched: [],
    deletedIdentities: []
  };

  class IdentityAlreadyLinkedError extends Error {
    constructor(provider) {
      super(`This ${provider} account is already connected to another user.`);
      this.code = 'IDENTITY_ALREADY_LINKED';
    }
  }

  const identityServiceMock = {
    IdentityAlreadyLinkedError,
    findByProviderIdentity: async (provider, providerId) =>
      identities.find((identity) => identity.provider === provider && identity.providerId === providerId) || null,
    findByUser: async () => identities,
    createIdentity: async (identity) => {
      calls.created.push(identity);
      return { _id: 'new-identity', ...identity };
    },
    touchLastUsed: async (identityId) => {
      calls.touched.push(identityId);
    },
    deleteIdentity: async (identityId) => {
      calls.deletedIdentities.push(identityId);
    }
  };

  const UserMock = {
    findById: () => ({
      select: async () => user
    })
  };

  delete require.cache[servicePath];
  require.cache[identityServicePath] = { exports: identityServiceMock };
  require.cache[userModelPath] = { exports: UserMock };

  return { service: require('./account-linking.service'), calls };
}

const steamIdentity = {
  providerId: 'steam-id-123',
  displayName: 'SteamUser',
  avatarUrl: 'https://example.com/avatar.jpg',
  profile: { profileUrl: 'https://steamcommunity.com/id/steam-user' },
  metadata: { lastSync: new Date('2026-01-01T00:00:00.000Z') }
};

test('connectIdentity creates a generic linked provider identity', async () => {
  const { service, calls } = loadServiceWithMocks();

  await service.connectIdentity('user-a', 'steam', steamIdentity);

  assert.equal(calls.created[0].provider, 'steam');
  assert.equal(calls.created[0].providerId, 'steam-id-123');
  assert.equal(calls.created[0].canLogin, true);
  assert.deepEqual(calls.created[0].profile, steamIdentity.profile);
});

test('connectIdentity rejects an external account linked to another user', async () => {
  const { service } = loadServiceWithMocks({
    identities: [{ _id: 'identity-a', userId: 'user-a', provider: 'steam', providerId: 'steam-id-123' }]
  });

  await assert.rejects(
    () => service.connectIdentity('user-b', 'steam', steamIdentity),
    { code: 'IDENTITY_ALREADY_LINKED' }
  );
});

test('connectIdentity touches same-user existing provider identity', async () => {
  const { service, calls } = loadServiceWithMocks({
    identities: [{ _id: 'identity-a', userId: 'user-a', provider: 'steam', providerId: 'steam-id-123' }]
  });

  const result = await service.connectIdentity('user-a', 'steam', steamIdentity);

  assert.equal(result.alreadyConnected, true);
  assert.deepEqual(calls.touched, ['identity-a']);
  assert.equal(calls.created.length, 0);
});

test('disconnectIdentity removes a provider identity when another login method remains', async () => {
  const { service, calls } = loadServiceWithMocks({
    identities: [{ _id: 'steam-identity', userId: 'user-a', provider: 'steam', providerId: 'steam-id-123', canLogin: true }]
  });

  await service.disconnectIdentity('user-a', 'steam');

  assert.deepEqual(calls.deletedIdentities, ['steam-identity']);
});

test('sanitizeRedirectPath only permits relative app paths', () => {
  const { service } = loadServiceWithMocks();

  assert.equal(service.sanitizeRedirectPath('/profile/settings?tab=gameids'), '/profile/settings?tab=gameids');
  assert.equal(service.sanitizeRedirectPath('https://evil.example'), '');
  assert.equal(service.sanitizeRedirectPath('//evil.example'), '');
  assert.equal(service.sanitizeRedirectPath('/\\evil'), '');
});

test('consumeConnectIntent rejects wrong provider and expired intents', () => {
  const { service } = loadServiceWithMocks();

  const wrongProviderReq = { session: {} };
  service.issueConnectIntent(wrongProviderReq, 'user-a', 'steam', '/profile/settings');
  assert.equal(service.consumeConnectIntent(wrongProviderReq, 'xbox'), null);

  const expiredReq = {
    session: {
      connectIntent: {
        userId: 'user-a',
        provider: 'steam',
        redirectPath: '/profile/settings',
        issuedAt: Date.now() - (11 * 60 * 1000)
      }
    }
  };
  assert.equal(service.consumeConnectIntent(expiredReq, 'steam'), null);
});
