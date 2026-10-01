require('dotenv').config();

const mongoose = require('mongoose');

const ACTIVE_STATUSES = ['pending', 'images_uploaded', 'verified'];

const uri = process.env.MONGODB_URI;

const printJson = (label, value) => {
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(value, null, 2));
};

async function main() {
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const hello = await db.admin().command({ hello: 1 });
  printJson('Mongo transaction capability', {
    setName: hello.setName || null,
    msg: hello.msg || null,
    isWritablePrimary: hello.isWritablePrimary,
    logicalSessionTimeoutMinutes: hello.logicalSessionTimeoutMinutes || null,
    transactionCapable: Boolean(hello.setName || hello.msg === 'isdbgrid')
  });

  const registrations = db.collection('tournamentregistrations');
  const claims = db.collection('tournamentregistrationclaims');

  printJson('TournamentRegistration indexes', await registrations.indexes());
  printJson('TournamentRegistrationClaim indexes', await claims.indexes().catch((error) => ({
    error: error.message
  })));

  const activeValorantMatch = {
    status: { $in: ACTIVE_STATUSES }
  };

  const duplicateTeams = await registrations.aggregate([
    { $match: activeValorantMatch },
    {
      $lookup: {
        from: 'tournaments',
        localField: 'tournamentId',
        foreignField: '_id',
        as: 'tournament'
      }
    },
    { $unwind: '$tournament' },
    { $match: { 'tournament.gameType': 'valorant', teamId: { $ne: null } } },
    {
      $group: {
        _id: { tournamentId: '$tournamentId', teamId: '$teamId' },
        count: { $sum: 1 },
        registrationIds: { $push: '$_id' },
        teamNames: { $addToSet: '$teamName' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  printJson('Active duplicate Valorant teams', duplicateTeams);

  const duplicateRosterUsers = await registrations.aggregate([
    { $match: activeValorantMatch },
    {
      $lookup: {
        from: 'tournaments',
        localField: 'tournamentId',
        foreignField: '_id',
        as: 'tournament'
      }
    },
    { $unwind: '$tournament' },
    { $match: { 'tournament.gameType': 'valorant' } },
    { $unwind: '$roster' },
    {
      $group: {
        _id: { tournamentId: '$tournamentId', userId: '$roster.userId' },
        count: { $sum: 1 },
        registrationIds: { $addToSet: '$_id' },
        teams: { $addToSet: '$teamName' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  printJson('Active duplicate Valorant roster users', duplicateRosterUsers);

  const duplicateRiotIds = await registrations.aggregate([
    { $match: activeValorantMatch },
    {
      $lookup: {
        from: 'tournaments',
        localField: 'tournamentId',
        foreignField: '_id',
        as: 'tournament'
      }
    },
    { $unwind: '$tournament' },
    { $match: { 'tournament.gameType': 'valorant' } },
    { $unwind: '$roster' },
    { $match: { 'roster.normalizedRiotId': { $type: 'string', $ne: '' } } },
    {
      $group: {
        _id: { tournamentId: '$tournamentId', normalizedRiotId: '$roster.normalizedRiotId' },
        count: { $sum: 1 },
        registrationIds: { $addToSet: '$_id' },
        teams: { $addToSet: '$teamName' },
        riotIds: { $addToSet: '$roster.riotId' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  printJson('Active duplicate Valorant Riot IDs', duplicateRiotIds);

  const participantMismatches = await db.collection('tournaments').aggregate([
    { $match: { gameType: 'valorant' } },
    {
      $lookup: {
        from: 'tournamentregistrations',
        let: { tournamentId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$tournamentId', '$$tournamentId'] },
              status: { $in: ACTIVE_STATUSES }
            }
          },
          { $count: 'activeCount' }
        ],
        as: 'activeRegistrations'
      }
    },
    {
      $addFields: {
        activeRegistrationCount: {
          $ifNull: [{ $arrayElemAt: ['$activeRegistrations.activeCount', 0] }, 0]
        }
      }
    },
    { $match: { $expr: { $ne: ['$currentParticipants', '$activeRegistrationCount'] } } },
    {
      $project: {
        name: 1,
        currentParticipants: 1,
        activeRegistrationCount: 1
      }
    }
  ]).toArray();
  printJson('Valorant participant-count mismatches', participantMismatches);

  const claimBackfillNeeded = await registrations.aggregate([
    { $match: activeValorantMatch },
    {
      $lookup: {
        from: 'tournaments',
        localField: 'tournamentId',
        foreignField: '_id',
        as: 'tournament'
      }
    },
    { $unwind: '$tournament' },
    { $match: { 'tournament.gameType': 'valorant' } },
    {
      $lookup: {
        from: 'tournamentregistrationclaims',
        localField: '_id',
        foreignField: 'registrationId',
        as: 'claims'
      }
    },
    {
      $project: {
        teamName: 1,
        tournamentId: 1,
        status: 1,
        rosterSize: { $size: { $ifNull: ['$roster', []] } },
        claimCount: { $size: '$claims' },
        expectedClaimCount: 13
      }
    },
    { $match: { $expr: { $ne: ['$claimCount', '$expectedClaimCount'] } } }
  ]).toArray();
  printJson('Active Valorant registrations requiring claim backfill', claimBackfillNeeded);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
