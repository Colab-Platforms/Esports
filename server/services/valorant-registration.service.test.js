const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  ACTIVE_REGISTRATION_STATUSES,
  buildRegistrationClaims,
  buildConflictQuery,
  buildRosterSnapshot,
  cancelValorantRegistration,
  classifyRegistrationConflicts,
  getRosterMembersFromTeam,
  parseManualRiotId,
  prepareValorantRegistration,
  registerValorantTeam,
  rejectValorantRegistration
} = require('./valorant-registration.service');

const oid = () => new mongoose.Types.ObjectId();

const makeTeam = ({ captainId, memberIds, substituteIds = [] } = {}) => ({
  _id: oid(),
  name: 'Valorant Five Plus One',
  game: 'valorant',
  isActive: true,
  captain: captainId,
  members: [
    { userId: captainId, role: 'captain', isSubstitute: false },
    ...memberIds.map((userId) => ({ userId, role: 'member', isSubstitute: false })),
    ...substituteIds.map((userId) => ({ userId, role: 'member', isSubstitute: true }))
  ],
  isCaptain(userId) {
    return userId.toString() === captainId.toString();
  }
});

const makeUsers = (ids, riotIds = []) => ids.map((id, index) => ({
  _id: id,
  username: `player${index + 1}`,
  phone: index === 0 ? '9876543210' : '',
  gameIds: { valorant: riotIds[index] || `Player${index + 1}#TAG${index}` }
}));

const assertCode = (fn, code) => {
  assert.throws(fn, (error) => error.code === code);
};

const query = (value) => {
  const promise = Promise.resolve(value);
  return {
    session: () => query(value),
    select: () => query(value),
    populate: () => query(value),
    lean: () => query(value),
    then: (resolve, reject) => promise.then(resolve, reject),
    catch: (reject) => promise.catch(reject)
  };
};

const installFakeSession = (t) => {
  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {}
  });
  t.after(() => {
    mongoose.startSession = originalStartSession;
  });
};

const makeFakeModels = ({ tournament, team, users, registrations = [], claims = [] }) => {
  class FakeTournamentRegistration {
    constructor(data) {
      Object.assign(this, data);
      this._id = data._id || oid();
      this.$locals = {};
    }

    async save() {
      const existingIndex = registrations.findIndex((doc) => doc._id.toString() === this._id.toString());
      if (existingIndex >= 0) registrations[existingIndex] = this;
      else registrations.push(this);
      return this;
    }

    static find(criteria) {
      const active = criteria.status?.$in || [];
      const matches = registrations.filter((registration) => {
        if (registration.tournamentId.toString() !== criteria.tournamentId.toString()) return false;
        if (!active.includes(registration.status)) return false;
        if (!criteria.$or) return true;
        return criteria.$or.some((clause) => {
          if (clause.teamId) return registration.teamId?.toString() === clause.teamId.toString();
          if (clause['roster.userId']) {
            const ids = clause['roster.userId'].$in.map((id) => id.toString());
            return registration.roster?.some((entry) => ids.includes(entry.userId.toString()));
          }
          if (clause['roster.normalizedRiotId']) {
            const ids = clause['roster.normalizedRiotId'].$in;
            return registration.roster?.some((entry) => ids.includes(entry.normalizedRiotId));
          }
          return false;
        });
      });
      return query(matches);
    }

    static findById(id) {
      return query(registrations.find((registration) => registration._id.toString() === id.toString()) || null);
    }

    static deleteOne(criteria) {
      const index = registrations.findIndex((registration) => registration._id.toString() === criteria._id.toString());
      if (index >= 0) registrations.splice(index, 1);
      return query({ deletedCount: index >= 0 ? 1 : 0 });
    }
  }

  const Team = { findById: (id) => query(team && team._id.toString() === id.toString() ? team : null) };
  const User = {
    find: (criteria) => {
      const ids = criteria._id.$in.map((id) => id.toString());
      return query(users.filter((user) => ids.includes(user._id.toString())));
    }
  };
  const Tournament = {
    findById: (id) => query(tournament && tournament._id.toString() === id.toString() ? tournament : null),
    updateOne: (criteria, update) => {
      const isTarget = tournament && tournament._id.toString() === criteria._id.toString();
      const hasCapacity = tournament && (
        criteria.currentParticipants?.$gt !== undefined
          ? tournament.currentParticipants > criteria.currentParticipants.$gt
          : tournament.currentParticipants < tournament.maxParticipants
      );
      const isOpen = !criteria.status || criteria.status.$in.includes(tournament.status);
      const beforeDeadline = !criteria.registrationDeadline || tournament.registrationDeadline > criteria.registrationDeadline.$gt;
      const canUpdate = isTarget && hasCapacity && isOpen && beforeDeadline;
      if (canUpdate && update.$inc?.currentParticipants) {
        tournament.currentParticipants += update.$inc.currentParticipants;
      }
      return query({ modifiedCount: canUpdate ? 1 : 0 });
    }
  };
  const ClaimModel = {
    insertMany: async (newClaims) => {
      for (const claim of newClaims) {
        const exists = claims.some((existing) => (
          existing.tournamentId.toString() === claim.tournamentId.toString() &&
          existing.type === claim.type &&
          existing.value === claim.value
        ));
        if (exists) {
          const error = new Error('duplicate claim');
          error.code = 11000;
          throw error;
        }
      }
      claims.push(...newClaims);
      return newClaims;
    },
    deleteMany: (criteria) => {
      const before = claims.length;
      for (let index = claims.length - 1; index >= 0; index -= 1) {
        if (claims[index].registrationId.toString() === criteria.registrationId.toString()) claims.splice(index, 1);
      }
      return query({ deletedCount: before - claims.length });
    }
  };

  return { Tournament, Team, User, TournamentRegistration: FakeTournamentRegistration, ClaimModel, state: { registrations, claims, tournament } };
};

test('parseManualRiotId normalizes manual Riot IDs and rejects malformed values', () => {
  assert.deepEqual(parseManualRiotId(' TenZ # NA1 '), {
    display: 'TenZ#NA1',
    name: 'TenZ',
    tag: 'NA1',
    normalized: 'tenz#na1'
  });

  assertCode(() => parseManualRiotId('TenZ'), 'MALFORMED_RIOT_ID');
  assertCode(() => parseManualRiotId('A#B#C'), 'MALFORMED_RIOT_ID');
  assertCode(() => parseManualRiotId('#TAG'), 'MALFORMED_RIOT_ID');
});

test('getRosterMembersFromTeam requires exactly 5 starters, 1 substitute, and captain as starter', () => {
  const ids = Array.from({ length: 6 }, oid);
  const validTeam = makeTeam({ captainId: ids[0], memberIds: ids.slice(1, 5), substituteIds: [ids[5]] });
  const roster = getRosterMembersFromTeam(validTeam);

  assert.equal(roster.starters.length, 5);
  assert.equal(roster.substitutes.length, 1);
  assert.equal(roster.allMembers.length, 6);

  assertCode(() => getRosterMembersFromTeam(makeTeam({
    captainId: ids[0],
    memberIds: ids.slice(1, 4),
    substituteIds: [ids[5]]
  })), 'INVALID_VALORANT_ROSTER');

  assertCode(() => getRosterMembersFromTeam(makeTeam({
    captainId: ids[0],
    memberIds: ids.slice(1, 5),
    substituteIds: []
  })), 'SUBSTITUTE_REQUIRED');

  const captainSubTeam = makeTeam({ captainId: ids[0], memberIds: ids.slice(1, 5), substituteIds: [ids[5]] });
  captainSubTeam.members[0].isSubstitute = true;
  assertCode(() => getRosterMembersFromTeam(captainSubTeam), 'INVALID_VALORANT_ROSTER');
});

test('buildRosterSnapshot creates authoritative roster and blocks missing or duplicate Riot IDs', () => {
  const ids = Array.from({ length: 6 }, oid);
  const team = makeTeam({ captainId: ids[0], memberIds: ids.slice(1, 5), substituteIds: [ids[5]] });
  const users = makeUsers(ids);
  const snapshot = buildRosterSnapshot({ team, users });

  assert.equal(snapshot.roster.length, 6);
  assert.equal(snapshot.starterEntries.length, 5);
  assert.equal(snapshot.substituteEntry.role, 'substitute');
  assert.equal(snapshot.captainEntry.userId.toString(), ids[0].toString());

  const missingRiotUsers = makeUsers(ids);
  missingRiotUsers[2].gameIds.valorant = '';
  assertCode(() => buildRosterSnapshot({ team, users: missingRiotUsers }), 'MISSING_RIOT_ID');

  const duplicateRiotUsers = makeUsers(ids, ['Same#ID', 'same#id']);
  assertCode(() => buildRosterSnapshot({ team, users: duplicateRiotUsers }), 'DUPLICATE_RIOT_ID');
});

test('conflict helpers block active duplicate team, user, and Riot ID registrations', () => {
  const teamId = oid();
  const userId = oid();
  const otherUserId = oid();

  const query = buildConflictQuery({
    tournamentId: oid(),
    teamId,
    userIds: [userId],
    normalizedRiotIds: ['same#id']
  });

  assert.deepEqual(query.status.$in, ACTIVE_REGISTRATION_STATUSES);
  assert.equal(query.$or.length, 3);

  assertCode(() => classifyRegistrationConflicts({
    existingRegistrations: [{ teamId, teamName: 'Existing', roster: [] }],
    teamId,
    userIds: [userId],
    normalizedRiotIds: ['same#id']
  }), 'TEAM_ALREADY_REGISTERED');

  assertCode(() => classifyRegistrationConflicts({
    existingRegistrations: [{
      teamId: oid(),
      teamName: 'Existing',
      roster: [{ userId, username: 'player1', normalizedRiotId: 'other#id' }]
    }],
    teamId,
    userIds: [userId],
    normalizedRiotIds: ['same#id']
  }), 'PLAYER_ALREADY_REGISTERED');

  assertCode(() => classifyRegistrationConflicts({
    existingRegistrations: [{
      teamId: oid(),
      teamName: 'Existing',
      roster: [{ userId: otherUserId, username: 'player2', riotId: 'Same#ID', normalizedRiotId: 'same#id' }]
    }],
    teamId,
    userIds: [userId],
    normalizedRiotIds: ['same#id']
  }), 'RIOT_ID_ALREADY_REGISTERED');
});

test('prepareValorantRegistration returns a 5+1 snapshot from Team and User records only', async () => {
  const tournamentId = oid();
  const teamId = oid();
  const ids = Array.from({ length: 6 }, oid);
  const team = makeTeam({ captainId: ids[0], memberIds: ids.slice(1, 5), substituteIds: [ids[5]] });
  team._id = teamId;
  const users = makeUsers(ids);

  const models = {
    Tournament: {
      findById: async () => ({
        _id: tournamentId,
        name: 'Valorant Cup',
        gameType: 'valorant',
        isRegistrationOpen: true,
        currentParticipants: 0,
        maxParticipants: 16
      })
    },
    Team: { findById: async () => team },
    User: {
      find: () => ({
        select: () => ({
          lean: async () => users
        })
      })
    },
    TournamentRegistration: {
      find: () => ({
        lean: async () => []
      })
    }
  };

  const prepared = await prepareValorantRegistration({
    tournamentId: tournamentId.toString(),
    requesterUserId: ids[0],
    teamId: teamId.toString(),
    models
  });

  assert.equal(prepared.snapshot.teamName, team.name);
  assert.equal(prepared.snapshot.teamMembers.length, 4);
  assert.equal(prepared.snapshot.roster.length, 6);
  assert.equal(prepared.snapshot.whatsappNumber, '9876543210');
});

test('buildRegistrationClaims creates team, six user, and six Riot claims', () => {
  const tournamentId = oid();
  const teamId = oid();
  const registrationId = oid();
  const userIds = Array.from({ length: 6 }, oid);
  const roster = userIds.map((userId, index) => ({
    userId,
    normalizedRiotId: `player${index}#tag`
  }));

  const claims = buildRegistrationClaims({ tournamentId, teamId, registrationId, roster });
  assert.equal(claims.length, 13);
  assert.equal(claims.filter((claim) => claim.type === 'team').length, 1);
  assert.equal(claims.filter((claim) => claim.type === 'user').length, 6);
  assert.equal(claims.filter((claim) => claim.type === 'riot').length, 6);
});

test('registerValorantTeam creates claims, registration, and reserves capacity atomically', async (t) => {
  installFakeSession(t);
  const tournamentId = oid();
  const teamId = oid();
  const ids = Array.from({ length: 6 }, oid);
  const team = makeTeam({ captainId: ids[0], memberIds: ids.slice(1, 5), substituteIds: [ids[5]] });
  team._id = teamId;
  const tournament = {
    _id: tournamentId,
    name: 'Valorant Cup',
    gameType: 'valorant',
    status: 'registration_open',
    registrationDeadline: new Date(Date.now() + 60_000),
    currentParticipants: 0,
    maxParticipants: 2,
    get isRegistrationOpen() {
      return this.currentParticipants < this.maxParticipants;
    }
  };
  const models = makeFakeModels({ tournament, team, users: makeUsers(ids) });

  const result = await registerValorantTeam({
    tournamentId,
    requesterUserId: ids[0],
    teamId,
    models
  });

  assert.equal(models.state.registrations.length, 1);
  assert.equal(models.state.claims.length, 13);
  assert.equal(models.state.tournament.currentParticipants, 1);
  assert.equal(result.registration.roster.length, 6);
});

test('rejected registration releases team, user, and Riot claims for retry', async (t) => {
  installFakeSession(t);
  const tournamentId = oid();
  const teamId = oid();
  const ids = Array.from({ length: 6 }, oid);
  const team = makeTeam({ captainId: ids[0], memberIds: ids.slice(1, 5), substituteIds: [ids[5]] });
  team._id = teamId;
  const tournament = {
    _id: tournamentId,
    name: 'Valorant Cup',
    gameType: 'valorant',
    status: 'registration_open',
    registrationDeadline: new Date(Date.now() + 60_000),
    currentParticipants: 0,
    maxParticipants: 2,
    get isRegistrationOpen() {
      return this.currentParticipants < this.maxParticipants;
    }
  };
  const models = makeFakeModels({ tournament, team, users: makeUsers(ids) });

  const first = await registerValorantTeam({ tournamentId, requesterUserId: ids[0], teamId, models });
  await rejectValorantRegistration({
    registrationId: first.registration._id,
    adminUserId: oid(),
    reason: 'Roster corrected',
    models
  });

  assert.equal(models.state.registrations[0].status, 'rejected');
  assert.equal(models.state.claims.length, 0);
  assert.equal(models.state.tournament.currentParticipants, 0);

  const second = await registerValorantTeam({ tournamentId, requesterUserId: ids[0], teamId, models });
  assert.equal(second.registration.status, 'pending');
  assert.equal(models.state.claims.length, 13);
});

test('same team active registration is claim-protected', async (t) => {
  installFakeSession(t);
  const tournamentId = oid();
  const teamId = oid();
  const ids = Array.from({ length: 6 }, oid);
  const team = makeTeam({ captainId: ids[0], memberIds: ids.slice(1, 5), substituteIds: [ids[5]] });
  team._id = teamId;
  const tournament = {
    _id: tournamentId,
    name: 'Valorant Cup',
    gameType: 'valorant',
    status: 'registration_open',
    registrationDeadline: new Date(Date.now() + 60_000),
    currentParticipants: 0,
    maxParticipants: 8,
    get isRegistrationOpen() {
      return this.currentParticipants < this.maxParticipants;
    }
  };
  const models = makeFakeModels({ tournament, team, users: makeUsers(ids) });

  await registerValorantTeam({ tournamentId, requesterUserId: ids[0], teamId, models });
  await assert.rejects(
    () => registerValorantTeam({ tournamentId, requesterUserId: ids[0], teamId, models }),
    (error) => error.code === 'TEAM_ALREADY_REGISTERED' || error.code === 'REGISTRATION_CLAIM_CONFLICT'
  );
});

test('same Riot ID on different users in the same tournament is claim-protected', async (t) => {
  installFakeSession(t);
  const tournamentId = oid();
  const idsA = Array.from({ length: 6 }, oid);
  const idsB = Array.from({ length: 6 }, oid);
  const teamA = makeTeam({ captainId: idsA[0], memberIds: idsA.slice(1, 5), substituteIds: [idsA[5]] });
  const teamB = makeTeam({ captainId: idsB[0], memberIds: idsB.slice(1, 5), substituteIds: [idsB[5]] });
  const users = [
    ...makeUsers(idsA, ['TenZ#1234']),
    ...makeUsers(idsB, ['tenz#1234'])
  ];
  const tournament = {
    _id: tournamentId,
    name: 'Valorant Cup',
    gameType: 'valorant',
    status: 'registration_open',
    registrationDeadline: new Date(Date.now() + 60_000),
    currentParticipants: 0,
    maxParticipants: 8,
    get isRegistrationOpen() {
      return this.currentParticipants < this.maxParticipants;
    }
  };
  const modelsA = makeFakeModels({ tournament, team: teamA, users });
  const modelsB = { ...modelsA, Team: { findById: () => query(teamB) } };

  await registerValorantTeam({ tournamentId, requesterUserId: idsA[0], teamId: teamA._id, models: modelsA });
  await assert.rejects(
    () => registerValorantTeam({ tournamentId, requesterUserId: idsB[0], teamId: teamB._id, models: modelsB }),
    (error) => error.code === 'RIOT_ID_ALREADY_REGISTERED' || error.code === 'REGISTRATION_CLAIM_CONFLICT'
  );
});

test('same platform user in different teams in the same tournament is claim-protected', async (t) => {
  installFakeSession(t);
  const tournamentId = oid();
  const sharedUser = oid();
  const idsA = [sharedUser, ...Array.from({ length: 5 }, oid)];
  const idsB = [oid(), sharedUser, ...Array.from({ length: 4 }, oid)];
  const teamA = makeTeam({ captainId: idsA[0], memberIds: idsA.slice(1, 5), substituteIds: [idsA[5]] });
  const teamB = makeTeam({ captainId: idsB[0], memberIds: idsB.slice(1, 5), substituteIds: [idsB[5]] });
  const users = makeUsers([...new Set([...idsA, ...idsB].map((id) => id.toString()))].map((id) => new mongoose.Types.ObjectId(id)));
  const captainB = users.find((user) => user._id.toString() === idsB[0].toString());
  captainB.phone = '9876543211';
  const tournament = {
    _id: tournamentId,
    name: 'Valorant Cup',
    gameType: 'valorant',
    status: 'registration_open',
    registrationDeadline: new Date(Date.now() + 60_000),
    currentParticipants: 0,
    maxParticipants: 8,
    get isRegistrationOpen() {
      return this.currentParticipants < this.maxParticipants;
    }
  };
  const modelsA = makeFakeModels({ tournament, team: teamA, users });
  const modelsB = { ...modelsA, Team: { findById: () => query(teamB) } };

  await registerValorantTeam({ tournamentId, requesterUserId: idsA[0], teamId: teamA._id, models: modelsA });
  await assert.rejects(
    () => registerValorantTeam({ tournamentId, requesterUserId: idsB[0], teamId: teamB._id, models: modelsB }),
    (error) => error.code === 'PLAYER_ALREADY_REGISTERED' || error.code === 'REGISTRATION_CLAIM_CONFLICT'
  );
});

test('same Riot ID in a different tournament is allowed', async (t) => {
  installFakeSession(t);
  const idsA = Array.from({ length: 6 }, oid);
  const idsB = Array.from({ length: 6 }, oid);
  const teamA = makeTeam({ captainId: idsA[0], memberIds: idsA.slice(1, 5), substituteIds: [idsA[5]] });
  const teamB = makeTeam({ captainId: idsB[0], memberIds: idsB.slice(1, 5), substituteIds: [idsB[5]] });
  const tournamentA = {
    _id: oid(),
    name: 'Valorant Cup A',
    gameType: 'valorant',
    status: 'registration_open',
    registrationDeadline: new Date(Date.now() + 60_000),
    currentParticipants: 0,
    maxParticipants: 8,
    get isRegistrationOpen() {
      return this.currentParticipants < this.maxParticipants;
    }
  };
  const tournamentB = { ...tournamentA, _id: oid(), name: 'Valorant Cup B', currentParticipants: 0 };
  const claims = [];
  const regs = [];
  const modelsA = makeFakeModels({
    tournament: tournamentA,
    team: teamA,
    users: makeUsers(idsA, ['Same#ID']),
    registrations: regs,
    claims
  });
  const modelsB = makeFakeModels({
    tournament: tournamentB,
    team: teamB,
    users: makeUsers(idsB, ['same#id']),
    registrations: regs,
    claims
  });

  await registerValorantTeam({ tournamentId: tournamentA._id, requesterUserId: idsA[0], teamId: teamA._id, models: modelsA });
  await registerValorantTeam({ tournamentId: tournamentB._id, requesterUserId: idsB[0], teamId: teamB._id, models: modelsB });

  assert.equal(regs.length, 2);
  assert.equal(claims.length, 26);
});

test('last capacity slot allows exactly one registration', async (t) => {
  installFakeSession(t);
  const tournamentId = oid();
  const idsA = Array.from({ length: 6 }, oid);
  const idsB = Array.from({ length: 6 }, oid);
  const teamA = makeTeam({ captainId: idsA[0], memberIds: idsA.slice(1, 5), substituteIds: [idsA[5]] });
  const teamB = makeTeam({ captainId: idsB[0], memberIds: idsB.slice(1, 5), substituteIds: [idsB[5]] });
  const users = [...makeUsers(idsA), ...makeUsers(idsB)];
  const tournament = {
    _id: tournamentId,
    name: 'Valorant Cup',
    gameType: 'valorant',
    status: 'registration_open',
    registrationDeadline: new Date(Date.now() + 60_000),
    currentParticipants: 0,
    maxParticipants: 1,
    get isRegistrationOpen() {
      return this.currentParticipants < this.maxParticipants;
    }
  };
  const modelsA = makeFakeModels({ tournament, team: teamA, users });
  const modelsB = { ...modelsA, Team: { findById: () => query(teamB) } };

  const results = await Promise.allSettled([
    registerValorantTeam({ tournamentId, requesterUserId: idsA[0], teamId: teamA._id, models: modelsA }),
    registerValorantTeam({ tournamentId, requesterUserId: idsB[0], teamId: teamB._id, models: modelsB })
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(modelsA.state.registrations.length, 1);
  assert.equal(modelsA.state.tournament.currentParticipants, 1);
});

test('pending cancellation releases claims and capacity', async (t) => {
  installFakeSession(t);
  const tournamentId = oid();
  const teamId = oid();
  const ids = Array.from({ length: 6 }, oid);
  const team = makeTeam({ captainId: ids[0], memberIds: ids.slice(1, 5), substituteIds: [ids[5]] });
  team._id = teamId;
  const tournament = {
    _id: tournamentId,
    name: 'Valorant Cup',
    gameType: 'valorant',
    status: 'registration_open',
    registrationDeadline: new Date(Date.now() + 60_000),
    currentParticipants: 0,
    maxParticipants: 2,
    get isRegistrationOpen() {
      return this.currentParticipants < this.maxParticipants;
    }
  };
  const models = makeFakeModels({ tournament, team, users: makeUsers(ids) });
  const result = await registerValorantTeam({ tournamentId, requesterUserId: ids[0], teamId, models });

  await cancelValorantRegistration({
    registrationId: result.registration._id,
    requesterUserId: ids[0],
    models
  });

  assert.equal(models.state.registrations.length, 0);
  assert.equal(models.state.claims.length, 0);
  assert.equal(models.state.tournament.currentParticipants, 0);
});
