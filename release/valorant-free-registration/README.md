# Free Valorant registration candidate

Base: `70111b5d2e47a896a9d081dbfca3536d63b6bf63` (main after PR #8).
Branch: `release/valorant-free-registration`.

This candidate adapts the pure manual Riot ID/roster helpers from pre-payment
commit `3d7fe38653075cd213e5ddb6b86d1585b62c280d`. That commit is not merged or
cherry-picked. Its auth/provider/team architecture and payment descendants are
not brought into this candidate.

## Product behavior

- Self-service Riot ID editing reuses `User.gameIds.valorant`. IDs are saved
  manually, not Riot-verified. Empty clears; omitted preserves. The authenticated
  profile API updates only its current user and preserves other game IDs/privacy.
- Only zero-fee Valorant tournaments are eligible. Paid, invalid-fee and other-game
  requests fail closed; no checkout, wallet debit, registration bonus or external
  notification is added.
- An active saved Valorant team's captain submits only `teamId`. The server reads
  six active platform users and their saved IDs: five starters including exactly
  one captain, and one substitute. Client-supplied IDs/rosters are ignored.
- Registration, capacity, tournament participant entry and 13 exclusive claims
  (team + six user IDs + six normalized Riot IDs) commit or roll back together.
  The service uses the same tournament transaction lock as competitive results.
- Admins/moderators may verify pending/submitted rosters, or reject them with a
  reason. Captains may cancel pending registrations. Rejection/cancellation keeps
  the record as rejected history and releases capacity/claims transactionally.
  Verified or already-rejected registrations cannot be reactivated, rejected or
  cancelled through these endpoints. A new attempt can be submitted while open.
- Immutable roster snapshots retain user IDs so future profile ID changes do not
  move historical statistics/history to another player. Existing competitive
  result APIs consume the verified registration unchanged.
- Redis catalogue invalidation happens only after commit; disabled/unavailable
  Redis remains non-fatal. No schedulers or external notification workers are added.

## API / frontend scope

- `PUT /api/auth/profile`: accept validated `gameIds.valorant`.
- `POST /api/valorant-registration/:tournamentId/register`.
- `POST /api/valorant-registration/:registrationId/verify|reject|cancel`.
- `GET /api/valorant-registration/my-registrations[?tournamentId=...]`: own history.
- `GET /api/valorant-registration/tournament/:tournamentId/teams`: public names,
  statuses and registration dates only; no roster IDs, phones or emails.
- `GET /api/valorant-registration/admin/tournament/:tournamentId?page=1`:
  admin/moderator roster review, pages of 100.
- Existing Profile Settings includes Riot ID editing in the shared form.
- Existing tournament team selection submits the authoritative free registration.
- Existing tournament page shows the captain's pending/verified state and pending
  cancellation. Controls links to `/admin/valorant-registrations` for admin/moderator.

The BGMI/Free Fire routers reject Valorant tournament/registration IDs so legacy
status/delete/debug paths cannot bypass claims/counters. Their own game lifecycle
is unchanged. Generic tournament join/leave rejects Valorant; the dedicated flow
must be used. Tournament registration-status reads exclude rejected attempts only
for Valorant, retaining prior BGMI/Free Fire behavior.

## Additive schema and index requirements

`TournamentRegistration` adds optional historical-compatible roster/Riot fields.
Existing documents are not backfilled, rewritten or deleted. Existing registration
index declarations are preserved; add only the non-unique roster query index
described below. Do not run `syncIndexes()` or drop an index.

The only new collection is `tournamentregistrationclaims`, using model
`TournamentRegistrationClaim`. Review physical definitions against `indexes.json`:

1. Automatic `_id_` index.
2. Unique `uniq_tournament_registration_claim` on
   `{ tournamentId: 1, type: 1, value: 1 }` with no sparse/partial/collation options.
3. Non-unique `registrationId_1` on `{ registrationId: 1 }`.

The existing `tournamentregistrations` collection additionally requires one
non-unique `valorant_roster_user_status` index on `{ 'roster.userId': 1, status: 1 }`.
Participation queries retain the existing owner branch and additionally include
authoritative roster user IDs, so all six players appear in tournament history,
profiles and participation totals. This does not match on editable Riot strings.
Total provisioning scope: one new collection, three secondary indexes (two on
claims, one on registrations), plus the new collection's automatic `_id_` index.

The registration API verifies the unique claim index before attempting writes and
returns `REGISTRATION_INDEX_REQUIRED` (503) if it is missing/incompatible. This
check does not create an index. Normal Mongoose auto-index behavior is unchanged;
therefore provision/review the database before deploying the candidate. No new
environment variable or dependency is introduced.

### Required read-only production compatibility review (not performed here)

Obtain separate explicit authorization before using dedicated production read-only
credentials for database `colab-esports`. Confirm topology supports transactions,
actual registration/claims indexes, existing Valorant registrations, tournament
participants/counters and user/team references. Do not print credentials.

- The previously audited non-unique `{ tournamentId: 1, userId: 1 }` index supports
  rejected history plus a new registration attempt. Verify it again for this
  release. If an actual unique owner index exists, re-registration fails cleanly
  with 409 and full rollback. That state is NO-GO for the approved retry policy;
  obtain a separate index-policy decision. This candidate never drops/replaces it.
- Legacy active Valorant rows without a six-player snapshot or unmatched legacy
  tournament participants fail with `LEGACY_VALORANT_REVIEW_REQUIRED`; mismatched
  counters fail with `CAPACITY_STATE_MISMATCH`. They are not silently repaired or
  migrated. Their intended owners/rosters require an owner-approved plan.
- If an existing claims collection has unexpected fields, conflicting values or
  indexes, stop. No payment-owned claim/intent conversion is included.

## Local / staging validation boundaries

Backend integration tests allocate fresh loopback MongoDB replica sets and verify
transactions, uniqueness, capacity races, overlap, rollback, rejected history,
legacy API boundaries, privacy, role access, profile save/read/clear, and result
statistics/history compatibility. No hosted database or real account is used.

The existing opt-in Phase 2 staging guard retains its exact database/service/user,
permissions, disabled schedulers, auto-index restrictions and blocked transports.
Its request allowlist additionally permits this free registration lifecycle and
the self-profile GET/PUT needed for Riot ID testing. Team creation, signup,
payments, providers, uploads and messaging remain blocked. Staff/captain auth is
still enforced by the application. Normal production startup remains unchanged.

Hosted staging has NOT been deployed or tested for this candidate. Before doing so,
obtain approval for an exact isolated fixture/index plan and the deployment window.
Do not reuse or overwrite the existing 41-document staging baseline without that
approval. Synthetic users/teams/tournaments must have separately tracked IDs.

Final local evidence (2026-10-17):

- `npm run test:backend`: 143 passed, zero failed/skipped. Includes real disposable
  MongoDB replica-set concurrency/rollback, existing game/competitive regressions,
  normal server startup and opt-in staging safety checks.
- `CI=true npm test -- --watchAll=false --runInBand` in `client`: 63 passed across
  12 suites, zero failed. Includes profile editing, role-scoped navigation/admin
  actions, captain team selection and registration/cancellation UI tests.
- `CI=true npm run build` in `client`: compiled successfully. Existing browser
  metadata/deprecation and bundle-size notices remain non-blocking.
- `git diff --check`: passed. Dependency manifests/lockfiles, User/Team/Tournament
  schemas, payment services and deployment environment configuration are unchanged.
- Test logs and generated build/dependency directories remain Git-ignored.

These results are local automated checks, not Atlas/Render/Vercel/browser approval.

Staging checks: six independent users save valid IDs; captain registers; duplicate
and last-slot attempts conflict; ordinary/designer users cannot review; moderator
verifies; admin publishes/edits/voids a result; rostered player history/statistics
remain correct; pending cancellation/rejection permits a fresh attempt; public
rosters do not expose IDs; BGMI/Free Fire, Explore, Games and existing result pages
remain operational; all provider/payment calls remain unavailable.

## Release and recovery

1. Review local diff and final test/build evidence; commit/push/PR only after approval.
2. Complete separately authorized production compatibility and isolated staging.
3. Review backup/recovery readiness and approve exact additive claim provisioning.
   No provisioning, migration or hosted operation has been executed here.
4. Confirm only this candidate is being deployed, verify physical indexes and
   start production with its existing normal configuration after merge approval.
5. Run read-only smoke checks. Do not create synthetic production registrations.

If the release must be stopped, stop new Valorant registrations first and retain
all registration/claim data. A rollback to prior main preserves additive documents
but does not provide their transactional lifecycle; do not manage new Valorant
records through old game-specific admin endpoints. Agree an application rollback
or forward-fix procedure with the owner; never drop collections/indexes as cleanup.

Status: local implementation candidate; production/staging approval remains pending.
