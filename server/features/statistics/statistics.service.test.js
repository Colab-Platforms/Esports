const assert = require('node:assert/strict');
const test = require('node:test');
const { COVERAGE_NOTE } = require('./statistics.constants');
const { getPlayerStatistics, getTeamStatistics } = require('./statistics.service');
const {
  summarizeBgmiTeamResults
} = require('./adapters/bgmi-statistics.adapter');
const {
  getFreeFirePlayerStatistics,
  summarizeFreeFirePlayerRows,
  summarizeFreeFireTeamResults
} = require('./adapters/freefire-statistics.adapter');
const {
  getValorantPlayerStatistics,
  summarizeValorantSides
} = require('./adapters/valorant-statistics.adapter');

const chain = (value) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); }
});

const emptyFindModel = () => ({
  find: () => chain([]),
  findOne: () => chain(null),
  distinct: async () => [],
  countDocuments: async () => 0
});

test('unknown player returns 404-shaped error', async () => {
  await assert.rejects(
    () => getPlayerStatistics('missing', {
      models: {
        User: { findOne: () => chain(null) }
      }
    }),
    (error) => error.status === 404 && error.message === 'Player not found'
  );
});

test('player statistics include coverage note and zero overview without fake unsupported stats', async () => {
  const result = await getPlayerStatistics('any5', {
    models: {
      User: { findOne: () => chain({ _id: 'user-a', username: 'any5', isActive: true, profileVisibility: 'public' }) },
      TournamentRegistration: emptyFindModel(),
      Tournament: emptyFindModel(),
      Team: emptyFindModel(),
      FreeFireMatchResult: emptyFindModel(),
      ValorantMatchResult: emptyFindModel()
    }
  });

  assert.equal(result.coverage.note, COVERAGE_NOTE);
  assert.equal(result.overview.verifiedResultParticipations, 0);
  assert.equal(result.overview.gamesWithStats, 0);
  assert.equal(result.games.bgmi.performance.totalKills.supported, false);
  assert.equal(result.games.freefire.performance.playerKills.supported, false);
  assert.equal(result.games.valorant.performance.personalKills.supported, false);
});

test('invalid team id returns 404-shaped error', async () => {
  await assert.rejects(
    () => getTeamStatistics('not-a-team-id'),
    (error) => error.status === 404 && error.message === 'Team not found'
  );
});

test('BGMI team aggregation uses verified team-row fields only', () => {
  const stats = summarizeBgmiTeamResults([
    {
      match: { endTime: '2026-01-02T00:00:00.000Z' },
      teamResult: { placement: 1, kills: 10, points: 20 }
    },
    {
      match: { endTime: '2026-01-01T00:00:00.000Z' },
      teamResult: { placement: 4, kills: 2, points: 6 }
    }
  ]);

  assert.equal(stats.matchesPlayed, 2);
  assert.equal(stats.totalKills, 12);
  assert.equal(stats.averageKills, 6);
  assert.equal(stats.averagePlacement, 2.5);
  assert.equal(stats.bestPlacement, 1);
  assert.equal(stats.wins, 1);
  assert.equal(stats.top3Finishes, 1);
  assert.equal(stats.top5Finishes, 2);
  assert.equal(stats.totalPoints, 26);
  assert.equal(stats.averagePoints, 13);
  assert.deepEqual(stats.recentForm.map((item) => item.placement), [1, 4]);
});

test('Free Fire team aggregation keeps team kills at team level', () => {
  const stats = summarizeFreeFireTeamResults([
    {
      match: { playedAt: '2026-01-02T00:00:00.000Z' },
      teamResult: { placement: 2, kills: 8, placementPoints: 9, killPoints: 8, totalPoints: 17 }
    },
    {
      match: { playedAt: '2026-01-01T00:00:00.000Z' },
      teamResult: { placement: 1, kills: 12, placementPoints: 12, killPoints: 12, totalPoints: 24 }
    }
  ]);

  assert.equal(stats.matchesPlayed, 2);
  assert.equal(stats.totalKills, 20);
  assert.equal(stats.wins, 1);
  assert.equal(stats.top3Finishes, 2);
  assert.equal(stats.placementPoints, 21);
  assert.equal(stats.killPoints, 20);
  assert.equal(stats.totalPoints, 41);
});

test('Free Fire player participation uses roster rows and does not assign player kills', () => {
  const stats = summarizeFreeFirePlayerRows([
    {
      match: { playedAt: '2026-01-02T00:00:00.000Z' },
      teamResult: { placement: 3, kills: 10, totalPoints: 16 }
    }
  ]);

  assert.equal(stats.matchesParticipated, 1);
  assert.equal(stats.top3Participations, 1);
  assert.equal(stats.teamPointsWhileRostered, 16);
  assert.equal(stats.playerKills.value, null);
  assert.equal(stats.playerKills.supported, false);
});

test('Free Fire player query includes verified only and excludes draft or void by status filter', async () => {
  let capturedQuery;
  const stats = await getFreeFirePlayerStatistics({
    user: { _id: 'user-a' },
    models: {
      FreeFireMatchResult: {
        find(query) {
          capturedQuery = query;
          return chain([]);
        }
      }
    }
  });

  assert.equal(capturedQuery.status, 'verified');
  assert.equal(stats.performance.matchesParticipated, 0);
});

test('Valorant team aggregation derives winner, win rate, and round differential from score side', () => {
  const stats = summarizeValorantSides([
    {
      match: { winnerRegistrationId: 'reg-a', map: 'Ascent', playedAt: '2026-01-02T00:00:00.000Z' },
      side: { registrationId: 'reg-a', score: 13 },
      opponent: { registrationId: 'reg-b', score: 8 }
    },
    {
      match: { winnerRegistrationId: 'reg-c', map: 'Bind', playedAt: '2026-01-01T00:00:00.000Z' },
      side: { registrationId: 'reg-a', score: 10 },
      opponent: { registrationId: 'reg-c', score: 13 }
    }
  ]);

  assert.equal(stats.matchesPlayed, 2);
  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.winRate, 50);
  assert.equal(stats.roundsFor, 23);
  assert.equal(stats.roundsAgainst, 21);
  assert.equal(stats.roundDifferential, 2);
  assert.deepEqual(stats.recentForm.map((item) => item.result), ['W', 'L']);
});

test('Valorant player query uses verified only and exposes unsupported combat metrics as null', async () => {
  let capturedQuery;
  const stats = await getValorantPlayerStatistics({
    user: { _id: 'user-a' },
    models: {
      ValorantMatchResult: {
        find(query) {
          capturedQuery = query;
          return chain([]);
        }
      }
    }
  });

  assert.equal(capturedQuery.status, 'verified');
  assert.equal(stats.performance.matchesParticipated, 0);
  assert.equal(stats.performance.personalKills.value, null);
  assert.equal(stats.performance.personalKills.supported, false);
});
