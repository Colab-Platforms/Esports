const assert = require('node:assert/strict');
const test = require('node:test');
const Tournament = require('../../models/Tournament');
const TournamentRegistration = require('../../models/TournamentRegistration');
const TournamentFinalResult = require('./tournament-final-result.model');
const service = require('./tournament-final-results.service');

const ids = {
  tournament: '64f000000000000000000001',
  otherTournament: '64f000000000000000000002',
  actor: '64f000000000000000000003'
};

const chain = (value) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); }
});

const tournament = (overrides = {}) => ({
  _id: ids.tournament,
  name: 'Finals Cup',
  gameType: 'freefire',
  status: 'completed',
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: new Date('2026-01-02T00:00:00Z'),
  scoreboards: [],
  ...overrides
});

const registration = (index, overrides = {}) => ({
  _id: `64f0000000000000000001${String(index).padStart(2, '0')}`,
  tournamentId: ids.tournament,
  userId: `64f0000000000000000002${String(index).padStart(2, '0')}`,
  teamName: `Team ${index}`,
  teamId: `64f0000000000000000003${String(index).padStart(2, '0')}`,
  status: 'verified',
  teamLeader: { name: `Captain ${index}`, freeFireId: `ff-${index}` },
  teamMembers: [{ name: `Player ${index}A`, freeFireId: `ff-${index}a` }],
  substitutePlayer: null,
  ...overrides
});

const mockCore = ({ tournamentDoc = tournament(), registrations = [] } = {}) => {
  const originals = {
    findById: Tournament.findById,
    registrationFind: TournamentRegistration.find,
    findOneAndUpdate: TournamentFinalResult.findOneAndUpdate,
    findOne: TournamentFinalResult.findOne,
    find: TournamentFinalResult.find,
    countDocuments: TournamentFinalResult.countDocuments
  };

  Tournament.findById = () => chain(tournamentDoc);
  TournamentRegistration.find = (query) => {
    const wantedIds = new Set((query._id?.$in || []).map(String));
    const tournamentId = String(query.tournamentId);
    return chain(registrations.filter((item) => (
      wantedIds.has(String(item._id)) && String(item.tournamentId) === tournamentId
    )));
  };
  TournamentFinalResult.findOneAndUpdate = (filter, update) => chain({
    _id: '64f000000000000000000999',
    ...update.$set,
    updatedAt: new Date('2026-01-03T00:00:00Z')
  });
  TournamentFinalResult.findOne = () => chain(null);
  TournamentFinalResult.find = () => chain([]);
  TournamentFinalResult.countDocuments = async () => 0;

  return () => {
    Tournament.findById = originals.findById;
    TournamentRegistration.find = originals.registrationFind;
    TournamentFinalResult.findOneAndUpdate = originals.findOneAndUpdate;
    TournamentFinalResult.findOne = originals.findOne;
    TournamentFinalResult.find = originals.find;
    TournamentFinalResult.countDocuments = originals.countDocuments;
  };
};

test('manual Top 10 publish derives winner, team snapshot, roster snapshot, and source server-side', async () => {
  const regs = Array.from({ length: 10 }, (_, index) => registration(index + 1));
  const restore = mockCore({ registrations: regs });
  try {
    const result = await service.publishFinalResult({
      tournamentId: ids.tournament,
      actorId: ids.actor,
      payload: {
        standings: regs.map((reg, index) => ({
          rank: index + 1,
          registrationId: reg._id,
          teamNameSnapshot: 'spoofed',
          kills: index === 0 ? 0 : '',
          totalPoints: index === 1 ? 12 : ''
        }))
      }
    });

    assert.equal(result.source, 'manual');
    assert.equal(result.winner.teamNameSnapshot, 'Team 1');
    assert.equal(result.standings.length, 10);
    assert.equal(result.standings[4].rank, 5);
    assert.equal(result.standings[0].teamNameSnapshot, 'Team 1');
    assert.equal(result.standings[0].canonicalTeamId, regs[0].teamId);
    assert.deepEqual(result.standings[0].rosterSnapshot.map((member) => member.displayName), ['Captain 1', 'Player 1A']);
    assert.equal(result.standings[0].rosterSnapshot[0].userId, undefined);
    assert.equal(result.standings[0].kills, 0);
    assert.equal(result.standings[0].totalPoints, null);
    assert.equal(result.standings[1].totalPoints, 12);
  } finally {
    restore();
  }
});

test('manual final standings preserve omitted stats as null and reject negative supplied stats', async () => {
  const regs = [registration(1)];
  const restore = mockCore({ registrations: regs });
  try {
    const result = await service.publishFinalResult({
      tournamentId: ids.tournament,
      actorId: ids.actor,
      payload: { standings: [{ rank: 1, registrationId: regs[0]._id }] }
    });

    assert.equal(result.standings[0].kills, null);
    assert.equal(result.standings[0].matchesPlayed, null);

    await assert.rejects(
      () => service.publishFinalResult({
        tournamentId: ids.tournament,
        actorId: ids.actor,
        payload: { standings: [{ rank: 1, registrationId: regs[0]._id, kills: -1 }] }
      }),
      /kills must be a non-negative number/
    );
  } finally {
    restore();
  }
});

test('manual Top 10 rejects rank 11', async () => {
  const regs = Array.from({ length: 11 }, (_, index) => registration(index + 1));
  const restore = mockCore({ registrations: regs });
  try {
    await assert.rejects(
      () => service.publishFinalResult({
        tournamentId: ids.tournament,
        actorId: ids.actor,
        payload: { standings: regs.map((reg, index) => ({ rank: index + 1, registrationId: reg._id })) }
      }),
      /more than 10|1 to 10/
    );
  } finally {
    restore();
  }
});

test('manual Top 10 rejects duplicate rank', async () => {
  const regs = [registration(1), registration(2)];
  const restore = mockCore({ registrations: regs });
  try {
    await assert.rejects(
      () => service.publishFinalResult({
        tournamentId: ids.tournament,
        actorId: ids.actor,
        payload: { standings: [{ rank: 1, registrationId: regs[0]._id }, { rank: 1, registrationId: regs[1]._id }] }
      }),
      /Duplicate manual final rank/
    );
  } finally {
    restore();
  }
});

test('manual Top 10 rejects duplicate registration', async () => {
  const regs = [registration(1)];
  const restore = mockCore({ registrations: regs });
  try {
    await assert.rejects(
      () => service.publishFinalResult({
        tournamentId: ids.tournament,
        actorId: ids.actor,
        payload: { standings: [{ rank: 1, registrationId: regs[0]._id }, { rank: 2, registrationId: regs[0]._id }] }
      }),
      /Duplicate manual final team/
    );
  } finally {
    restore();
  }
});

test('manual Top 10 rejects rank gaps', async () => {
  const regs = [registration(1), registration(2)];
  const restore = mockCore({ registrations: regs });
  try {
    await assert.rejects(
      () => service.publishFinalResult({
        tournamentId: ids.tournament,
        actorId: ids.actor,
        payload: { standings: [{ rank: 1, registrationId: regs[0]._id }, { rank: 3, registrationId: regs[1]._id }] }
      }),
      /contiguous/
    );
  } finally {
    restore();
  }
});

test('manual Top 10 rejects registration from another tournament', async () => {
  const regs = [registration(1, { tournamentId: ids.otherTournament })];
  const restore = mockCore({ registrations: regs });
  try {
    await assert.rejects(
      () => service.publishFinalResult({
        tournamentId: ids.tournament,
        actorId: ids.actor,
        payload: { standings: [{ rank: 1, registrationId: regs[0]._id }] }
      }),
      /registered for this tournament/
    );
  } finally {
    restore();
  }
});

test('manual Top 10 rejects unverified registration', async () => {
  const regs = [registration(1, { status: 'pending' })];
  const restore = mockCore({ registrations: regs });
  try {
    await assert.rejects(
      () => service.publishFinalResult({
        tournamentId: ids.tournament,
        actorId: ids.actor,
        payload: { standings: [{ rank: 1, registrationId: regs[0]._id }] }
      }),
      /verified registrations/
    );
  } finally {
    restore();
  }
});

test('public final result returns published standings and safe roster fields', async () => {
  const restore = mockCore();
  TournamentFinalResult.findOne = () => chain({
    _id: '64f000000000000000000999',
    tournamentId: ids.tournament,
    gameType: 'freefire',
    status: 'published',
    source: 'manual',
    winner: { registrationId: 'r1', canonicalTeamId: 'team-1', teamNameSnapshot: 'Team 1' },
    podium: [{ rank: 1, registrationId: 'r1', canonicalTeamId: 'team-1', teamNameSnapshot: 'Team 1' }],
    standings: [{
      rank: 1,
      registrationId: 'r1',
      canonicalTeamId: 'team-1',
      teamNameSnapshot: 'Team 1',
      rosterSnapshot: [{ userId: ids.actor, displayName: 'Captain', gameId: 'ff-1', role: 'leader' }]
    }],
    evidence: [],
    warnings: [],
    coverage: { structuredResultsAvailable: true, note: '' },
    publishedAt: new Date('2026-01-03T00:00:00Z')
  });
  try {
    const result = await service.getPublicFinalResult({ tournamentId: ids.tournament });
    assert.equal(result.source, 'manual');
    assert.equal(result.winner.canonicalTeamId, 'team-1');
    assert.equal(result.winner.teamName, 'Team 1');
    assert.equal(result.podium[0].canonicalTeamId, 'team-1');
    assert.equal(result.podium[0].teamName, 'Team 1');
    assert.equal(result.standings[0].rank, 1);
    assert.equal(result.standings[0].canonicalTeamId, 'team-1');
    assert.equal(result.standings[0].teamName, 'Team 1');
    assert.equal(result.standings[0].phone, undefined);
    assert.equal(result.standings[0].whatsapp, undefined);
    assert.equal(result.standings[0].adminNotes, undefined);
    assert.deepEqual(Object.keys(result.standings[0].rosterSnapshot[0]).sort(), ['displayName', 'gameId', 'role']);
  } finally {
    restore();
  }
});

test('results directory filters by game and excludes void through status filter', async () => {
  const restore = mockCore();
  let capturedCountQuery = null;
  let capturedFindQuery = null;
  TournamentFinalResult.countDocuments = async (query) => {
    capturedCountQuery = query;
    return 1;
  };
  TournamentFinalResult.find = (query) => {
    capturedFindQuery = query;
    return chain([{
      _id: '64f000000000000000000999',
      tournamentId: tournament({ scoreboards: [] }),
      gameType: 'freefire',
      status: 'published',
      source: 'manual',
      winner: { canonicalTeamId: 'team-1', teamNameSnapshot: 'Team 1' },
      podium: [{ rank: 1, canonicalTeamId: 'team-1', teamNameSnapshot: 'Team 1' }],
      standings: [
        { rank: 1, registrationId: 'r1', canonicalTeamId: 'team-1', teamNameSnapshot: 'Team 1', phone: 'hidden' },
        { rank: 2, registrationId: 'r2', canonicalTeamId: null, teamNameSnapshot: 'Registration Only' }
      ],
      evidence: [{ imageUrl: 'https://example.com/score.jpg' }],
      publishedAt: new Date('2026-01-03T00:00:00Z')
    }]);
  };

  try {
    const directory = await service.getResultsDirectory({ gameType: 'freefire', page: 1, limit: 12 });
    assert.equal(capturedCountQuery.gameType, 'freefire');
    assert.deepEqual(capturedFindQuery.status.$in, ['published', 'needs_republish']);
    assert.equal(directory.tournaments.length, 1);
    assert.equal(directory.tournaments[0].winner.canonicalTeamId, 'team-1');
    assert.equal(directory.tournaments[0].winner.teamName, 'Team 1');
    assert.equal(directory.tournaments[0].podium[0].canonicalTeamId, 'team-1');
    assert.equal(directory.tournaments[0].topStandings[0].canonicalTeamId, 'team-1');
    assert.equal(directory.tournaments[0].topStandings[0].teamName, 'Team 1');
    assert.equal(directory.tournaments[0].topStandings[0].phone, undefined);
    assert.equal(directory.tournaments[0].topStandings[1].canonicalTeamId, null);
    assert.equal(directory.tournaments[0].scoreboardAvailable, true);
    assert.equal(directory.tournaments[0].routeTarget, `/tournament/${ids.tournament}?tab=results`);
  } finally {
    restore();
  }
});

test('results directory rejects unsupported game', async () => {
  await assert.rejects(
    () => service.getResultsDirectory({ gameType: 'cs2' }),
    /Valid gameType/
  );
});

test('unknown tournament returns not found', async () => {
  const restore = mockCore({ tournamentDoc: null });
  try {
    await assert.rejects(
      () => service.publishFinalResult({
        tournamentId: ids.tournament,
        actorId: ids.actor,
        payload: { standings: [{ rank: 1, registrationId: registration(1)._id }] }
      }),
      /Tournament not found/
    );
  } finally {
    restore();
  }
});
