const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getCompetitiveHistory,
  normalizePagination
} = require('./competitive-history.service');
const {
  normalizeMatchResult
} = require('./adapters/bgmi-history.adapter');
const {
  getCs2History,
  resolveSteamAccountId
} = require('./adapters/cs2-history.adapter');

const findOneModel = (value) => ({
  findOne: () => ({
    select() {
      return this;
    },
    lean() {
      return Promise.resolve(value);
    }
  })
});

const baseUser = {
  _id: 'user-a',
  username: 'any5',
  gameIds: {},
  steamProfile: {}
};

const emptyAdapters = {
  getTournamentHistory: async () => [],
  getBgmiHistory: async () => [],
  getCs2History: async () => []
};

test('unknown user returns a 404-shaped error', async () => {
  await assert.rejects(
    () => getCompetitiveHistory('missing', {
      models: { User: findOneModel(null) },
      adapters: emptyAdapters
    }),
    (error) => error.status === 404 && error.message === 'Player not found'
  );
});

test('empty history returns an empty public-safe list', async () => {
  const result = await getCompetitiveHistory('any5', {
    models: { User: findOneModel(baseUser) },
    adapters: emptyAdapters
  });

  assert.deepEqual(result.history, []);
  assert.deepEqual(result.pagination, {
    page: 1,
    limit: 12,
    total: 0,
    hasMore: false
  });
});

test('tournament-only history is returned without fake result stats', async () => {
  const result = await getCompetitiveHistory('valorant-only', {
    models: { User: findOneModel(baseUser) },
    adapters: {
      ...emptyAdapters,
      getTournamentHistory: async () => [{
        id: 'tournament-registration-a',
        source: { type: 'tournament_registration', id: 'registration-a' },
        level: 'tournament',
        gameType: 'valorant',
        tournament: { id: 'tournament-a', name: 'Valorant Cup' },
        team: { entityType: 'registration', entityId: 'registration-a', name: 'Five Stack' },
        occurredAt: '2026-01-02T00:00:00.000Z',
        status: 'verified',
        confidence: 'participation_only',
        result: null
      }]
    }
  });

  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].confidence, 'participation_only');
  assert.equal(result.history[0].result, null);
});

test('BGMI verified match history uses team-level placement data only', () => {
  const event = normalizeMatchResult({
    match: {
      _id: 'match-a',
      tournamentId: { _id: 'tournament-a', name: 'BGMI Finals' },
      endTime: '2026-01-05T00:00:00.000Z',
      roomPassword: 'private-room-secret'
    },
    teamResult: {
      teamId: 'team-a',
      teamName: 'Alpha',
      placement: 1,
      kills: 18,
      points: 28,
      verified: true,
      screenshots: [{ url: 'private-screenshot' }]
    }
  });

  assert.equal(event.confidence, 'verified_result');
  assert.deepEqual(event.result.data, {
    placement: 1,
    kills: 18,
    points: 28,
    verified: true
  });
  assert.equal(JSON.stringify(event).includes('private-room-secret'), false);
  assert.equal(JSON.stringify(event).includes('private-screenshot'), false);
});

test('CS2 mapped history aggregates final per-match server-log rows', async () => {
  const history = await getCs2History({
    user: {
      steamProfile: { isConnected: true, steamId: '76561197960265729' },
      gameIds: {}
    },
    limit: 5,
    models: {
      CS2Match: {
        aggregate: async () => [{
          _id: 'dust2-1',
          kills: 12,
          deaths: 9,
          assists: 4,
          damage: 1800,
          mvp: 2,
          map: 'de_dust2',
          matchNumber: 7,
          occurredAt: new Date('2026-01-06T00:00:00.000Z'),
          finalRound: 13
        }]
      }
    }
  });

  assert.equal(history.length, 1);
  assert.equal(history[0].confidence, 'server_log');
  assert.equal(history[0].result.type, 'stat_summary');
  assert.equal(history[0].result.data.matchId, 'dust2-1');
});

test('Steam mapping failure omits CS2 history instead of guessing', async () => {
  assert.equal(resolveSteamAccountId({
    steamProfile: { isConnected: false, steamId: '' },
    gameIds: { steam: 'not-a-steam-id' }
  }), null);

  const history = await getCs2History({
    user: {
      steamProfile: { isConnected: false, steamId: '' },
      gameIds: { steam: 'not-a-steam-id' }
    },
    limit: 5,
    models: {
      CS2Match: {
        aggregate: async () => {
          throw new Error('aggregate should not run without a defensible mapping');
        }
      }
    }
  });

  assert.deepEqual(history, []);
});

test('deduplication, newest-first ordering, and pagination are applied globally', async () => {
  const result = await getCompetitiveHistory('any5', {
    limit: 2,
    models: { User: findOneModel(baseUser) },
    adapters: {
      getTournamentHistory: async () => [
        { id: 'old', occurredAt: '2026-01-01T00:00:00.000Z' },
        { id: 'duplicate', occurredAt: '2026-01-03T00:00:00.000Z' }
      ],
      getBgmiHistory: async () => [
        { id: 'new', occurredAt: '2026-01-05T00:00:00.000Z' },
        { id: 'duplicate', occurredAt: '2026-01-04T00:00:00.000Z' }
      ],
      getCs2History: async () => [
        { id: 'middle', occurredAt: '2026-01-02T00:00:00.000Z' }
      ]
    }
  });

  assert.deepEqual(result.history.map((item) => item.id), ['new', 'duplicate']);
  assert.equal(result.pagination.total, 4);
  assert.equal(result.pagination.hasMore, true);
});

test('pagination limit is capped to the public endpoint maximum', () => {
  assert.deepEqual(normalizePagination({ page: '2', limit: '500' }), {
    page: 2,
    limit: 30
  });
});
