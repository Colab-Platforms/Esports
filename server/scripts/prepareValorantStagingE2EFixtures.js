require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');
const { parseManualRiotId } = require('../services/valorant-registration.service');

const REQUIRED_DB_NAME = 'colab-esports-dev';
const TARGET_DB_FLAG = 'VALORANT_E2E_TARGET_DB';
const CONFIRM_FLAG = 'CONFIRM_VALORANT_E2E_PREPARE';
const DRY_RUN_FLAG = 'VALORANT_E2E_DRY_RUN';
const PASSWORD_FLAG = 'VALORANT_E2E_FIXTURE_PASSWORD';
const RUN_ID_FLAG = 'VALORANT_E2E_RUN_ID';
const MANIFEST_PATH_FLAG = 'VALORANT_E2E_MANIFEST_PATH';
const ADMIN_IDENTIFIER_FLAG = 'VALORANT_E2E_ADMIN_IDENTIFIER';
const ACTIVE_STATUSES = ['pending', 'images_uploaded', 'verified'];

const defaultManifestPath = () => path.join(__dirname, 'valorant-e2e-fixture-manifest.json');
const isDryRun = (env = process.env) => env[DRY_RUN_FLAG] === 'true';
const toObjectId = (id) => (id instanceof ObjectId ? id : new ObjectId(id));
const toIdString = (id) => (id ? id.toString() : '');
const normalizeRiotId = (value) => {
  try {
    return parseManualRiotId(value).normalized;
  } catch (_error) {
    return '';
  }
};

const printJson = (label, value) => {
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(value, null, 2));
};

const assertExpectedDb = (db, expectedDbName) => {
  console.log(`Expected DB: ${expectedDbName || '<missing>'}`);
  console.log(`Actual DB: ${db.databaseName}`);
  if (!expectedDbName || expectedDbName !== REQUIRED_DB_NAME) {
    throw new Error(`${TARGET_DB_FLAG}=${REQUIRED_DB_NAME} is required`);
  }
  if (db.databaseName !== expectedDbName) {
    throw new Error(`Connected database mismatch. Expected ${expectedDbName}, got ${db.databaseName}.`);
  }
};

const assertPrepareEnv = (env = process.env) => {
  if (env[TARGET_DB_FLAG] !== REQUIRED_DB_NAME) {
    throw new Error(`${TARGET_DB_FLAG}=${REQUIRED_DB_NAME} is required`);
  }
  if (env[CONFIRM_FLAG] !== 'true') {
    throw new Error(`${CONFIRM_FLAG}=true is required`);
  }
  if (!isDryRun(env) && !env[PASSWORD_FLAG]) {
    throw new Error(`${PASSWORD_FLAG} is required for non-dry-run fixture creation`);
  }
};

const makeRunId = (env = process.env) => {
  const raw = env[RUN_ID_FLAG] || crypto.randomBytes(4).toString('hex');
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 10);
  if (!cleaned) throw new Error(`${RUN_ID_FLAG} must contain at least one alphanumeric character`);
  return cleaned;
};

const makeSyntheticUser = ({ id, marker, runId, label, riotId, phoneSeed }) => {
  const username = `${marker}_${label}`.toLowerCase().slice(0, 30);
  return {
    _id: id,
    fullName: `Valorant E2E ${label}`,
    username,
    email: `${username}@example.com`,
    phone: `9${String(phoneSeed).padStart(9, '0').slice(0, 9)}`,
    authProvider: 'local',
    avatarUrl: '',
    kycStatus: 'pending',
    gameIds: {
      steam: '',
      bgmi: { ign: '', uid: '' },
      freefire: { ign: '', uid: '' },
      valorant: riotId
    },
    role: 'user',
    isActive: true,
    isEmailVerified: true,
    isPhoneVerified: false,
    e2eFixture: { type: 'valorant-staging-e2e', marker, runId },
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

const makeMember = (userId, role = 'member', isSubstitute = false) => ({
  userId,
  role,
  isSubstitute,
  joinedAt: new Date()
});

const makeTeam = ({ id, marker, runId, name, captainId, starterIds, substituteId }) => ({
  _id: id,
  name: `${marker} ${name}`.slice(0, 30),
  tag: name.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5) || 'VE2E',
  game: 'valorant',
  logo: '',
  description: `Disposable Valorant staging E2E fixture ${marker}`,
  captain: captainId,
  members: [
    makeMember(captainId, 'captain', false),
    ...starterIds.map((userId) => makeMember(userId, 'member', false)),
    makeMember(substituteId, 'member', true)
  ],
  maxMembers: 6,
  privacy: 'private',
  stats: { wins: 0, losses: 0, tournamentsPlayed: 0 },
  isActive: true,
  e2eFixture: { type: 'valorant-staging-e2e', marker, runId },
  createdAt: new Date(),
  updatedAt: new Date()
});

const makeTournament = ({ id, marker, runId, name, createdBy, daysOffset = 0 }) => {
  const now = Date.now();
  return {
    _id: id,
    name: `${marker} ${name}`,
    description: `Disposable Valorant staging E2E tournament fixture ${marker}`,
    gameType: 'valorant',
    mode: 'team',
    entryFee: 0,
    prizePool: 0,
    prizeDistribution: [],
    maxParticipants: 16,
    currentParticipants: 0,
    startDate: new Date(now + (7 + daysOffset) * 24 * 60 * 60 * 1000),
    endDate: new Date(now + (8 + daysOffset) * 24 * 60 * 60 * 1000),
    registrationDeadline: new Date(now + (6 + daysOffset) * 24 * 60 * 60 * 1000),
    status: 'registration_open',
    rules: `Disposable staging E2E fixture only: ${marker}`,
    format: 'elimination',
    participants: [],
    matches: [],
    createdBy,
    moderators: [],
    settings: {
      allowLateRegistration: false,
      requireKYC: false,
      autoStartMatches: false,
      streamUrl: '',
      discordInvite: ''
    },
    stats: { totalMatches: 0, completedMatches: 0, totalPrizeDistributed: 0 },
    featured: false,
    bannerImage: '',
    tags: ['valorant-e2e-fixture', marker.toLowerCase()],
    region: 'mumbai',
    e2eFixture: { type: 'valorant-staging-e2e', marker, runId },
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

const createFixturePlan = (env = process.env) => {
  const runId = makeRunId(env);
  const marker = `VAL_E2E_${runId}`;
  const ids = {};
  const nextId = (key) => {
    ids[key] = new ObjectId();
    return ids[key];
  };

  const riot = (name, tag) => `${name}_${runId}#${tag}`;
  const teamA = [
    ['captainA', 'Alpha', '001'],
    ['starterA2', 'Bravo', '002'],
    ['starterA3', 'Charlie', '003'],
    ['starterA4', 'Delta', '004'],
    ['starterA5', 'Echo', '005'],
    ['substituteA6', 'Foxtrot', '006']
  ];
  const users = [];
  let phoneSeed = 100000001;
  const addUser = (key, label, riotId) => {
    const user = makeSyntheticUser({
      id: nextId(`user_${key}`),
      marker,
      runId,
      label,
      riotId,
      phoneSeed: phoneSeed++
    });
    users.push(user);
    return user;
  };

  const userByKey = {};
  teamA.forEach(([key, name, tag]) => {
    userByKey[key] = addUser(key, key, riot(name, tag));
  });
  ['captainB', 'starterB3', 'starterB4', 'starterB5', 'substituteB6'].forEach((key, index) => {
    userByKey[key] = addUser(key, key, riot(['Gale', 'Harbor', 'Ion', 'Jett', 'Kilo'][index], String(101 + index)));
  });
  ['captainC', 'starterC2', 'starterC3', 'starterC4', 'starterC5', 'substituteC6'].forEach((key, index) => {
    const duplicate = index === 2;
    userByKey[key] = addUser(
      key,
      key,
      duplicate ? `ALPHA_${runId}#001` : riot(['Lima', 'Metro', 'Nova', 'Orbit', 'Pearl', 'Quartz'][index], String(201 + index))
    );
  });
  ['captainD', 'starterD2', 'starterD3', 'starterD4', 'starterD5', 'substituteD6'].forEach((key, index) => {
    userByKey[key] = addUser(key, key, riot(['Raze', 'Sova', 'Tango', 'Umbra', 'Viper', 'Wing'][index], String(301 + index)));
  });

  const teams = [
    makeTeam({
      id: nextId('teamA'),
      marker,
      runId,
      name: 'Team A',
      captainId: userByKey.captainA._id,
      starterIds: [userByKey.starterA2._id, userByKey.starterA3._id, userByKey.starterA4._id, userByKey.starterA5._id],
      substituteId: userByKey.substituteA6._id
    }),
    makeTeam({
      id: nextId('teamB'),
      marker,
      runId,
      name: 'Team B',
      captainId: userByKey.captainB._id,
      starterIds: [userByKey.starterA2._id, userByKey.starterB3._id, userByKey.starterB4._id, userByKey.starterB5._id],
      substituteId: userByKey.substituteB6._id
    }),
    makeTeam({
      id: nextId('teamC'),
      marker,
      runId,
      name: 'Team C',
      captainId: userByKey.captainC._id,
      starterIds: [userByKey.starterC2._id, userByKey.starterC3._id, userByKey.starterC4._id, userByKey.starterC5._id],
      substituteId: userByKey.substituteC6._id
    }),
    makeTeam({
      id: nextId('teamD'),
      marker,
      runId,
      name: 'Team D',
      captainId: userByKey.captainD._id,
      starterIds: [userByKey.starterD2._id, userByKey.starterD3._id, userByKey.starterD4._id, userByKey.starterD5._id],
      substituteId: userByKey.substituteD6._id
    })
  ];

  const tournaments = [
    makeTournament({ id: nextId('tournament1'), marker, runId, name: 'Tournament 1', createdBy: userByKey.captainA._id }),
    makeTournament({ id: nextId('tournament2'), marker, runId, name: 'Tournament 2', createdBy: userByKey.captainA._id, daysOffset: 14 })
  ];

  return { runId, marker, ids, users, teams, tournaments, userByKey };
};

const summarizePlan = (plan) => ({
  runId: plan.runId,
  marker: plan.marker,
  users: plan.users.map((user) => ({
    _id: user._id,
    username: user.username,
    email: user.email,
    riotId: user.gameIds.valorant,
    normalizedRiotId: normalizeRiotId(user.gameIds.valorant),
    roleHint: user.fullName.replace('Valorant E2E ', '')
  })),
  teams: plan.teams.map((team) => ({
    _id: team._id,
    name: team.name,
    captain: team.captain,
    starterCount: team.members.filter((member) => !member.isSubstitute).length,
    substituteCount: team.members.filter((member) => member.isSubstitute).length,
    memberIds: team.members.map((member) => member.userId)
  })),
  tournaments: plan.tournaments.map((tournament) => ({
    _id: tournament._id,
    name: tournament.name,
    gameType: tournament.gameType,
    status: tournament.status,
    currentParticipants: tournament.currentParticipants,
    registrationDeadline: tournament.registrationDeadline
  }))
});

const createManifest = ({ plan, dbName, manifestPath }) => ({
  schemaVersion: 1,
  runId: plan.runId,
  marker: plan.marker,
  database: dbName,
  createdAt: new Date().toISOString(),
  manifestPath,
  tournaments: plan.tournaments.map((tournament) => ({ id: toIdString(tournament._id), name: tournament.name })),
  users: plan.users.map((user) => ({
    id: toIdString(user._id),
    username: user.username,
    email: user.email,
    roleHint: user.fullName.replace('Valorant E2E ', ''),
    riotId: user.gameIds.valorant,
    normalizedRiotId: normalizeRiotId(user.gameIds.valorant)
  })),
  teams: plan.teams.map((team) => ({ id: toIdString(team._id), name: team.name, captainId: toIdString(team.captain) })),
  scenario: {
    captainA: toIdString(plan.userByKey.captainA._id),
    captainB: toIdString(plan.userByKey.captainB._id),
    captainC: toIdString(plan.userByKey.captainC._id),
    captainD: toIdString(plan.userByKey.captainD._id),
    sharedUser: toIdString(plan.userByKey.starterA2._id),
    duplicateRiotUser: toIdString(plan.userByKey.starterC3._id),
    teamA: toIdString(plan.teams[0]._id),
    teamB: toIdString(plan.teams[1]._id),
    teamC: toIdString(plan.teams[2]._id),
    teamD: toIdString(plan.teams[3]._id),
    tournament1: toIdString(plan.tournaments[0]._id),
    tournament2: toIdString(plan.tournaments[1]._id)
  }
});

const assertNoExistingFixtureIds = async (db, plan) => {
  const [users, teams, tournaments] = await Promise.all([
    db.collection('users').countDocuments({ _id: { $in: plan.users.map((user) => user._id) } }),
    db.collection('teams').countDocuments({ _id: { $in: plan.teams.map((team) => team._id) } }),
    db.collection('tournaments').countDocuments({ _id: { $in: plan.tournaments.map((tournament) => tournament._id) } })
  ]);
  if (users || teams || tournaments) {
    throw new Error(`Fixture ObjectId collision detected: users=${users}, teams=${teams}, tournaments=${tournaments}`);
  }
};

const assertNoRegistrationState = async (db, tournamentIds) => {
  const registrationCount = await db.collection('tournamentregistrations').countDocuments({ tournamentId: { $in: tournamentIds } });
  const claimExists = await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext();
  const claimCount = claimExists
    ? await db.collection('tournamentregistrationclaims').countDocuments({ tournamentId: { $in: tournamentIds } })
    : 0;
  if (registrationCount !== 0 || claimCount !== 0) {
    throw new Error(`Fixture tournaments must start empty. registrations=${registrationCount}, claims=${claimCount}`);
  }
  return { registrationCount, claimCount };
};

const hashFixturePassword = async (env = process.env) => bcrypt.hash(env[PASSWORD_FLAG], parseInt(env.BCRYPT_ROUNDS, 10) || 12);

const writeManifest = (manifest, manifestPath) => {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
};

const getAdminStrategy = async (db, env = process.env) => {
  const identifier = env[ADMIN_IDENTIFIER_FLAG];
  if (!identifier) {
    return {
      strategy: 'existing_admin_not_supplied',
      message: `${ADMIN_IDENTIFIER_FLAG} not supplied. Later admin API scenarios need an existing staging admin login. No admin was created or modified.`
    };
  }
  const user = await db.collection('users').findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier },
      { phone: identifier }
    ]
  }, { projection: { _id: 1, username: 1, email: 1, role: 1 } });
  if (!user) throw new Error(`${ADMIN_IDENTIFIER_FLAG} did not match an existing user`);
  if (!['admin', 'moderator'].includes(user.role)) {
    throw new Error(`${ADMIN_IDENTIFIER_FLAG} matched a user without admin/moderator role`);
  }
  return {
    strategy: 'existing_admin_supplied',
    admin: { _id: user._id, username: user.username, email: user.email, role: user.role }
  };
};

const printApiScenarioPlan = (manifest) => {
  printJson('Later API scenario plan', {
    note: 'Do not execute until fixture dry-run and fixture creation are approved.',
    login: 'POST /api/auth/login with the fixture password supplied via VALORANT_E2E_FIXTURE_PASSWORD',
    steps: [
      `A. Login Captain A (${manifest.scenario.captainA})`,
      `B. Register Team A (${manifest.scenario.teamA}) into Tournament 1 (${manifest.scenario.tournament1}) - expect 201, pending, 6 roster, 13 claims, participants=1`,
      'C. Register Team A again - expect blocked, state unchanged',
      `D. Login Captain B (${manifest.scenario.captainB}); register Team B (${manifest.scenario.teamB}) - expect shared platform user block`,
      `E. Login Captain C (${manifest.scenario.captainC}); register Team C (${manifest.scenario.teamC}) - expect normalized Riot ID conflict`,
      `F. Login Captain D (${manifest.scenario.captainD}); use Team D (${manifest.scenario.teamD}) for success/reject/cancel paths`,
      'G. Non-captain attempts Team A registration - expect NOT_TEAM_CAPTAIN',
      'H. Admin accepts pending registration - expect verified, claims retained, participants unchanged',
      'I. Admin rejects pending/active fixture registration - expect rejected, claims released, participants -1',
      'J. Retry rejected team - expect success, new active registration, 13 claims',
      'K. User cancels pending registration - expect registration removed, claims released, participants -1',
      'L. Attempt cancellation of verified registration - expect blocked',
      `M. Register same Riot/team shape in Tournament 2 (${manifest.scenario.tournament2}) - expect allowed per tournament scope`
    ]
  });
};

async function prepareFixtures({ client, env = process.env, manifestPath = env[MANIFEST_PATH_FLAG] || defaultManifestPath() }) {
  assertPrepareEnv(env);
  const db = client.db();
  assertExpectedDb(db, env[TARGET_DB_FLAG]);

  const plan = createFixturePlan(env);
  const adminStrategy = await getAdminStrategy(db, env);
  const manifest = createManifest({ plan, dbName: db.databaseName, manifestPath });

  await assertNoExistingFixtureIds(db, plan);
  const emptyState = await assertNoRegistrationState(db, plan.tournaments.map((tournament) => tournament._id));

  printJson('Fixture plan', summarizePlan(plan));
  printJson('Admin strategy', adminStrategy);
  printJson('Initial registration state', emptyState);
  printApiScenarioPlan(manifest);

  if (isDryRun(env)) {
    console.log('\nDry run enabled. No writes, deletes, or index modifications were performed.');
    return { dryRun: true, manifest, plan, adminStrategy };
  }

  const passwordHash = await hashFixturePassword(env);
  const users = plan.users.map((user) => ({ ...user, passwordHash }));

  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection('users').insertMany(users, { session });
      await db.collection('teams').insertMany(plan.teams, { session });
      await db.collection('tournaments').insertMany(plan.tournaments, { session });
    });
  } finally {
    await session.endSession();
  }

  writeManifest(manifest, manifestPath);
  printJson('Manifest written', { manifestPath, marker: manifest.marker, database: manifest.database });
  return { dryRun: false, manifest, plan, adminStrategy };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    await prepareFixtures({ client });
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ACTIVE_STATUSES,
  CONFIRM_FLAG,
  DRY_RUN_FLAG,
  MANIFEST_PATH_FLAG,
  PASSWORD_FLAG,
  REQUIRED_DB_NAME,
  TARGET_DB_FLAG,
  assertExpectedDb,
  assertNoRegistrationState,
  createFixturePlan,
  createManifest,
  defaultManifestPath,
  normalizeRiotId,
  prepareFixtures,
  summarizePlan,
  toObjectId,
  toIdString
};
