const assert = require('node:assert/strict');
const test = require('node:test');
const { getTeamCompetitiveProfile, normalizeRoster } = require('./team-competitive-profile.service');
const { getValorantTeamHistory, normalizeValorantEvent } = require('./team-competitive-profile.history');

const objectId = '507f1f77bcf86cd799439011';

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
  countDocuments: async () => 0
});

const publicTeam = {
  _id: objectId,
  name: 'Phase Six',
  tag: 'P6',
  logo: '',
  description: 'Competitive test team',
  game: 'valorant',
  privacy: 'public',
  isActive: true,
  maxMembers: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  captain: {
    _id: 'captain-a',
    username: 'captain',
    fullName: 'Captain One',
    avatarUrl: '',
    level: 7
  },
  members: [
    {
      userId: {
        _id: 'captain-a',
        username: 'captain',
        fullName: 'Captain One',
        avatarUrl: '',
        level: 7
      },
      role: 'captain',
      isSubstitute: false,
      joinedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      userId: {
        _id: 'member-a',
        username: 'duelist',
        fullName: '',
        avatarUrl: '',
        level: 3
      },
      role: 'member',
      isSubstitute: true,
      joinedAt: '2026-01-02T00:00:00.000Z'
    }
  ]
};

test('unknown team returns 404-shaped error', async () => {
  await assert.rejects(
    () => getTeamCompetitiveProfile(objectId, {
      models: { Team: { findOne: () => chain(null) } }
    }),
    (error) => error.status === 404 && error.message === 'Team not found'
  );
});

test('private team is not exposed through public competitive profile', async () => {
  let capturedQuery;
  await assert.rejects(
    () => getTeamCompetitiveProfile(objectId, {
      models: {
        Team: {
          findOne(query) {
            capturedQuery = query;
            return chain(null);
          }
        }
      }
    }),
    (error) => error.status === 404
  );

  assert.equal(capturedQuery.privacy, 'public');
  assert.equal(capturedQuery.isActive, true);
});

test('public team profile normalizes identity, roster, statistics, and coverage', async () => {
  const profile = await getTeamCompetitiveProfile(objectId, {
    models: {
      Team: { findOne: () => chain(publicTeam) },
      TournamentRegistration: emptyFindModel(),
      ValorantMatchResult: emptyFindModel()
    }
  });

  assert.equal(profile.team.name, 'Phase Six');
  assert.equal(profile.team.gameLabel, 'Valorant');
  assert.equal(profile.captain.username, 'captain');
  assert.equal(profile.roster.length, 2);
  assert.equal(profile.roster[0].role, 'captain');
  assert.equal(profile.roster[1].isSubstitute, true);
  assert.equal(profile.statistics.coverage.note, 'Stats are based on verified results available on Colab.');
  assert.equal(profile.statistics.statistics.performance.matchesPlayed, 0);
});

test('normalizeRoster keeps current roster semantics separate from historical roster snapshots', () => {
  const roster = normalizeRoster(publicTeam);
  assert.deepEqual(roster.map((member) => [member.user.username, member.role, member.isSubstitute]), [
    ['captain', 'captain', false],
    ['duelist', 'member', true]
  ]);
});

test('Valorant history is rendered from each team perspective', () => {
  const match = {
    _id: 'match-a',
    winnerRegistrationId: 'reg-a',
    map: 'Ascent',
    playedAt: '2026-01-03T00:00:00.000Z',
    teamA: { registrationId: 'reg-a', canonicalTeamId: 'team-a', teamNameSnapshot: 'Team A', score: 13 },
    teamB: { registrationId: 'reg-b', canonicalTeamId: 'team-b', teamNameSnapshot: 'Team B', score: 8 }
  };

  const teamAEvent = normalizeValorantEvent({ match, side: match.teamA, opponent: match.teamB });
  const teamBEvent = normalizeValorantEvent({ match, side: match.teamB, opponent: match.teamA });

  assert.deepEqual(teamAEvent.result.data, {
    scoreFor: 13,
    scoreAgainst: 8,
    opponent: 'Team B',
    map: 'Ascent',
    winner: 'Team A'
  });
  assert.deepEqual(teamBEvent.result.data, {
    scoreFor: 8,
    scoreAgainst: 13,
    opponent: 'Team A',
    map: 'Ascent',
    winner: 'Team A'
  });
});

test('wrong registration id is not attributed as a team id', async () => {
  const history = await getValorantTeamHistory({
    teamId: objectId,
    registrationIds: [],
    models: {
      ValorantMatchResult: {
        find: () => chain([{
          _id: 'match-a',
          status: 'verified',
          winnerRegistrationId: objectId,
          teamA: { registrationId: objectId, canonicalTeamId: null, teamNameSnapshot: 'Registration Only', score: 13 },
          teamB: { registrationId: 'other-reg', canonicalTeamId: null, teamNameSnapshot: 'Opponent', score: 8 }
        }])
      }
    }
  });

  assert.deepEqual(history, []);
});
