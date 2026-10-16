# Phase 2 competitive release review

**GO for code-review PR preparation; production approval pending validation.** No confirmed security blocker remains from the bounded release review: all five game mutation routes now require current authenticated admin/moderator/designer roles, and Mongoose is patched to 7.8.10. The discontinued CS2 endpoint stays unmounted. Remaining advisory, staging and deployment/data gates are detailed in [dependency readiness](dependencies/README.md); production deployment remains NO-GO until those gates are closed.

## Remaining release gates and opt-in staging startup (2026-10-16)

The isolated Atlas run for candidate 6b6afacbf85df7191bf38849a9cfcf17cf4f44cb passed all nine controlled validation groups. Its nine application collections, 60 indexes and 41 synthetic documents remain in colab-esports-phase2-test; setup_check fingerprint comparison passed. This startup patch does not repeat or modify those Atlas fixtures/tests.

The pending bounded startup change adds server/staging/phase2-start.cjs and phase2-safety.js, with two integration hooks in server/index.js. Normal startup stays unchanged. The opt-in entrypoint verifies the dedicated Atlas URI, connected identity and target-confined CRUD privileges before loading the application, disables autoCreate/autoIndex and the scheduler, disables Redis/dotenv credential inheritance, clears provider/payment keys, blocks outbound non-Atlas connections and HTTP provider transports, and restricts staging writes to login/competitive-result operations. OAuth, registration, wallet/store, notifications/uploads and unrelated mutations are unavailable during this window. Competitive services and ordinary public reads remain available. Local login retains its existing test-user login metadata updates; no authentication behavior was redesigned.

Required Esports-dev settings after owner approval: PHASE2_STAGING=true, NODE_ENV=production, MONGODB_URI containing only the dedicated colab_phase2_tester URI with explicit colab-esports-phase2-test database, a fresh staging JWT_SECRET of at least 32 characters, CLIENT_URL and SERVER_URL pointing only to the approved staging frontend/API. Use start command `node server/staging/phase2-start.cjs`, locked backend installation (`npm ci --omit=dev`) and GET /api/phase2-readiness for guarded readiness. REDIS_DISABLED=true is enforced by the entrypoint. Record original commands, values/absences, linked environment groups, branch and Auto-Deploy before changes; do not edit shared groups. The new files require a new reviewed candidate commit before any remote deployment; they are not present in 6b6afac.

The focused production MongoDB compatibility audit is NOT performed: separate explicit authorization and dedicated read-only credentials remain required. Check actual physical result/registration indexes, duplicate result keys, ambiguous owner/team registrations, missing/cross-game references and legacy shapes using read-only commands, with no application startup, index repairs or migrations. Do not use the test user's URI or existing application production credentials for that audit.

Focused local validation: PASS, 8 staging guard tests (URI/identity/privilege rejection, external-transport blocking, request restrictions, auto-index settings and readiness/reconnect gating; Atlas metadata is mocked). PASS, the affected normal full-entrypoint regression with a real disposable loopback MongoDB replica set. Its first sandboxed connection timed out; the permitted retry outside network sandbox restrictions passed. No new Atlas connection or full staging deployment is claimed. Existing Atlas groups and frontend build/tests were not repeated. Git diff --check passes. Evidence: ignored .cache/phase2-staging-tests.log and phase2-staging-entrypoint.log.

Remaining staging prerequisites: owner-approved Render window and rollback settings, a frontend targeting only Esports-dev, and owner-approved usable synthetic login credentials (the seeded random plaintext password was not retained). Explore content/friend-action mutation fixtures require separate approval; the current controlled scope supports their read/empty-state checks only. Browser and actual deployed API validation remain outstanding. Existing conditional dependency-advisory environment checks remain outstanding; this patch makes no new registry-audit claim. PR #7 remains NO-GO for merge until the remaining gates are closed. Git preparation now authorizes committing and pushing only the five reviewed staging-related files to release/phase2-competitive; merge and deployment remain excluded. The requested Git-preparation rerun passed all 8 focused guard tests plus the normal full-entrypoint regression (9 total, zero failures/skips); evidence is ignored .cache/phase2-staging-git-checks.log.

## Bounded competitive-consumer compatibility (2026-10-15)

The broader registration lifecycle redesign is excluded. Competitive results do not require the proposed partial unique registration index or any new re-registration, capacity, reward or notification behavior. The registration schema, indexes, creation/status/cancellation/deletion handlers, counters, rewards and notifications remain unchanged. The two registration-router /make-admin removals remain required security fixes.

Implemented only in competitive consumers:

- Shared entrant validation rejects missing owners and distinct registration attempts for the same owner. Linked teams must be active, match the game and contain the registration owner as captain/member; missing canonical links remain supported ad-hoc registrations.
- Free Fire and Valorant reject duplicate-owner entrants before writes. BGMI result writes require exactly one verified team registration with a valid owner/team relationship.
- Final preview/publication checks all Free Fire/Valorant source registration identities before aggregation. It rejects duplicate-owner attempts, multiple registration identities for a canonical team, inconsistent snapshot links, missing/cross-tournament registrations and duplicate historical match/lobby rows. Repeating the same registration across separate valid matches remains supported. Manual finals retain verified-registration requirements and now reject duplicate owners.
- Verified match snapshots remain historical competition facts after later rejection. Derived finals do not reinterpret current registration status; manual finals and new match verification still require verified registrations. Later registration rejection does not automatically void results or invalidate finals. Result transactions serialize result operations only, not unchanged registration writes; no stronger cross-system guarantee is claimed. Existing published snapshots are not migrated or silently rewritten.
- Statistics count distinct existing supported tournaments across registration and participant sources, independent of the 50-row history window. Orphaned and duplicate registration rows are omitted from the recent participation list. Public registration queries continue to exclude rejected history.

Deferred production registration risks are pre-existing: read-before-write roster/capacity checks; independent BGMI-only count/group hooks; repeat-bonus potential; inconsistent alternate joins and historical registration-status readers. They are not fixed or made prerequisites for competitive features. No registration index replacement is part of Phase 2. The existing physical/schema index discrepancy still needs environment review; never run syncIndexes or auto-repair it against a shared database.

Regression evidence uses a fresh loopback replica set with a deliberately non-unique tournamentId/userId registration index, synthetic duplicates/rejected history/ad-hoc teams, concurrent rejected result attempts, unchanged registration-document assertions, rollback of failed final publication, and valid repeated-match aggregation. No existing MongoDB database/index/record or hosting setting is touched. The registration-schema uniqueness assertion was replaced with a physical legacy-index compatibility assertion.

This compatibility patch is based on candidate a903266d4c93093ab4d4579a513629112fa61ca7. Validation results for this patch are recorded below separately from the older candidate evidence. Its commit/push to the release branch for PR #7 is authorized; merge and deployment remain excluded.

| Current patch check | Result |
|---|---|
| Complete backend automated suite | PASS: 110 tests, zero failures/cancellations/skips (13 more tests than the candidate baseline) |
| Real MongoDB compatibility/concurrency/rollback | PASS in disposable loopback MongoDB 8.2.6 replica sets; non-unique legacy registration index, duplicate owners, rejected history, ad-hoc teams, canonical-link conflicts, repeated matches, unchanged registration records, concurrent rejected result writes and failed publication rollback covered |
| Backend startup | PASS: full production-mode entrypoint launches with synthetic configuration, disposable MongoDB and outbound-network guard; neighboring APIs/login and Socket.IO checks pass |
| Frontend tests | PASS: 18 tests in 4 suites with CI=true |
| Frontend production build | PASS: CI=true, compiled successfully; tooling reports existing outdated browser data and Node fs.F_OK deprecation notices |
| Git scope/diff | PASS: diff --check; no working-tree edits to models, registration/tournament routes, dependencies/lockfiles, authentication, wallet or payment code |

Evidence: ignored .cache/consumer-backend.log in this worktree and ../.cache/phase2-competitive-evidence/client.log and build.log. Pending release/dependencies/README.md validation notes were reviewed during Git preparation and corrected to reflect the orphaned tournament references and bounded compatibility evidence. No new dependency or registry-audit claim is made.

Ready for review/update of PR #7 after owner review, but production remains gated on authorized isolated candidate deployment, target transaction/result-index/schema checks, real browser/provider flows, representative performance, and remaining conditional runtime-advisory configuration verification. Production metadata/data were not inspected. Registration redesign is not a prerequisite for this bounded feature release; its pre-existing risks remain explicitly deferred.

## Validation gates after PR #7

Candidate tested: a903266d4c93093ab4d4579a513629112fa61ca7, branch release/phase2-competitive, draft PR https://github.com/Colab-Platforms/Esports/pull/7. Checks performed 2026-10-15. The findings below supersede earlier unverified environment assumptions. This validation stage changes documentation only; no dependency/source change, commit, push, merge or deployment was performed.

| Release gate | Status | Evidence and exact remaining action |
|---|---|---|
| 1: MongoDB | **FAIL** | Prior checks connected only to colab-esports-dev. Read-transaction commit and synthetic write/read/abort passed; the new namespace was absent afterward. Result unique indexes are present. The candidate declares a full unique tournamentId+userId index while development has a non-unique index; no registration-index change is included in the bounded competitive release. Two linked registrations reference a missing tournament, so its game cannot be determined; the earlier wrong-game classification was incorrect. No index/data correction was attempted. |
| 2: Remaining runtime advisories | **BLOCKED** | Fresh online audit still reports 20 production packages: 2 critical, 11 high, 7 moderate. All are individually classified in dependency readiness. No additional confirmed reachable flaw requiring a code change was established in the inspected application usage. Actual serving-environment proxy/NO_PROXY/redirect assumptions for the shared Axios stack have not been verified; obtain a sanitized configuration attestation or authorized development runtime tests. No blind/shared payment dependency upgrade was applied. |
| 3: Application/deployment validation | **BLOCKED** | Automated checks PASS: 97 backend tests, 18 frontend tests, CI=true build, real disposable MongoDB concurrency/rollback, authorization, error behavior and actual backend entrypoint startup. Live development DB query explain also ran. No authorized deployed frontend/API URL running this candidate was available: configured URLs are localhost:3001 and localhost:5003. Provide confirmed development URLs/build SHA and disposable test identities/fixtures through secure access for actual deployed browser/API and provider checks. Do not deploy as part of this request. |

Development database evidence (no production contact):

- URI target was parsed and checked before connecting; the driver was bound explicitly to colab-esports-dev. No full application startup, scheduler, Mongoose connection/autoIndex, index creation/drop, existing-data update/delete or migration was run. Only a fresh, verified-absent synthetic namespace was written inside an aborted transaction; no test collection remained.
- Replica set and logical sessions are available (wire version 25). Snapshot/majority read transaction committed; synthetic write read-back and abort passed. A committed synthetic write was not tested. Production topology/privileges remain uninspected and cannot be inferred from development.
- Checked actual index metadata for Tournament, User, Team, TournamentRegistration, BGMIMatch, BGMILeaderboard, FreeFireMatchResult, ValorantMatchResult and TournamentFinalResult. Required result uniqueness keys exist (FF tournament+match+lobby; Valorant tournament+match; final tournament; BGMI leaderboard tournament+team), including the additive BGMIMatch result index. Existing unique User email/username/phone indexes satisfy the duplicate non-unique schema declarations; do not create weaker duplicates.
- No duplicate tournamentId+userId groups were found among the current 11 development registrations. This does NOT justify imposing a unique constraint on the shared dev application: its current non-unique policy may be intentional and must be reconciled by an owner. Do not drop/rebuild indexes or run syncIndexes. The candidate should not be started against this shared DB with automatic indexing enabled as a substitute for that decision.
- Of 11 registrations, 6 have no canonical team link (supported legacy/ad-hoc form), 3 have valid matching-game current-owner links, and 2 reference the same missing tournament (verified: 1, pending: 1). Those two linked teams are active Valorant teams with current owner membership; the missing tournament's game is unknown. Tournament lookup fails before game-link validation. Do not infer ownership, reconstruct the missing tournament or relink by name. No missing/inactive linked teams or departed owners were found in these 11 records.
- All 29 sampled/current tournaments lack resultRevision; the existing synthetic regression proves lazy initialization, so no backfill was run. No sampled registration userId/tournamentId had a non-ObjectId type. User provider counts were 146 local and 17 Google; this dataset cannot validate live legacy Steam records. These are targeted shape checks, not validation of every field/document against every schema.
- The actual candidate Free Fire leaderboard adapter pipeline was captured without opening a Mongoose connection and explained through the native driver. Two existing source documents and two index keys were examined; observed server execution was 0–1 ms, end-to-end driver round trip 6–8 ms. This is not HTTP latency, browser timing, load testing or production-scale proof. Representative volume/query plans and p95/p99 endpoint timing remain required.

Evidence kept outside tracked source: candidate .cache/dev-target-check.json, dev-mongodb-gate.json, dev-readonly-review.json, gates-audit-runtime.json and gates-backend.log; frontend client.log/build.log under ../.cache/phase2-competitive-evidence/. Credentials, host connection strings, user names/emails, record IDs and raw legacy records are not included in this report. The initial index comparison's User non-unique warnings were checked against actual stronger unique indexes and are not blockers.

Required next actions (stop here; environmental/ownership decisions are needed):

1. Validate the bounded competitive consumers in an authorized isolated environment; registration lifecycle redesign and partial-index replacement are excluded. Review the two orphaned tournament references without guessing replacement links. Do not change shared indexes automatically; no existing record may be deleted/overwritten under this task.
2. Confirm the actual authorized development frontend/API URLs and that their deployed build matches this exact release SHA (currently no deployment of this candidate was requested). Supply disposable user/admin/moderator/designer test identities through secure access, not plaintext credentials in a report.
3. In that environment, run normal and invalid login, free BGMI/FF/Valorant registration, profile/friend/team/Explore/leaderboard/tournament flows, then publish/edit/void and concurrent publication on newly created synthetic free fixtures. Verify unauthorized roles, stale final invalidation, duplicate 409s, private data filtering, Google/Steam and Cloudinary/provider behavior. Do not alter existing users, tournaments or registrations, or invoke payments.
4. Validate proxy topology, forwarded headers, outbound proxy/NO_PROXY behavior and conditional advisory preconditions; record representative query plans and endpoint latency under realistic volume. Recheck required indexes before enabling result writes. Any eventual production verification needs separate explicit database authorization; nothing here certifies production data/index parity.

## Candidate and boundaries

- Branch: release/phase2-competitive.
- Isolated worktree: C:/Users/user/Desktop/Esports/release-phase2-competitive.
- Verified remote main/base: 8a8a09ce71117a19f9fdd321102eebbae5dfb31b.
- Feature source: 9350489ba3e4559568d95260874b462c4324aa4c; selected modules and integration hunks only.
- Implementation/test evidence below was recorded before staging or committing. Subsequent Git preparation was explicitly authorized: commit/push only this release branch and prepare its review PR. Main/dev and the unfinished release-fix worktree remain outside the change scope; no merge/deployment is authorized.
- No production database, service configuration or credentials accessed. Automated database tests use synthetic loopback replica sets; the additional approved development-only native-driver checks above inspected live metadata/limited shapes and an aborted synthetic transaction.

## Delivered behavior

- Existing public player profile and friend actions remain. Competitive panels show production-model game accounts, history, numeric statistics and supported public team links.
- Public team profiles and verified team rankings cover BGMI, Free Fire and Valorant. Existing CS2 routes/leaderboard implementation remain; new CS2 team rankings/profiles are not invented. CS2 player history requires the existing connected Steam profile and respects disconnection.
- /leaderboard retains the production page. New /competitive-leaderboards and /tournament-results routes provide canonical-team rankings and tournament final standings separately.
- /team/:teamId provides supported public competitive team profiles. Tournament pages have a results tab, including ?tab=results navigation.
- /admin/results provides manual Free Fire/Valorant result management and BGMI/Free Fire/Valorant final publication, using existing verified registrations. No new registration flow, team-link creation flow or OCR service is introduced.
- Registration /make-admin handlers are removed. BGMI player writes require membership in an active BGMI team with a verified tournament registration. Score/proof edits clear verification. Verification requires an admin.
- BGMI legacy totals rebuild from verified source rows inside the transaction: repeated verification does not inflate totals, and unverified edits remove prior totals. Its public reads omit room secrets, private proofs, draft rows and private canonical links.
- Free Fire/Valorant result transitions and final publication share a tournament transaction lock. Source mutation, legacy projection where applicable, and final invalidation commit or roll back together. Void results cannot be verified/edited back into circulation.
- Linked registrations are checked against active, matching-game teams and registration-owner membership. Ad-hoc records remain valid without canonical links. Duplicate canonical teams, forged totals, invalid counts and invalid ranks are rejected.
- Public result scores and submitted team-name snapshots remain competition facts. Structured roster identifiers are omitted; canonical links respect current public/active team visibility. Private player identities are omitted from public team rosters. Saved editable game IDs cannot claim another player's individual result history.
- No Identity imports/migrations, development authentication/provider work, registration-index changes, dashboard/streak/store/wallet features, registration-intent modules or new payment integration. The pre-existing Razorpay dependency in main is unchanged. The only User schema addition is optional server-owned avatarAsset image metadata, hidden by default and not writable through profile input.

## Root causes and fixes

| Blocker | Minimal release fix |
|---|---|
| Self-elevation endpoints bypass result roles | Remove the two handlers; exercise real authenticated HTTP requests |
| Arbitrary BGMI team edits retain verified status | Check membership/registration, validate counts, clear verification, rebuild totals and invalidate finals |
| Read-then-write publication can race with score edits | Tournament resultRevision write lock plus snapshot/majority transactions on every competitive result mutation |
| Verify/void races resurrect invalid results | Serialize transitions and reject terminal void state |
| Player profile requires unreleased Identity model | Use existing User fields and explicitly unverified saved IDs |
| Public snapshots retain sensitive roster/link data | Live team visibility filtering, no public roster identifiers, private-player roster filtering |
| Valorant snapshot projection omits newer roster shape | Select roster and support both newer and legacy registration shapes |
| Replacing whole development pages removes production behavior | Add competitive views/panels while retaining existing routes and friend/CS2 behavior |
| Starter tests and lint warnings block CI | Repair test dependencies/imports, use production Redux store, replace starter assertion, fix only production-build lint blockers; no global warning suppression |
| Discontinued CS2 status endpoint still accepts unauthenticated writes | Remove only its mount; actual-entrypoint regression checks anonymous and all roles, single/bulk requests, unchanged stored tournament and neighboring APIs |
| Public compression, Socket.IO and multipart dependencies have reachable advisories | Compatible targeted patches, exact direct pins and reviewed transitive lock changes; see dependency readiness |
| Editable avatar URL controls destructive Cloudinary parameters | Patch SDK to 2.7.0/signature v2; use owner-scoped random avatar IDs and server-recorded ownership; never derive deletion targets from display URLs |
| Site-image role restriction is documented but unenforced | Apply existing admin/designer/moderator middleware before multipart processing; preserve avatar/logo and tournament ownership flows |
| Five game mutation handlers lack authentication/authorization | Apply existing auth then adminAuth on each write; preserve public GETs and the current Games Management role policy |
| Raw updates reach vulnerable Mongoose casting | Pin minimum patched 7.8.10; verify no prototype pollution across seven schemas and preserve query/validation/transaction behavior |

## Validation

Runtime used: Node 24.11.1 / npm 11.6.2 on Windows. Disposable MongoDB: 8.2.6, single-node replica set.

| Check | Final result |
|---|---|
| Locked root installation | PASS, npm ci --ignore-scripts; missing cache packages downloaded with approved access |
| Locked frontend installation | PASS, npm ci --ignore-scripts |
| Backend tests | PASS: 97 tests, zero failures/skips; includes 21 result MongoDB tests, 11 Cloudinary regressions, 10 game/Mongoose regressions and full-entrypoint disposable MongoDB regression |
| Frontend tests | PASS: 18 tests in 4 suites |
| Frontend production build | PASS with CI=true; no ESLint warning/error suppression |
| Changed frontend source and tests | PASS: 58 JavaScript files, zero ESLint messages |
| Full backend startup | PASS in production mode with synthetic configuration, disposable MongoDB and a guard blocking outbound non-loopback sockets |
| Startup HTTP checks | PASS: full-entrypoint test covers 10 CS2 POST requests, all five game writes denied for anonymous/ordinary accounts, unchanged tournament, neighboring admin/auth/registration/Explore/competitive APIs, synthetic password login and Socket.IO polling |
| Backend syntax/import integrity | Changed server syntax passes; full entry point and competitive routes load successfully |
| Production dependency versions | Targeted Mongoose 7.8.10, Cloudinary 2.7.0, compression 1.8.2, Multer 2.4.0 and Socket.IO 4.8.4 subtree; production MongoDB driver stays 5.9.2; Razorpay/Axios/follow-redirects lock entries unchanged |

Database tests exercise concurrent duplicate creation, final uniqueness, edit/publish ordering, verify/void ordering for both games, rollback after source/stale writes, team ownership/game/activity rejection, public privacy changes, additive legacy-field handling, schema indexes, idempotent BGMI verification, score/proof invalidation and real authorization routes.

Latest backend evidence: candidate .cache/games-mongoose-backend.log. Locked install: .cache/games-mongoose-install.log. Audit/lock evidence: .cache/games-mongoose-audit-runtime.json, games-mongoose-audit-all.json and runtime-lock-delta.json. The old .cache/mongoose-casting-evidence.json records historical vulnerable 7.8.7; tracked regression now proves casting does not pollute prototypes on 7.8.10. Latest frontend evidence: ../.cache/phase2-competitive-evidence/client.log and build.log. Full-entrypoint regression covers actual production-mode startup. Cloudinary tests mock only the remote boundary; no production/provider request was made.

Repeat locally after locked installs:

1. npm run test:backend (downloads a disposable MongoDB binary if none is cached; optional MONGOMS_SYSTEM_BINARY may point to a local test binary).
2. In client: npm test -- --watchAll=false --runInBand with CI=true.
3. In client: npm run build with CI=true.

The backend test runner discards inherited application credentials/database URIs. Tests allocate their own loopback database and refuse to clean a differently named database.

## Schema and release prerequisites

- No destructive migration, identity migration or registration-index replacement is required. Existing User/Team/Registration documents and IDs remain intact.
- Mongoose 7.8.10 is a patch with the existing production driver; it requires no data/index migration. Passing regressions cover string ObjectId/number casts, profile validation and stable user IDs, BGMI/Free Fire registration persistence, nested query sanitization, Valorant/CS2 compatibility and competitive transaction rollback/concurrency. These synthetic checks do not substitute for target-environment index and historical-record validation.
- resultRevision is additive and initialized on the first competitive write; missing-field compatibility is tested. No backfill is required.
- avatarAsset is optional image ownership metadata with no index/backfill. Legacy/external avatars continue displaying; deletion clears their profile URL without deleting an unverified remote asset. Storage cleanup of untracked legacy/replaced assets requires trusted ownership evidence and a separate approved procedure. The adapter's scoped SDK peer override is covered by locked installation and real adapter contract tests; live staging upload/delete must still be exercised.
- New collections: FreeFireMatchResult, ValorantMatchResult and TournamentFinalResult. Their unique keys are respectively tournament+match+lobby, tournament+match, and tournament. The existing BGMILeaderboard tournament+team unique index remains required. The additive BGMIMatch result index is tested against real MongoDB.
- Before any approved deployment, verify replica-set/sharded transaction support and privileges in the target environment. Confirm all required indexes are built before result writes; inspect duplicates if collections already exist. Use additive index creation only, not syncIndexes or index dropping.
- Legacy missing links remain unlinked; never infer canonical teams from names. Existing invalid links or historical owners who left a team require explicit administrative review before new verification/publication. No automatic relinking/backfill is performed.
- Official scoreboard images are existing public evidence; structured privacy filtering does not redact text inside images. Administrators must review public evidence before publication.

## Outstanding risks and decision

1. **Confirmed security blockers resolved:** all five game mutations now enforce current DB roles matching the existing admin UI (admin/moderator/designer); public reads remain. Mongoose 7.8.10 closes casting pollution, including other existing guarded raw-update paths. No unrelated auth/API rewrite was made. Remaining conditional advisories are REQUIRES VALIDATION or NON-BLOCKING under inspected usage, not newly asserted exploits. See [route callers, evidence and classifications](dependencies/README.md).
2. Actual production records, index contents, MongoDB version/topology and transaction permissions were not inspected. Validate on an isolated staging clone before release; use a separate approved database procedure for any eventual production index work.
3. Final root audit reports 27 advisories (7 moderate, 17 high, 3 critical), including 20 production packages (7 moderate, 11 high, 2 critical). Mongoose, Cloudinary/storage adapter and earlier targeted packages no longer appear. Remaining classifications and conditional exposure are documented; this is not a clean-audit claim. Frontend browser-data/deprecation and bundle-size notices remain non-blocking.
4. Live Steam/Google, storage, notification services and actual Render/Vercel settings were not exercised. Preserve existing integration behavior and complete authorized staging/browser smoke checks, including legacy registration, friend actions, CS2, Explore and admin workflows.
5. Public aggregation performance is validated for correctness on synthetic fixtures, not production scale. Check representative query plans and endpoint latency before release.
6. CI repairs touch existing production pages; review the exact diff and perform browser smoke checks. They do not introduce new authentication, registration, wallet or store functionality.

**GitHub PR assessment:** ready for code review after separately authorized commit/push; no confirmed security blocker remains within this bounded review. Production merge/deployment still requires closing advisory/environment/data readiness gates and explicit approval. No PR was created.

Safe next procedure: review this uncommitted diff and tests; close remaining conditional advisory validation gaps; validate the exact candidate on isolated staging (MongoDB topology/privileges/indexes/legacy records, integrations, browser workflows and performance); obtain explicit approval for commit/push/PR and, separately, any production action. Do not merge dev wholesale or promote the unfinished release-fix tree.

## Exact changed-file manifest

65 modified files and 76 new files, including both reports. Ignored build/dependency outputs and evidence are excluded. This includes the previously prepared competitive candidate. This games/Mongoose stage changes games.js, package.json/lock, the existing full-entrypoint test and both reports, and adds one focused integration test. No frontend, payment, database or deployment configuration change was made in this stage.

| Status | File | Purpose |
|---|---|---|
| M | [server/routes/games.js](../server/routes/games.js) | Existing auth/content-role guards on five write endpoints; public reads unchanged |
| A | [server/features/game-results/games-security.integration.test.js](../server/features/game-results/games-security.integration.test.js) | Ten focused authorization, casting, query/schema and real-Mongo regressions |
| M | [server/config/cloudinary.js](../server/config/cloudinary.js) | Explicit patched signature version 2 |
| M | [server/middleware/upload.js](../server/middleware/upload.js) | Owner-scoped UUID avatar uploads with overwrite disabled |
| M | [server/models/User.js](../server/models/User.js) | Optional hidden server-owned avatar asset reference |
| M | [server/routes/upload.js](../server/routes/upload.js) | Safe deletion/ownership/concurrency and site-image content roles |
| A | [server/features/game-results/cloudinary-security.integration.test.js](../server/features/game-results/cloudinary-security.integration.test.js) | Eleven focused SDK/adapter/HTTP/real-Mongo regressions |
| A | [release/dependencies/README.md](dependencies/README.md) | Runtime fixes, remaining advisory classification and release gates |
| A | [server/features/game-results/production-entrypoint.test.js](../server/features/game-results/production-entrypoint.test.js) | Actual backend startup, CS2 absence, login and API regression |
| A | [server/features/game-results/runtime-dependencies.test.js](../server/features/game-results/runtime-dependencies.test.js) | Compression and multipart compatibility/limits |
| A | [server/features/game-results/test-support/local-startup.cjs](../server/features/game-results/test-support/local-startup.cjs) | Test-only dotenv bypass and external network denial |
| M | [client/package-lock.json](../client/package-lock.json) | Lock frontend test-only additions |
| M | [client/package.json](../client/package.json) | Testing-library dev dependencies and Axios CommonJS test mapping |
| M | [client/src/App.js](../client/src/App.js) | Competitive routes plus removal of unused imports |
| M | [client/src/App.test.js](../client/src/App.test.js) | Replace starter assertion with real route/access regression tests |
| M | [client/src/components/common/GameIcon.js](../client/src/components/common/GameIcon.js) | Compatible variant alias to avoid treating an image variant as a CSS style prop |
| M | [client/src/components/common/HeroImageSlider.js](../client/src/components/common/HeroImageSlider.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/components/common/PageBannerSlider.js](../client/src/components/common/PageBannerSlider.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/components/common/Toast.js](../client/src/components/common/Toast.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| A | [client/src/components/competitive/PlayerCompetitivePanels.js](../client/src/components/competitive/PlayerCompetitivePanels.js) | Competitive presentation; manual result entry only; no OCR/payment flow |
| A | [client/src/components/competitive/TournamentFinalResults.js](../client/src/components/competitive/TournamentFinalResults.js) | Competitive presentation; manual result entry only; no OCR/payment flow |
| A | [client/src/components/competitive/competitive.test.js](../client/src/components/competitive/competitive.test.js) | Targeted competitive regression/integration tests |
| M | [client/src/components/layout/Footer.js](../client/src/components/layout/Footer.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/components/layout/Navbar.js](../client/src/components/layout/Navbar.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/components/matches/ResultSubmission.js](../client/src/components/matches/ResultSubmission.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/components/notifications/NotificationPanel.js](../client/src/components/notifications/NotificationPanel.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/components/steam/SteamConnectionModal.js](../client/src/components/steam/SteamConnectionModal.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/components/teams/CreateTeamModal.js](../client/src/components/teams/CreateTeamModal.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/components/teams/MyTeamsTab.js](../client/src/components/teams/MyTeamsTab.js) | Public profile links for supported competitive team games |
| M | [client/src/components/tournaments/PlayerInputWithValidation.js](../client/src/components/tournaments/PlayerInputWithValidation.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/components/tournaments/TeamSelectionModal.js](../client/src/components/tournaments/TeamSelectionModal.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/hooks/useToast.js](../client/src/hooks/useToast.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/AdminBGMIRegistrations.js](../client/src/pages/AdminBGMIRegistrations.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/BGMIImageUpload.js](../client/src/pages/BGMIImageUpload.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/BGMIPage.js](../client/src/pages/BGMIPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/CS2Page.js](../client/src/pages/CS2Page.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| A | [client/src/pages/CompetitiveLeaderboardPage.js](../client/src/pages/CompetitiveLeaderboardPage.js) | Competitive presentation; manual result entry only; no OCR/payment flow |
| M | [client/src/pages/CompleteLandingPage.js](../client/src/pages/CompleteLandingPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/FreeFirePage.js](../client/src/pages/FreeFirePage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/GamesPage.js](../client/src/pages/GamesPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/LeaderboardPage.js](../client/src/pages/LeaderboardPage.js) | Retain legacy views; add navigation to competitive views; lint compatibility |
| M | [client/src/pages/MarketingLandingPage.js](../client/src/pages/MarketingLandingPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/ProfilePage.js](../client/src/pages/ProfilePage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/PublicProfile.js](../client/src/pages/PublicProfile.js) | Add competitive panels; retain friend actions; stable fetch dependencies |
| M | [client/src/pages/SliderLandingPage.js](../client/src/pages/SliderLandingPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/SteamSettingsPage.js](../client/src/pages/SteamSettingsPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| A | [client/src/pages/TeamCompetitiveProfile.js](../client/src/pages/TeamCompetitiveProfile.js) | Competitive presentation; manual result entry only; no OCR/payment flow |
| M | [client/src/pages/TeamsPage.js](../client/src/pages/TeamsPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| A | [client/src/pages/TournamentResultsPage.js](../client/src/pages/TournamentResultsPage.js) | Competitive presentation; manual result entry only; no OCR/payment flow |
| A | [client/src/pages/admin/AdminGameResults.js](../client/src/pages/admin/AdminGameResults.js) | Competitive presentation; manual result entry only; no OCR/payment flow |
| A | [client/src/pages/admin/AdminGameResults.test.js](../client/src/pages/admin/AdminGameResults.test.js) | Targeted competitive regression/integration tests |
| M | [client/src/pages/admin/ClaimsManager.js](../client/src/pages/admin/ClaimsManager.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/admin/GamesManagement.js](../client/src/pages/admin/GamesManagement.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/admin/ImageManagement.js](../client/src/pages/admin/ImageManagement.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/admin/TournamentManagement.js](../client/src/pages/admin/TournamentManagement.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/admin/TournamentRewardDistribution.js](../client/src/pages/admin/TournamentRewardDistribution.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/admin/WinnerRewardPanel.js](../client/src/pages/admin/WinnerRewardPanel.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/auth/LoginPage.js](../client/src/pages/auth/LoginPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/auth/OAuthSuccess.js](../client/src/pages/auth/OAuthSuccess.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/auth/ResetPasswordPage.js](../client/src/pages/auth/ResetPasswordPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/tournaments/SingleTournamentPage.js](../client/src/pages/tournaments/SingleTournamentPage.js) | Final-results tab and URL selection; existing registration path retained |
| M | [client/src/pages/tournaments/TournamentDetails.js](../client/src/pages/tournaments/TournamentDetails.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/tournaments/TournamentDetailsPage.js](../client/src/pages/tournaments/TournamentDetailsPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/tournaments/TournamentsPage.js](../client/src/pages/tournaments/TournamentsPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/pages/wallet/WalletPage.js](../client/src/pages/wallet/WalletPage.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/services/api.js](../client/src/services/api.js) | Competitive API methods; remove unused unexported legacy helpers |
| M | [client/src/services/imageService.js](../client/src/services/imageService.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/setupTests.js](../client/src/setupTests.js) | Supported jest-dom import |
| M | [client/src/store/slices/matchSlice.js](../client/src/store/slices/matchSlice.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/utils/apiConfig.js](../client/src/utils/apiConfig.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [client/src/utils/secureRequest.js](../client/src/utils/secureRequest.js) | CI-only repair: unused bindings, stable hook dependencies, accessibility or named default exports |
| M | [package-lock.json](../package-lock.json) | Lock MongoDB tests and targeted Mongoose/Cloudinary/compression/Multer/Socket.IO patches |
| M | [package.json](../package.json) | MongoDB tests, backend test command, five exact security pins and scoped Cloudinary adapter override |
| A | [release/README.md](../release/README.md) | Review report, deployment blockers and exact changed-file manifest |
| A | [server/features/competitive-history/adapters/bgmi-history.adapter.js](../server/features/competitive-history/adapters/bgmi-history.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/competitive-history/adapters/cs2-history.adapter.js](../server/features/competitive-history/adapters/cs2-history.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/competitive-history/adapters/freefire-history.adapter.js](../server/features/competitive-history/adapters/freefire-history.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/competitive-history/adapters/tournament-history.adapter.js](../server/features/competitive-history/adapters/tournament-history.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/competitive-history/adapters/valorant-history.adapter.js](../server/features/competitive-history/adapters/valorant-history.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/competitive-history/competitive-history.constants.js](../server/features/competitive-history/competitive-history.constants.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/competitive-history/competitive-history.controller.js](../server/features/competitive-history/competitive-history.controller.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/competitive-history/competitive-history.routes.js](../server/features/competitive-history/competitive-history.routes.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/competitive-history/competitive-history.service.js](../server/features/competitive-history/competitive-history.service.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/competitive-history/competitive-history.service.test.js](../server/features/competitive-history/competitive-history.service.test.js) | Targeted competitive regression/integration tests |
| A | [server/features/competitive-history/competitive-history.utils.js](../server/features/competitive-history/competitive-history.utils.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/freefire-results/freefire-match-result.model.js](../server/features/freefire-results/freefire-match-result.model.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/freefire-results/freefire-results.controller.js](../server/features/freefire-results/freefire-results.controller.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/freefire-results/freefire-results.routes.js](../server/features/freefire-results/freefire-results.routes.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/freefire-results/freefire-results.service.js](../server/features/freefire-results/freefire-results.service.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/game-results/bgmi-result.service.js](../server/features/game-results/bgmi-result.service.js) | Shared competitive validation, privacy and transaction helpers |
| A | [server/features/game-results/competitive-release.integration.test.js](../server/features/game-results/competitive-release.integration.test.js) | Targeted competitive regression/integration tests |
| A | [server/features/game-results/game-results.utils.js](../server/features/game-results/game-results.utils.js) | Shared competitive validation, privacy and transaction helpers |
| A | [server/features/game-results/public-result-privacy.js](../server/features/game-results/public-result-privacy.js) | Shared competitive validation, privacy and transaction helpers |
| A | [server/features/game-results/registration-team.js](../server/features/game-results/registration-team.js) | Shared competitive validation, privacy and transaction helpers |
| A | [server/features/game-results/result-transactions.js](../server/features/game-results/result-transactions.js) | Shared competitive validation, privacy and transaction helpers |
| A | [server/features/leaderboards/adapters/bgmi-leaderboard.adapter.js](../server/features/leaderboards/adapters/bgmi-leaderboard.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/leaderboards/adapters/freefire-leaderboard.adapter.js](../server/features/leaderboards/adapters/freefire-leaderboard.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/leaderboards/adapters/leaderboard-adapter.utils.js](../server/features/leaderboards/adapters/leaderboard-adapter.utils.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/leaderboards/adapters/valorant-leaderboard.adapter.js](../server/features/leaderboards/adapters/valorant-leaderboard.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/leaderboards/leaderboards.constants.js](../server/features/leaderboards/leaderboards.constants.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/leaderboards/leaderboards.controller.js](../server/features/leaderboards/leaderboards.controller.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/leaderboards/leaderboards.routes.js](../server/features/leaderboards/leaderboards.routes.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/leaderboards/leaderboards.service.js](../server/features/leaderboards/leaderboards.service.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/leaderboards/tests/leaderboards.service.test.js](../server/features/leaderboards/tests/leaderboards.service.test.js) | Targeted competitive regression/integration tests |
| A | [server/features/player-competitive-profile/player-competitive-profile.constants.js](../server/features/player-competitive-profile/player-competitive-profile.constants.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/player-competitive-profile/player-competitive-profile.controller.js](../server/features/player-competitive-profile/player-competitive-profile.controller.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/player-competitive-profile/player-competitive-profile.routes.js](../server/features/player-competitive-profile/player-competitive-profile.routes.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/player-competitive-profile/player-competitive-profile.service.js](../server/features/player-competitive-profile/player-competitive-profile.service.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/player-competitive-profile/player-competitive-profile.service.test.js](../server/features/player-competitive-profile/player-competitive-profile.service.test.js) | Targeted competitive regression/integration tests |
| A | [server/features/statistics/adapters/bgmi-statistics.adapter.js](../server/features/statistics/adapters/bgmi-statistics.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/statistics/adapters/freefire-statistics.adapter.js](../server/features/statistics/adapters/freefire-statistics.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/statistics/adapters/statistics.utils.js](../server/features/statistics/adapters/statistics.utils.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/statistics/adapters/valorant-statistics.adapter.js](../server/features/statistics/adapters/valorant-statistics.adapter.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/statistics/statistics.constants.js](../server/features/statistics/statistics.constants.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/statistics/statistics.controller.js](../server/features/statistics/statistics.controller.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/statistics/statistics.routes.js](../server/features/statistics/statistics.routes.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/statistics/statistics.service.js](../server/features/statistics/statistics.service.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/statistics/statistics.service.test.js](../server/features/statistics/statistics.service.test.js) | Targeted competitive regression/integration tests |
| A | [server/features/team-competitive-profile/team-competitive-profile.constants.js](../server/features/team-competitive-profile/team-competitive-profile.constants.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/team-competitive-profile/team-competitive-profile.controller.js](../server/features/team-competitive-profile/team-competitive-profile.controller.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/team-competitive-profile/team-competitive-profile.history.js](../server/features/team-competitive-profile/team-competitive-profile.history.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/team-competitive-profile/team-competitive-profile.routes.js](../server/features/team-competitive-profile/team-competitive-profile.routes.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/team-competitive-profile/team-competitive-profile.service.js](../server/features/team-competitive-profile/team-competitive-profile.service.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/team-competitive-profile/team-competitive-profile.service.test.js](../server/features/team-competitive-profile/team-competitive-profile.service.test.js) | Targeted competitive regression/integration tests |
| A | [server/features/team-competitive-profile/team-competitive-profile.utils.js](../server/features/team-competitive-profile/team-competitive-profile.utils.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/tournament-final-results/tournament-final-result.model.js](../server/features/tournament-final-results/tournament-final-result.model.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/tournament-final-results/tournament-final-results.controller.js](../server/features/tournament-final-results/tournament-final-results.controller.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/tournament-final-results/tournament-final-results.routes.js](../server/features/tournament-final-results/tournament-final-results.routes.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/tournament-final-results/tournament-final-results.service.js](../server/features/tournament-final-results/tournament-final-results.service.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/tournament-final-results/tournament-final-results.service.test.js](../server/features/tournament-final-results/tournament-final-results.service.test.js) | Targeted competitive regression/integration tests |
| A | [server/features/valorant-results/valorant-match-result.model.js](../server/features/valorant-results/valorant-match-result.model.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/valorant-results/valorant-results.controller.js](../server/features/valorant-results/valorant-results.controller.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/valorant-results/valorant-results.routes.js](../server/features/valorant-results/valorant-results.routes.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| A | [server/features/valorant-results/valorant-results.service.js](../server/features/valorant-results/valorant-results.service.js) | Selectively ported from 9350489; compatibility, integrity or privacy fixes where needed |
| M | [server/index.js](../server/index.js) | Competitive mounts/results ordering; unmount only discontinued CS2 status endpoint |
| M | [server/models/BGMIMatch.js](../server/models/BGMIMatch.js) | Additive result query index |
| M | [server/models/Tournament.js](../server/models/Tournament.js) | Additive resultRevision transaction lock field |
| M | [server/routes/bgmiMatches.js](../server/routes/bgmiMatches.js) | Guarded result writes, safe public projections, transactional legacy totals |
| M | [server/routes/bgmiRegistration.js](../server/routes/bgmiRegistration.js) | Remove self-service make-admin handler only |
| M | [server/routes/freeFireRegistration.js](../server/routes/freeFireRegistration.js) | Remove self-service make-admin handler only |
| A | [server/scripts/test-competitive.cjs](../server/scripts/test-competitive.cjs) | Sanitized, repeatable backend test runner |
