# Diagnose PAYMENT_INDEX_REQUIRED

Run from the `valorant-free-registration` repository root, using the exact
candidate deployed to the affected backend. This tool only diagnoses/provisions
the manifest indexes; it does not establish overall production payment readiness.

The script uses the native MongoDB driver without importing application models,
so an audit cannot trigger Mongoose automatic index creation. It does not contact
Razorpay, create payments, or edit registrations.

## Read-only audit

In a backend hosting shell where `MONGODB_URI` is already set:

```sh
node server/scripts/valorant-payment-indexes.cjs --database YOUR_DATABASE_NAME
```

For a local env file, add `--env-file PATH`. Existing process environment values
take precedence over the file. Never paste the URI into the command or reports.
The explicit database name must match the database selected by the URI; mismatch
stops execution. There is no default local database fallback.

Output lists every required collection/index as `ok`, `missing`, or `conflict`.
Exit status 2 means missing/conflicting indexes or a legacy unique owner index;
status 1 means the operation failed. MongoDB error code 13 indicates insufficient
authorization. Missing namespaces (code 26) are treated as missing indexes;
permission and connection failures stop the audit instead.

## Add missing indexes after reviewing the target and report

```sh
node server/scripts/valorant-payment-indexes.cjs --database YOUR_DATABASE_NAME --apply
```

Append the same `--env-file PATH` if used during the audit. Apply re-audits and
creates only missing definitions from `indexes.json`. Without the explicit owner
migration flag it never drops indexes, and it never synchronizes indexes or
changes documents. A failed build can leave
earlier successfully created indexes in place; fix the reported issue and re-audit.
Rerunning is safe for already matching definitions.

Conflicting names/definitions or an index with the same key/filter under another name
require review. The tool refuses all writes when such conflicts are present.
It also refuses writes if the legacy `{ tournamentId: 1, userId: 1 }` unique index
exists: use the reviewed migration below, rather than dropping it manually.

## Production migration for the audited main deployment

The supplied production audit confirmed the six financial collections are missing,
the claim/payment-link indexes match, and `tournamentId_1_userId_1` is unique.
The old main schema also declares that unconditional unique index. Index setup
alone is insufficient: deploy the accompanying model and registration changes.

1. Set `VALORANT_CHECKOUT_PAUSED=true` in the production backend environment.
   Keep existing verification/webhooks/recovery available; do not turn off the
   worker as a way to pause checkout. Keep test/live mode unchanged.
2. Deploy the reviewed fix through `main`. Confirm all old instances have drained.
   The updated Registration model disables automatic indexing and no longer
   declares the unconditional unique owner index. No migration runs on startup.
3. From Render's backend shell at the repository root, run the read-only audit
   above against the explicit database name and review its output.
4. Run the explicit migration (this is a production schema change):

```sh
node server/scripts/valorant-payment-indexes.cjs --database YOUR_DATABASE_NAME --apply --migrate-legacy-owner
```

This flag requires the paused-checkout environment setting. It provisions missing
manifest indexes, verifies both replacement owner indexes, then removes only
the unconditional `tournamentId_1_userId_1` index. Unknown owner index names or
incompatible definitions stop execution. No documents are rewritten/deleted.

The replacements preserve unique tournament/captain ownership for every missing
or null `registrationFlow`, including all historical rows and new legacy game
registrations. New free/paid Valorant rows alone get the server-owned immutable
marker `valorant_v1`; they have a unique active-owner index and existing exclusive
claims. Rejected Valorant rows remain as history and can be followed by a new
active attempt. Existing unmarked Valorant history needs no backfill; active
rosters are still checked by the transaction-serialized registration service.

5. Re-audit: every row must be `ok`, with `legacyOwnerUnique:false`.
6. Verify the exact candidate in an isolated Razorpay TEST environment, including
   capture/registration, webhook replay, rejection/retry and refunds. After the
   remaining production release gates are complete, resume new checkout.

Recovery: keep checkout paused if any step fails. Index creation is not an atomic
batch; a rerun preserves earlier successful work. Keep the new model and owner
policy deployed after migration. Do not roll back to the old schema or rebuild
the unconditional unique index once repeated Valorant histories exist. A code
rollback needs a compatible forward repair while retaining financial records.

If MongoDB reports code 11000 while building a unique index, existing duplicates
require investigation. The tool preserves those records and does not resolve
financial duplicates automatically. Other collection-level settings can also
prevent index creation; an unsuccessful apply is not a successful repair.

After applying, run the read-only audit again, confirm all rows are `ok` and
`legacyOwnerUnique` is false, then retry the blocked checkout. The guard reads
physical indexes on each request, so index provisioning alone does not require
an application restart. Deploying this new tool to a hosting shell may require
your normal release process. Preserve the remaining staging, transaction,
legacy-data, merchant, monitoring and live-payment release gates in README.md.

## Local verification

```sh
node --test server/features/payments/payment-indexes.test.js
```

Tests use a disposable loopback MongoDB replica set, block external connections,
and verify read-only audit, repeatable provisioning, the actual payment guard,
index/data preservation, explicit paused migration, legacy uniqueness, Valorant
rejected-history retry, conflicts, permissions and duplicate-data handling.

Local verification for this repair: 65 focused checks passed; after disabling
Registration automatic indexing, `npm run test:backend` passed all 189 checks
with zero failures/skips. No hosted database or Razorpay request was made.
