// Phase 2 of the auth architecture migration: backfill the new Identity
// collection from the existing legacy fields on User
// (socialAccounts.google.id, steamProfile.steamId). Purely additive -
// creates Identity documents only, never touches the legacy fields on User.
// Safe to re-run: already-migrated users are detected and skipped.
//
// Usage:
//   node server/scripts/migrateIdentities.js            # writes Identity docs
//   node server/scripts/migrateIdentities.js --dry-run   # reads + reports only

const mongoose = require('mongoose');
require('dotenv').config();

require('../models/User');
require('../models/Identity');
const identityService = require('../services/auth/identity.service');
const { IdentityAlreadyLinkedError } = identityService;

const DRY_RUN = process.argv.includes('--dry-run');

const stats = {
  google: { found: 0, created: 0, alreadyMigrated: 0, skipped: 0, conflicts: 0, errors: 0 },
  steam: { found: 0, created: 0, alreadyMigrated: 0, skipped: 0, conflicts: 0, errors: 0 }
};

async function migrateGoogleUsers(usersCollection) {
  const cursor = usersCollection.find({
    'socialAccounts.google.id': { $exists: true, $ne: '' }
  });

  for await (const user of cursor) {
    stats.google.found += 1;
    const providerId = user.socialAccounts && user.socialAccounts.google && user.socialAccounts.google.id;

    if (!providerId) {
      stats.google.skipped += 1;
      continue;
    }

    try {
      const existing = await identityService.findByProviderIdentity('google', providerId);

      if (existing) {
        if (String(existing.userId) === String(user._id)) {
          stats.google.alreadyMigrated += 1;
        } else {
          stats.google.conflicts += 1;
          console.warn(`[google] providerId ${providerId} is linked to user ${existing.userId}, but User ${user._id} also carries it on socialAccounts.google.id - needs manual review, not auto-resolved.`);
        }
        continue;
      }

      if (DRY_RUN) {
        console.log(`[dry-run][google] would create identity for user ${user._id}`);
        stats.google.created += 1;
        continue;
      }

      await identityService.createIdentity({
        userId: user._id,
        provider: 'google',
        providerId,
        canLogin: true,
        email: user.socialAccounts.google.email || user.email || '',
        emailVerifiedByProvider: true, // Google always verifies the email it asserts
        displayName: user.socialAccounts.google.name || user.fullName || '',
        username: user.username || '',
        avatarUrl: user.socialAccounts.google.picture || user.avatarUrl || '',
        profile: {},
        metadata: {},
        linkedVia: 'migrated'
      });
      stats.google.created += 1;
    } catch (error) {
      if (error instanceof IdentityAlreadyLinkedError) {
        stats.google.conflicts += 1;
        console.warn(`[google] conflict for user ${user._id}: ${error.message}`);
      } else {
        stats.google.errors += 1;
        console.error(`[google] error migrating user ${user._id}:`, error.message);
      }
    }
  }
}

async function migrateSteamUsers(usersCollection) {
  const cursor = usersCollection.find({
    'steamProfile.steamId': { $exists: true, $ne: '' }
  });

  for await (const user of cursor) {
    stats.steam.found += 1;
    const providerId = user.steamProfile && user.steamProfile.steamId;

    if (!providerId) {
      stats.steam.skipped += 1;
      continue;
    }

    try {
      const existing = await identityService.findByProviderIdentity('steam', providerId);

      if (existing) {
        if (String(existing.userId) === String(user._id)) {
          stats.steam.alreadyMigrated += 1;
        } else {
          stats.steam.conflicts += 1;
          console.warn(`[steam] providerId ${providerId} is linked to user ${existing.userId}, but User ${user._id} also carries it on steamProfile.steamId - needs manual review, not auto-resolved.`);
        }
        continue;
      }

      if (DRY_RUN) {
        console.log(`[dry-run][steam] would create identity for user ${user._id}`);
        stats.steam.created += 1;
        continue;
      }

      await identityService.createIdentity({
        userId: user._id,
        provider: 'steam',
        providerId,
        canLogin: true,
        // Steam never provides a real email - User.email for Steam-only
        // accounts is a fabricated `${steamId}@steam.local` placeholder from
        // the original signup. Do not carry that into Identity.email, since
        // a fabricated address must never participate in email-matching.
        email: '',
        emailVerifiedByProvider: false,
        displayName: user.steamProfile.displayName || '',
        username: user.username || '',
        avatarUrl: user.steamProfile.avatar || '',
        profile: {
          profileUrl: user.steamProfile.profileUrl || '',
          realName: user.steamProfile.realName || '',
          countryCode: user.steamProfile.countryCode || ''
        },
        metadata: {
          steamGames: user.steamGames || {}
        },
        linkedVia: 'migrated'
      });
      stats.steam.created += 1;
    } catch (error) {
      if (error instanceof IdentityAlreadyLinkedError) {
        stats.steam.conflicts += 1;
        console.warn(`[steam] conflict for user ${user._id}: ${error.message}`);
      } else {
        stats.steam.errors += 1;
        console.error(`[steam] error migrating user ${user._id}:`, error.message);
      }
    }
  }
}

async function run() {
  console.log(`Connecting to MongoDB...${DRY_RUN ? ' (dry-run: reads only, no writes)' : ''}`);
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const usersCollection = mongoose.connection.db.collection('users');

  console.log('\nMigrating Google identities...');
  await migrateGoogleUsers(usersCollection);

  console.log('\nMigrating Steam identities...');
  await migrateSteamUsers(usersCollection);

  console.log('\nMigration summary');
  console.log(JSON.stringify(stats, null, 2));

  const conflictsOrErrors = stats.google.errors + stats.google.conflicts + stats.steam.errors + stats.steam.conflicts;
  if (conflictsOrErrors > 0) {
    console.warn('\nCompleted with conflicts/errors - review the warnings above before relying on Identity as the source of truth (Phase 3).');
  } else {
    console.log('\nCompleted cleanly - no conflicts or errors.');
  }

  await mongoose.disconnect();
  process.exit(conflictsOrErrors > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error('Fatal error during migration:', error);
  process.exit(1);
});
