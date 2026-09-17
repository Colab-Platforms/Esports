const test = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('./verified-game-id.service');
const identityModelPath = require.resolve('../../models/Identity');
const userModelPath = require.resolve('../../models/User');

function loadServiceWithMocks({ identity = null, userUpdateResult = { _id: 'user-a' } } = {}) {
  const calls = { userUpdates: [] };

  const IdentityMock = {
    findOne: () => Promise.resolve(identity)
  };

  const UserMock = {
    findByIdAndUpdate: (userId, update, options) => {
      calls.userUpdates.push({ userId, update, options });
      return Promise.resolve(userUpdateResult);
    }
  };

  delete require.cache[servicePath];
  require.cache[identityModelPath] = { exports: IdentityMock };
  require.cache[userModelPath] = { exports: UserMock };

  return { service: require('./verified-game-id.service'), calls };
}

test('applyUntrustedValorantUpdate preserves trusted Riot ID for verified users', async () => {
  const { service } = loadServiceWithMocks({
    identity: { provider: 'riot', profile: { gameName: 'Trusted', tagLine: 'IN' } }
  });
  const update = {};

  const result = await service.applyUntrustedValorantUpdate('user-a', update, 'Manual#123');

  assert.equal(result.protected, true);
  assert.equal(update['gameIds.valorant'], 'Trusted#IN');
});

test('applyUntrustedValorantUpdate allows manual Valorant ID when no Riot identity exists', async () => {
  const { service } = loadServiceWithMocks();
  const update = {};

  const result = await service.applyUntrustedValorantUpdate('user-a', update, 'Manual#123');

  assert.equal(result.protected, false);
  assert.equal(update['gameIds.valorant'], 'Manual#123');
});

test('syncTrustedRiotGameId fails cleanly before creating partial trusted state for incomplete Riot profile', async () => {
  const { service, calls } = loadServiceWithMocks();

  await assert.rejects(
    () => service.syncTrustedRiotGameId('user-a', { profile: { gameName: 'OnlyName' } }),
    { code: 'RIOT_PROFILE_INCOMPLETE' }
  );

  assert.equal(calls.userUpdates.length, 0);
});

test('syncTrustedRiotGameId rejects if the user update cannot find a user', async () => {
  const { service } = loadServiceWithMocks({ userUpdateResult: null });

  await assert.rejects(
    () => service.syncTrustedRiotGameId('missing-user', { profile: { gameName: 'Real', tagLine: 'TAG' } }),
    { code: 'USER_NOT_FOUND' }
  );
});
