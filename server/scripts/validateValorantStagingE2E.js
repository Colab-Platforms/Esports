require('dotenv').config();

const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const {
  ACTIVE_STATUSES,
  MANIFEST_PATH_FLAG,
  REQUIRED_DB_NAME,
  TARGET_DB_FLAG,
  assertExpectedDb,
  defaultManifestPath,
  normalizeRiotId,
  toObjectId,
  toIdString
} = require('./prepareValorantStagingE2EFixtures');

const printJson = (label, value) => {
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(value, null, 2));
};

const loadManifest = (manifestPath = process.env[MANIFEST_PATH_FLAG] || defaultManifestPath()) => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { manifest, manifestPath };
};

const idsFromManifest = (manifest, key) => (manifest[key] || []).map((entry) => toObjectId(entry.id));

const getClaimCollection = async (db) => {
  const exists = await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext();
  return exists ? db.collection('tournamentregistrationclaims') : null;
};

const validateTeamShape = (team, manifestUserIds) => {
  const errors = [];
  const members = Array.isArray(team?.members) ? team.members : [];
  const starters = members.filter((member) => !member.isSubstitute);
  const substitutes = members.filter((member) => member.isSubstitute);
  const captainEntries = members.filter((member) => toIdString(member.userId) === toIdString(team.captain));

  if (team.game !== 'valorant') errors.push('team game is not valorant');
  if (starters.length !== 5) errors.push(`starter count is ${starters.length}, expected 5`);
  if (substitutes.length !== 1) errors.push(`substitute count is ${substitutes.length}, expected 1`);
  if (captainEntries.length !== 1 || captainEntries[0]?.role !== 'captain' || captainEntries[0]?.isSubstitute) {
    errors.push('captain is not represented exactly once as a starter captain');
  }
  for (const member of members) {
    if (!manifestUserIds.has(toIdString(member.userId))) {
      errors.push(`member ${toIdString(member.userId)} is not in fixture manifest`);
    }
  }
  return { errors, starters: starters.length, substitutes: substitutes.length };
};

const getRegistrations = async (db, tournamentIds, teamIds) => db.collection('tournamentregistrations').find({
  $or: [
    { tournamentId: { $in: tournamentIds } },
    { teamId: { $in: teamIds } }
  ]
}).toArray();

const getClaimCounts = async (db, tournamentIds, registrationIds) => {
  const claims = await getClaimCollection(db);
  if (!claims) return { total: 0, team: 0, user: 0, riot: 0, rows: [], duplicateKeys: [] };
  const rows = await claims.find({
    $or: [
      { tournamentId: { $in: tournamentIds } },
      { registrationId: { $in: registrationIds } }
    ]
  }).toArray();
  const duplicateKeys = await claims.aggregate([
    { $match: { tournamentId: { $in: tournamentIds } } },
    {
      $group: {
        _id: { tournamentId: '$tournamentId', type: '$type', value: '$value' },
        count: { $sum: 1 },
        registrationIds: { $addToSet: '$registrationId' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  return {
    total: rows.length,
    team: rows.filter((claim) => claim.type === 'team').length,
    user: rows.filter((claim) => claim.type === 'user').length,
    riot: rows.filter((claim) => claim.type === 'riot').length,
    rows,
    duplicateKeys
  };
};

const buildValidationReport = async (db, manifest) => {
  const errors = [];
  const tournamentIds = idsFromManifest(manifest, 'tournaments');
  const userIds = idsFromManifest(manifest, 'users');
  const teamIds = idsFromManifest(manifest, 'teams');
  const userIdSet = new Set(userIds.map(toIdString));

  const [tournaments, users, teams] = await Promise.all([
    db.collection('tournaments').find({ _id: { $in: tournamentIds } }).toArray(),
    db.collection('users').find({ _id: { $in: userIds } }).toArray(),
    db.collection('teams').find({ _id: { $in: teamIds } }).toArray()
  ]);

  const tournamentReports = tournaments.map((tournament) => {
    const tournamentErrors = [];
    if (tournament.gameType !== 'valorant') tournamentErrors.push('gameType is not valorant');
    if (!['upcoming', 'registration_open'].includes(tournament.status)) tournamentErrors.push(`status ${tournament.status} is not registration-capable`);
    if (!(tournament.registrationDeadline instanceof Date) || tournament.registrationDeadline <= new Date()) {
      tournamentErrors.push('registrationDeadline is not in the future');
    }
    if (tournament.currentParticipants < 0) tournamentErrors.push('currentParticipants is negative');
    errors.push(...tournamentErrors.map((error) => ({ scope: 'tournament', id: tournament._id, error })));
    return {
      _id: tournament._id,
      name: tournament.name,
      gameType: tournament.gameType,
      status: tournament.status,
      registrationDeadline: tournament.registrationDeadline,
      currentParticipants: tournament.currentParticipants,
      errors: tournamentErrors
    };
  });

  if (tournaments.length !== tournamentIds.length) errors.push({ scope: 'tournaments', error: 'one or more manifest tournaments are missing' });

  const userReports = users.map((user) => {
    const riotId = user.gameIds?.valorant || '';
    const normalizedRiotId = normalizeRiotId(riotId);
    const userErrors = [];
    if (!normalizedRiotId) userErrors.push('missing or malformed Riot ID');
    if (user.e2eFixture?.marker !== manifest.marker) userErrors.push('fixture marker mismatch');
    errors.push(...userErrors.map((error) => ({ scope: 'user', id: user._id, error })));
    return {
      _id: user._id,
      username: user.username,
      riotId,
      normalizedRiotId,
      errors: userErrors
    };
  });
  if (users.length !== userIds.length) errors.push({ scope: 'users', error: 'one or more manifest users are missing' });

  const teamReports = teams.map((team) => {
    const shape = validateTeamShape(team, userIdSet);
    if (team.e2eFixture?.marker !== manifest.marker) shape.errors.push('fixture marker mismatch');
    errors.push(...shape.errors.map((error) => ({ scope: 'team', id: team._id, error })));
    return {
      _id: team._id,
      name: team.name,
      captain: team.captain,
      starters: shape.starters,
      substitutes: shape.substitutes,
      memberIds: team.members.map((member) => member.userId),
      errors: shape.errors
    };
  });
  if (teams.length !== teamIds.length) errors.push({ scope: 'teams', error: 'one or more manifest teams are missing' });

  const registrations = await getRegistrations(db, tournamentIds, teamIds);
  const registrationIds = registrations.map((registration) => registration._id);
  const claimCounts = await getClaimCounts(db, tournamentIds, registrationIds);

  const activeByTournament = new Map();
  for (const registration of registrations) {
    if (ACTIVE_STATUSES.includes(registration.status)) {
      const key = toIdString(registration.tournamentId);
      activeByTournament.set(key, (activeByTournament.get(key) || 0) + 1);
    }
  }

  const registrationReports = [];
  for (const registration of registrations) {
    const roster = Array.isArray(registration.roster) ? registration.roster : [];
    const starters = roster.filter((entry) => entry.role === 'starter');
    const substitutes = roster.filter((entry) => entry.role === 'substitute');
    const claims = claimCounts.rows.filter((claim) => toIdString(claim.registrationId) === toIdString(registration._id));
    const regErrors = [];
    if (ACTIVE_STATUSES.includes(registration.status)) {
      if (roster.length !== 6) regErrors.push(`roster length ${roster.length}, expected 6`);
      if (starters.length !== 5) regErrors.push(`starter count ${starters.length}, expected 5`);
      if (substitutes.length !== 1) regErrors.push(`substitute count ${substitutes.length}, expected 1`);
      if (claims.length !== 13) regErrors.push(`claim count ${claims.length}, expected 13`);
    }
    errors.push(...regErrors.map((error) => ({ scope: 'registration', id: registration._id, error })));
    registrationReports.push({
      _id: registration._id,
      tournamentId: registration.tournamentId,
      teamId: registration.teamId,
      status: registration.status,
      rosterLength: roster.length,
      starters: starters.length,
      substitutes: substitutes.length,
      expectedClaims: ACTIVE_STATUSES.includes(registration.status) ? 13 : 0,
      actualClaims: claims.length,
      errors: regErrors
    });
  }

  const participantConsistency = tournamentReports.map((tournament) => {
    const activeRegistrationCount = activeByTournament.get(toIdString(tournament._id)) || 0;
    const ok = tournament.currentParticipants === activeRegistrationCount;
    if (!ok) {
      errors.push({
        scope: 'participant-count',
        id: tournament._id,
        error: `currentParticipants ${tournament.currentParticipants}, active registrations ${activeRegistrationCount}`
      });
    }
    return {
      tournamentId: tournament._id,
      currentParticipants: tournament.currentParticipants,
      activeRegistrationCount,
      ok
    };
  });

  if (claimCounts.duplicateKeys.length > 0) {
    errors.push({ scope: 'claims', error: 'duplicate claim keys found', duplicateKeys: claimCounts.duplicateKeys });
  }

  return {
    ok: errors.length === 0,
    database: db.databaseName,
    marker: manifest.marker,
    tournaments: tournamentReports,
    users: userReports,
    teams: teamReports,
    registrationsByStatus: registrations.reduce((acc, registration) => {
      acc[registration.status] = (acc[registration.status] || 0) + 1;
      return acc;
    }, {}),
    registrations: registrationReports,
    claims: {
      total: claimCounts.total,
      team: claimCounts.team,
      user: claimCounts.user,
      riot: claimCounts.riot,
      duplicateKeys: claimCounts.duplicateKeys
    },
    participantConsistency,
    errors
  };
};

async function validateFixtures({ client, manifestPath = process.env[MANIFEST_PATH_FLAG] || defaultManifestPath(), env = process.env }) {
  const db = client.db();
  assertExpectedDb(db, env[TARGET_DB_FLAG] || REQUIRED_DB_NAME);
  const { manifest } = loadManifest(manifestPath);
  if (manifest.database !== db.databaseName) {
    throw new Error(`Manifest database ${manifest.database} does not match connected database ${db.databaseName}`);
  }
  const report = await buildValidationReport(db, manifest);
  printJson('Valorant E2E fixture validation report', report);
  if (!report.ok) {
    const error = new Error('Valorant E2E fixture validation failed');
    error.report = report;
    throw error;
  }
  return report;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    await validateFixtures({ client });
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
  buildValidationReport,
  getRegistrations,
  loadManifest,
  validateFixtures,
  validateTeamShape
};
