const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.REDIS_DISABLED = 'true';
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const redis = require('../services/redisService');
const router = require('./users');

test('player directory excludes emails from searches, lists and cached results', async t => {
  const player = { _id: 'player-id', username: 'Player', email: 'private@example.test', friends: [] };
  const cache = new Map([['players:v4:viewer:all:all:1:20', { players: [player] }]]);
  t.mock.method(redis, 'get', async key => cache.get(key));
  t.mock.method(redis, 'set', async (key, value) => cache.set(key, value));
  t.mock.method(User, 'countDocuments', async () => 1);
  let selectedFields;
  let pipeline;
  const query = {
    select(fields) { selectedFields = fields; return this; },
    skip() { return this; }, limit() { return this; },
    async lean() { return [player]; }
  };
  t.mock.method(User, 'find', () => query);
  t.mock.method(User, 'aggregate', async stages => { pipeline = stages; return [player]; });
  t.mock.method(FriendRequest, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  const handler = router.stack.find(layer => layer.route?.path === '/players').route.stack.at(-1).handle;
  const invoke = async queryParams => {
    let response;
    await handler({ query: queryParams, user: { userId: 'viewer' } }, {
      json(body) { response = body; },
      status(code) { assert.fail(`Unexpected HTTP ${code}`); }
    });
    assert.equal(response.success, true);
    assert.equal(response.data.players[0].username, 'Player');
    assert.equal(JSON.stringify(response).includes('private@example.test'), false);
    assert.equal(Object.hasOwn(response.data.players[0], 'email'), false);
    return response;
  };
  assert.equal((await invoke({})).cached, false);
  assert.equal(selectedFields.split(' ').includes('email'), false);
  assert.equal((await invoke({})).cached, true);
  await invoke({ search: 'Player' });
  assert.equal(Object.hasOwn(pipeline.find(stage => stage.$project).$project, 'email'), false);
});
