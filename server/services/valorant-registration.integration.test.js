const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Team = require('../features/teams/team.model');
const TournamentRegistration = require('../models/TournamentRegistration');
const TournamentRegistrationClaim = require('../models/TournamentRegistrationClaim');
const {
  registerValorantTeam,
  rejectValorantRegistration
} = require('./valorant-registration.service');

const ACTIVE_STATUSES = ['pending', 'images_uploaded', 'verified'];

let replSet;
let userSeq = 0;
let teamSeq = 0;
let tournamentSeq = 0;

const futureDate = (minutes = 60) => new Date(Date.now() + minutes * 60 * 1000);

const createUser = async ({ riotId, phone } = {}) => {
  userSeq += 1;
  return User.create({
    username: `itest_user_${userSeq}`,
    fullName: `Integration User ${userSeq}`,
    email: `itest_user_${userSeq}@example.com`,
    phone,
    authProvider: 'google',
    gameIds: {
      valorant: riotId || `Player${userSeq}#TAG${userSeq}`
    }
  });
};

const createUsers = async (riotIds = []) => Promise.all(
  Array.from({ length: 6 }, (_, index) => createUser({
    riotId: riotIds[index],
    phone: index === 0 ? `98765${String(userSeq + index).padStart(5, '0')}` : undefined
  }))
);

const createAdmin = async () => {
  userSeq += 1;
  return User.create({
    username: `itest_admin_${userSeq}`,
    fullName: `Integration Admin ${userSeq}`,
    email: `itest_admin_${userSeq}@example.com`,
    phone: `97654${String(userSeq).padStart(5, '0')}`,
    authProvider: 'google',
    role: 'admin'
  });
};

const createValorantTournament = async (overrides = {}) => {
  const creator = overrides.createdBy || await createAdmin();
  tournamentSeq += 1;
  return Tournament.create({
    name: `Integration Valorant Cup ${tournamentSeq}`,
    description: 'Integration test tournament',
    gameType: 'valorant',
    mode: 'team',
    prizePool: 1000,
    maxParticipants: 16,
    currentParticipants: 0,
    startDate: futureDate(120),
    endDate: futureDate(180),
    registrationDeadline: futureDate(60),
    status: 'registration_open',
    rules: 'Integration test rules',
    format: 'elimination',
    createdBy: creator._id,
    ...overrides
  });
};

const createBgmiTournament = async () => {
  const creator = await createAdmin();
  return Tournament.create({
    name: 'Integration BGMI Cup',
    description: 'BGMI regression test tournament',
    gameType: 'bgmi',
    mode: 'squad',
    prizePool: 1000,
    maxParticipants: 100,
    currentParticipants: 0,
    startDate: futureDate(120),
    endDate: futureDate(180),
    registrationDeadline: futureDate(60),
    status: 'registration_open',
    rules: 'BGMI rules',
    format: 'battle_royale',
    createdBy: creator._id
  });
};

const createValorantTeam = async ({ users, name, captainIndex = 0 }) => {
  teamSeq += 1;
  const captain = users[captainIndex];
  const members = users.map((user, index) => ({
    userId: user._id,
    role: index === captainIndex ? 'captain' : 'member',
    isSubstitute: index === 5
  }));

  return Team.create({
    name: name || `VTeam${teamSeq}`,
    tag: `V${teamSeq}`.slice(0, 5),
    game: 'valorant',
    captain: captain._id,
    members,
    maxMembers: 6,
    privacy: 'private',
    isActive: true
  });
};

const registerTeam = ({ tournament, team, captain }) => registerValorantTeam({
  tournamentId: tournament._id,
  requesterUserId: captain._id,
  teamId: team._id,
  models: {
    Tournament,
    Team,
    User,
    TournamentRegistration,
    ClaimModel: TournamentRegistrationClaim
  }
});

const countActiveRegistrations = (tournamentId) => TournamentRegistration.countDocuments({
  tournamentId,
  status: { $in: ACTIVE_STATUSES }
});

const getClaimCounts = async (tournamentId) => {
  const claims = await TournamentRegistrationClaim.find({ tournamentId }).lean();
  return {
    total: claims.length,
    team: claims.filter((claim) => claim.type === 'team').length,
    user: claims.filter((claim) => claim.type === 'user').length,
    riot: claims.filter((claim) => claim.type === 'riot').length
  };
};

const assertOneSuccessOneFailure = (results) => {
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
};

test.before(async () => {
  mongoose.set('autoIndex', false);
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(replSet.getUri(), {
    dbName: 'valorant_staging_validation',
    autoIndex: false
  });
  await Promise.all([
    Tournament.createCollection(),
    User.createCollection(),
    Team.createCollection(),
    TournamentRegistration.createCollection(),
    TournamentRegistrationClaim.createCollection()
  ]);
  await TournamentRegistration.collection.createIndex(
    { tournamentId: 1, userId: 1 },
    { name: 'tournamentId_1_userId_1' }
  );
  await TournamentRegistrationClaim.collection.createIndex(
    { tournamentId: 1, type: 1, value: 1 },
    { unique: true, name: 'uniq_tournament_registration_claim' }
  );
});

test.beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
  );
});

test.after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

test('BGMI registration still accepts legacy payload and creates no Valorant claims', async () => {
  const user = await createUser({ riotId: undefined, phone: '9876500000' });
  const tournament = await createBgmiTournament();

  const registration = await TournamentRegistration.create({
    tournamentId: tournament._id,
    userId: user._id,
    teamName: 'BGMI Legacy Team',
    teamLeader: {
      name: 'Leader One',
      bgmiId: 'BGMI-LEADER-1',
      phone: '9876500000'
    },
    teamMembers: [
      { name: 'Member Two', bgmiId: 'BGMI-MEMBER-2' },
      { name: 'Member Three', bgmiId: 'BGMI-MEMBER-3' },
      { name: 'Member Four', bgmiId: 'BGMI-MEMBER-4' }
    ],
    substitutePlayer: {
      name: 'Sub Five',
      bgmiId: 'BGMI-SUB-5'
    },
    whatsappNumber: '9876500000',
    status: 'pending'
  });

  assert.ok(registration._id);
  assert.equal(registration.teamId, null);
  assert.deepEqual(registration.roster, []);
  assert.equal(await TournamentRegistrationClaim.countDocuments({}), 0);
});

test('same Valorant team concurrent registration creates exactly one active registration and 13 claims', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });

  const results = await Promise.allSettled([
    registerTeam({ tournament, team, captain: users[0] }),
    registerTeam({ tournament, team, captain: users[0] })
  ]);

  assertOneSuccessOneFailure(results);
  assert.equal(await countActiveRegistrations(tournament._id), 1);
  assert.deepEqual(await getClaimCounts(tournament._id), {
    total: 13,
    team: 1,
    user: 6,
    riot: 6
  });
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('shared platform user concurrent registration allows only one team and leaves no orphan claims', async () => {
  const tournament = await createValorantTournament();
  const shared = await createUser({ riotId: 'SharedUser#1111', phone: '9876500001' });
  const alphaOnly = await Promise.all(Array.from({ length: 5 }, (_, index) => createUser({ riotId: `Alpha${index}#1111` })));
  const bravoCaptain = await createUser({ riotId: 'BravoCaptain#2222', phone: '9876500002' });
  const bravoOnly = await Promise.all(Array.from({ length: 4 }, (_, index) => createUser({ riotId: `Bravo${index}#2222` })));
  const teamAlpha = await createValorantTeam({ users: [shared, ...alphaOnly], name: 'Alpha' });
  const teamBravo = await createValorantTeam({ users: [bravoCaptain, shared, ...bravoOnly], name: 'Bravo' });

  const results = await Promise.allSettled([
    registerTeam({ tournament, team: teamAlpha, captain: shared }),
    registerTeam({ tournament, team: teamBravo, captain: bravoCaptain })
  ]);

  assertOneSuccessOneFailure(results);
  assert.equal(await countActiveRegistrations(tournament._id), 1);
  assert.equal(await TournamentRegistrationClaim.countDocuments({
    tournamentId: tournament._id,
    type: 'user',
    value: shared._id.toString()
  }), 1);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ tournamentId: tournament._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('same normalized Riot ID concurrent registration is tournament-scoped', async () => {
  const tournament = await createValorantTournament();
  const usersA = await createUsers(['TenZ#1234']);
  const usersB = await createUsers(['tenz#1234']);
  const teamA = await createValorantTeam({ users: usersA, name: 'Riot Alpha' });
  const teamB = await createValorantTeam({ users: usersB, name: 'Riot Bravo' });

  const results = await Promise.allSettled([
    registerTeam({ tournament, team: teamA, captain: usersA[0] }),
    registerTeam({ tournament, team: teamB, captain: usersB[0] })
  ]);

  assertOneSuccessOneFailure(results);
  assert.equal(await TournamentRegistrationClaim.countDocuments({
    tournamentId: tournament._id,
    type: 'riot',
    value: 'tenz#1234'
  }), 1);
  assert.equal(await countActiveRegistrations(tournament._id), 1);

  const otherTournament = await createValorantTournament();
  await registerTeam({ tournament: otherTournament, team: teamB, captain: usersB[0] });
  assert.equal(await countActiveRegistrations(otherTournament._id), 1);
});

test('last slot concurrent registration reserves capacity exactly once', async () => {
  const tournament = await createValorantTournament({
    maxParticipants: 2,
    currentParticipants: 1
  });
  const usersA = await createUsers();
  const usersB = await createUsers();
  const teamA = await createValorantTeam({ users: usersA, name: 'Slot Alpha' });
  const teamB = await createValorantTeam({ users: usersB, name: 'Slot Bravo' });

  const results = await Promise.allSettled([
    registerTeam({ tournament, team: teamA, captain: usersA[0] }),
    registerTeam({ tournament, team: teamB, captain: usersB[0] })
  ]);

  assertOneSuccessOneFailure(results);
  assert.equal(await countActiveRegistrations(tournament._id), 1);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ tournamentId: tournament._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 2);
});

test('rejection releases claims and capacity, then same team can retry with history intact', async () => {
  const tournament = await createValorantTournament();
  const admin = await createAdmin();
  const users = await createUsers();
  const team = await createValorantTeam({ users });

  const first = await registerTeam({ tournament, team, captain: users[0] });
  assert.equal(await TournamentRegistrationClaim.countDocuments({ registrationId: first.registration._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);

  await rejectValorantRegistration({
    registrationId: first.registration._id,
    adminUserId: admin._id,
    reason: 'Roster correction required',
    models: {
      Tournament,
      TournamentRegistration,
      ClaimModel: TournamentRegistrationClaim
    }
  });

  const rejected = await TournamentRegistration.findById(first.registration._id);
  assert.equal(rejected.status, 'rejected');
  assert.equal(await TournamentRegistrationClaim.countDocuments({ registrationId: first.registration._id }), 0);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 0);

  const second = await registerTeam({ tournament, team, captain: users[0] });
  assert.notEqual(second.registration._id.toString(), first.registration._id.toString());
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: tournament._id }), 2);
  assert.equal(await countActiveRegistrations(tournament._id), 1);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ registrationId: second.registration._id }), 13);
});

test('claim conflict rollback leaves no partial registration, claims, or capacity increment', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });

  await TournamentRegistrationClaim.create({
    tournamentId: tournament._id,
    type: 'team',
    value: team._id.toString(),
    registrationId: new mongoose.Types.ObjectId()
  });

  await assert.rejects(
    () => registerTeam({ tournament, team, captain: users[0] }),
    (error) => error.code === 'REGISTRATION_CLAIM_CONFLICT'
  );

  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: tournament._id }), 0);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ tournamentId: tournament._id }), 1);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 0);
});

test('actual Mongo indexes include unique claims index and non-unique registration user index', async () => {
  const claimIndexes = await TournamentRegistrationClaim.collection.indexes();
  const claimIndex = claimIndexes.find((index) => index.name === 'uniq_tournament_registration_claim');
  assert.ok(claimIndex);
  assert.deepEqual(claimIndex.key, { tournamentId: 1, type: 1, value: 1 });
  assert.equal(claimIndex.unique, true);

  const registrationIndexes = await TournamentRegistration.collection.indexes();
  const registrationIndex = registrationIndexes.find((index) => (
    index.key.tournamentId === 1 &&
    index.key.userId === 1 &&
    Object.keys(index.key).length === 2
  ));
  assert.ok(registrationIndex);
  assert.notEqual(registrationIndex.unique, true);
});
