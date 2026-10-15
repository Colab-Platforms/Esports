# Phase 2 competitive release review

**GO for code-review PR preparation; production approval pending validation.** No confirmed security blocker remains from the bounded release review: all five game mutation routes now require current authenticated admin/moderator/designer roles, and Mongoose is patched to 7.8.10. The discontinued CS2 endpoint stays unmounted. Remaining advisory, staging and deployment/data gates are detailed in [dependency readiness](dependencies/README.md); production deployment remains NO-GO until those gates are closed.

## Candidate and boundaries

- Branch: release/phase2-competitive.
- Isolated worktree: C:/Users/user/Desktop/Esports/release-phase2-competitive.
- Verified remote main/base: 8a8a09ce71117a19f9fdd321102eebbae5dfb31b.
- Feature source: 9350489ba3e4559568d95260874b462c4324aa4c; selected modules and integration hunks only.
- Implementation/test evidence below was recorded before staging or committing. Subsequent Git preparation was explicitly authorized: commit/push only this release branch and prepare its review PR. Main/dev and the unfinished release-fix worktree remain outside the change scope; no merge/deployment is authorized.
- No production database, service configuration or credentials accessed. All database tests used synthetic data in newly allocated loopback replica sets.

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
