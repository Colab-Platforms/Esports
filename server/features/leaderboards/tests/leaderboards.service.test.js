const assert = require('node:assert/strict');
const test = require('node:test');
const { getTeamLeaderboard } = require('../leaderboards.service');
const { getBgmiLeaderboardRows } = require('../adapters/bgmi-leaderboard.adapter');
const { getFreeFireLeaderboardRows } = require('../adapters/freefire-leaderboard.adapter');
const { getValorantLeaderboardRows } = require('../adapters/valorant-leaderboard.adapter');

const chain = (value) => ({
  select() { return this; },
  lean() { return Promise.resolve(value); }
});

const team = ({ id, name, game = 'freefire' }) => ({
  _id: id,
  name,
  tag: name.slice(0, 3).toUpperCase(),
  logo: '',
  game,
  privacy: 'public',
  isActive: true,
  captain: 'private-captain',
  members: [{ userId: 'private-member' }]
});

const teamModel = (teams, capture = {}) => ({
  find(query) {
    capture.query = query;
    const allowedIds = new Set((query._id?.$in || []).map(String));
    return chain(teams.filter((item) => (
      allowedIds.has(String(item._id)) &&
      item.game === query.game &&
      item.privacy === 'public' &&
      item.isActive === true
    )));
  }
});

test('unknown game is rejected', async () => {
  await assert.rejects(
    () => getTeamLeaderboard('cs2'),
    (error) => error.status === 400 && error.code === 'UNSUPPORTED_GAME'
  );
});

test('BGMI adapter filters completed verified rows with team identity', async () => {
  let capturedPipeline;
  await getBgmiLeaderboardRows({
    models: {
      BGMIMatch: {
        aggregate: async (pipeline) => {
          capturedPipeline = pipeline;
          return [];
        }
      }
    }
  });

  assert.equal(capturedPipeline[0].$match.status, 'completed');
  assert.equal(capturedPipeline[2].$match['teamResults.verified'], true);
  assert.deepEqual(capturedPipeline[2].$match['teamResults.teamId'], { $ne: null });
});

test('Free Fire adapter filters verified canonical team rows only', async () => {
  let capturedPipeline;
  await getFreeFireLeaderboardRows({
    models: {
      FreeFireMatchResult: {
        aggregate: async (pipeline) => {
          capturedPipeline = pipeline;
          return [];
        }
      }
    }
  });

  assert.equal(capturedPipeline[0].$match.status, 'verified');
  assert.deepEqual(capturedPipeline[2].$match['teamResults.canonicalTeamId'], { $ne: null });
});

test('Valorant adapter aggregates verified canonical team rows from both sides', async () => {
  const capturedPipelines = [];
  await getValorantLeaderboardRows({
    models: {
      ValorantMatchResult: {
        aggregate: async (pipeline) => {
          capturedPipelines.push(pipeline);
          return [];
        }
      }
    }
  });

  assert.equal(capturedPipelines.length, 2);
  assert.equal(capturedPipelines[0][0].$match.status, 'verified');
  assert.deepEqual(capturedPipelines[0][0].$match['teamA.canonicalTeamId'], { $ne: null });
  assert.deepEqual(capturedPipelines[1][0].$match['teamB.canonicalTeamId'], { $ne: null });
});

test('Free Fire leaderboard excludes non-canonical rows through team lookup and sorts by exact tiebreaks', async () => {
  const aggregateRows = [
    {
      teamId: 'team-low',
      matchesPlayed: 1,
      totalPoints: 10,
      placementPoints: 8,
      killPoints: 2,
      wins: 1,
      totalKills: 2,
      averagePlacement: 1
    },
    {
      teamId: 'team-kills',
      matchesPlayed: 2,
      totalPoints: 30,
      placementPoints: 20,
      killPoints: 10,
      wins: 1,
      totalKills: 10,
      averagePlacement: 2
    },
    {
      teamId: 'team-wins',
      matchesPlayed: 2,
      totalPoints: 30,
      placementPoints: 18,
      killPoints: 12,
      wins: 2,
      totalKills: 8,
      averagePlacement: 1.5
    },
    {
      teamId: 'registration-only',
      matchesPlayed: 5,
      totalPoints: 999,
      placementPoints: 999,
      killPoints: 0,
      wins: 5,
      totalKills: 99,
      averagePlacement: 1
    }
  ];

  const result = await getTeamLeaderboard('freefire', {
    models: {
      FreeFireMatchResult: { aggregate: async () => aggregateRows },
      Team: teamModel([
        team({ id: 'team-low', name: 'Low Sample' }),
        team({ id: 'team-kills', name: 'Kill Breakers' }),
        team({ id: 'team-wins', name: 'Win Breakers' })
      ])
    }
  });

  assert.equal(result.metric, 'totalPoints');
  assert.equal(result.pagination.total, 3);
  assert.deepEqual(result.entries.map((entry) => entry.team.id), ['team-wins', 'team-kills', 'team-low']);
  assert.deepEqual(result.entries.map((entry) => entry.rank), [1, 2, 3]);
  assert.equal(result.entries[2].lowSample, true);
  assert.equal(result.entries[0].team.captain, undefined);
  assert.equal(result.entries[0].team.members, undefined);
});

test('BGMI leaderboard includes only public teams for the same game and preserves page rank', async () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    teamId: `team-${index + 1}`,
    matchesPlayed: 2,
    totalPoints: 100 - index,
    wins: 0,
    top3Finishes: 0,
    top5Finishes: 0,
    totalKills: 10,
    averagePlacement: 4
  }));

  const result = await getTeamLeaderboard('bgmi', {
    page: 2,
    limit: 25,
    models: {
      BGMIMatch: { aggregate: async () => rows },
      Team: teamModel(rows.map((row, index) => team({ id: row.teamId, name: `BGMI ${index + 1}`, game: 'bgmi' })))
    }
  });

  assert.equal(result.pagination.total, 30);
  assert.equal(result.pagination.hasMore, false);
  assert.equal(result.entries.length, 5);
  assert.equal(result.entries[0].rank, 26);
  assert.equal(result.entries[0].team.id, 'team-26');
});

test('Valorant leaderboard aggregates both sides and uses wins before win rate', async () => {
  const result = await getTeamLeaderboard('valorant', {
    models: {
      ValorantMatchResult: {
        aggregate: async (pipeline) => {
          if (Object.prototype.hasOwnProperty.call(pipeline[0].$match, 'teamA.canonicalTeamId')) {
            return [
              { _id: 'team-one-match', matchesPlayed: 1, wins: 1, roundsFor: 13, roundsAgainst: 8 },
              { _id: 'team-many-wins', matchesPlayed: 20, wins: 15, roundsFor: 260, roundsAgainst: 190 }
            ];
          }
          return [
            { _id: 'team-many-wins', matchesPlayed: 3, wins: 1, roundsFor: 30, roundsAgainst: 35 }
          ];
        }
      },
      Team: teamModel([
        team({ id: 'team-one-match', name: 'One Zero', game: 'valorant' }),
        team({ id: 'team-many-wins', name: 'Many Wins', game: 'valorant' })
      ])
    }
  });

  assert.deepEqual(result.entries.map((entry) => entry.team.id), ['team-many-wins', 'team-one-match']);
  assert.equal(result.entries[0].stats.matchesPlayed, 23);
  assert.equal(result.entries[0].stats.wins, 16);
  assert.equal(result.entries[0].stats.losses, 7);
  assert.equal(result.entries[0].stats.roundDifferential, 65);
  assert.equal(result.entries[1].stats.winRate, 100);
});

test('battle royale final fallback is deterministic by team name then id', async () => {
  const baseStats = {
    matchesPlayed: 2,
    totalPoints: 20,
    placementPoints: 10,
    killPoints: 10,
    wins: 1,
    totalKills: 5,
    averagePlacement: 2
  };
  const result = await getTeamLeaderboard('freefire', {
    models: {
      FreeFireMatchResult: {
        aggregate: async () => [
          { teamId: 'team-b', ...baseStats },
          { teamId: 'team-a', ...baseStats }
        ]
      },
      Team: teamModel([
        team({ id: 'team-b', name: 'Alpha' }),
        team({ id: 'team-a', name: 'Alpha' })
      ])
    }
  });

  assert.deepEqual(result.entries.map((entry) => entry.team.id), ['team-a', 'team-b']);
});

test('empty leaderboard returns a safe empty contract', async () => {
  const result = await getTeamLeaderboard('freefire', {
    models: {
      FreeFireMatchResult: { aggregate: async () => [] },
      Team: teamModel([])
    }
  });

  assert.equal(result.coverage.note, 'Rankings are based on verified competitive results available on Colab.');
  assert.equal(result.pagination.total, 0);
  assert.deepEqual(result.entries, []);
});
