# Targeted runtime security remediation

Candidate: release/phase2-competitive, uncommitted changes on 8a8a09c. Registry audit refreshed 2026-10-15. This is a root/backend audit, not a claim that the frontend dependency tree has no advisories.

## Completed changes

| Package | Previous lock | Final lock | Scope |
|---|---|---|---|
| compression | 1.8.1 | 1.8.2 | Premature response-close memory leak |
| multer | 2.0.2 | 2.4.0 | Multipart resource exhaustion, field parsing, cleanup and aborted disk uploads |
| socket.io | 4.8.1 | 4.8.4 | Compatible 4.x patch |
| engine.io | 6.6.4 | 6.6.11 | Polling exhaustion/protocol mismatch fixes |
| socket.io-parser | 4.2.4 | 4.2.7 | Attachment and zero-attachment exhaustion |
| socket.io-adapter | 2.5.5 | 2.5.8 | Compatible adapter/WebSocket dependencies |
| ws | 8.17.1 | 8.21.3 | Fragment exhaustion and memory disclosure |
| cloudinary | 1.41.3 | 2.7.0 | Patched signed-parameter ampersand injection; signature version explicitly set to 2 |
| mongoose | 7.8.7 | 7.8.10 | Minimum compatible 7.x update-casting and nested $nor sanitization fixes |

Five direct packages are pinned exactly. Socket.IO subtree changes include four nested debug copies moving 4.3.7 -> 4.4.3 and @types/ws 8.18.2 being added. Obsolete base64id, Multer stream/temporary-directory helpers, and the Cloudinary 1.x proxy-agent dependency are removed. Mongoose remains on 7.x and its production MongoDB driver remains 5.9.2. Existing Razorpay, Axios and follow-redirects lock entries are equivalent as parsed JSON. Earlier competitive work also added MongoMemoryServer development dependencies; those are not runtime security upgrades. No forced audit fix, payment code or deployment configuration change was performed.

Cloudinary is the one targeted major-version SDK change, explicitly requested to resolve this blocker. The application already uses its v2 API. The retained multer-storage-cloudinary 4.0.0 adapter accepts a supplied SDK and uses the same upload_stream/destroy contract, but declares an outdated Cloudinary ^1.21.0 peer. A scoped npm override resolves only that peer to the root SDK; npm ci and npm ls both pass without --force or --legacy-peer-deps. Contract regressions use real Multer and the adapter with a mocked remote boundary; they do not establish live provider compatibility. No adapter replacement or architectural rewrite was necessary.

### Cloudinary call paths and ownership fix

- Avatar/team-logo/store upload options are server-defined in middleware/upload.js; request folder/public_id/filename fields are not forwarded. Avatars now set overwrite=false and use random IDs beneath esports/avatars/<authenticated-user-id>.
- upload.js no longer parses editable avatarUrl to obtain a destructive target. The successful upload records an optional, normally unselected User.avatarAsset {publicId,url}. Delete requires a matching recorded display URL and strict owner-prefixed UUID. Invalid persisted references are rejected; client publicId/userId fields are ignored. A conditional database update prevents delayed deletion from clearing a concurrently uploaded replacement. Failure before persistence cleans only the new owner-scoped asset; remote delete failure preserves the reference for retry.
- Legacy/external URLs without trusted ownership metadata can be cleared from a profile without remote deletion. No ownership is inferred from old URL strings. Old assets may remain in storage; any eventual cleanup needs trusted ownership evidence. No backfill, index or destructive migration is required.
- The existing auth profile route whitelists fields and cannot write avatarAsset. A real HTTP regression verifies forged metadata is ignored and another user's asset is untouched. This is additive image metadata, not an authentication/identity migration.
- POST /api/upload/image now enforces its existing documented content roles using the shared admin/designer/moderator guard, before multipart/remote work. Existing admin/design image responses and transformations remain.
- Tournament BGMI uploads/replacements check registration ownership; labels/player slots are enumerated and registration IDs are looked up before SDK calls. Existing stored SDK-returned verification publicIds are used for deletes. Match screenshots check participation before using the resolved match/user ID in generated names. WhatsApp verification uses a resolved registration ID and provider-returned image references. These paths inherit patched signature serialization without changing their API or registration behavior. No live provider calls were made.

Eleven Cloudinary regressions pass: actual SDK signature ambiguity, unauthenticated denial, content roles, successful avatar/logo/site/tournament uploads, malicious client parameters, MIME rejection, legacy/forged URLs, forged profile ownership, cross-owner persisted references, remote/persistence failures and concurrent replacement. Disposable real MongoDB verifies stored records. Provider upload_stream/destroy are mocked so no production/cloud service is contacted.

### Game mutations and Mongoose: confirmed blockers resolved

All five previously exposed handlers now run auth then the existing adminAuth role guard. auth resolves the active account's current role from MongoDB, ignoring token role claims. Admin, moderator and designer access matches the existing client AdminRoute for /admin/games. Ordinary users are denied. No shared auth middleware or frontend functionality changed.

| Method and endpoint | Existing caller | Final access |
|---|---|---|
| POST /api/games | GamesManagement.handleSubmit (create) | Authenticated admin/moderator/designer |
| PUT /api/games/:id | GamesManagement.handleSubmit (edit) | Authenticated admin/moderator/designer |
| DELETE /api/games/:id | GamesManagement.handleDelete | Authenticated admin/moderator/designer |
| PATCH /api/games/:id/stats | No in-repository caller found | Authenticated admin/moderator/designer |
| POST /api/games/admin/activate-all | No in-repository caller found; existing maintenance operation | Authenticated admin/moderator/designer |

The create/edit/delete frontend callers already send Bearer tokens. Public GET /api/games, /featured, /:id and /debug/all-games retain their handlers and response shapes. Other frontend consumers (gameSlice, services/api, image/tournament/admin pages) use public reads. Repository searches cannot identify external/manual API consumers; those must now authenticate for writes.

[GHSA-664h-wqgq-64gw](https://github.com/Automattic/mongoose/security/advisories/GHSA-664h-wqgq-64gw) applies to 7.8.7: raw request updates in the former public games PUT path and existing guarded servers/testimonials paths could reach casting that polluted Object.prototype. Version 7.8.10 is the first patched 7.x release. Pinning that patch protects casting globally without a schema migration or update-API rewrite; legitimate authorized update operators remain compatible. The separate $nor/sanitizeFilter fix is also included. No application sanitizeFilter setting/raw $nor usage was found, but a regression verifies the patched recursive behavior.

Ten focused tests cover all five mutations with missing/invalid tokens, ordinary users and forged/stale roles; disabled accounts; public reads; every authorized role performing CRUD/stats/bulk actions; an actual HTTP malicious update; fresh-process casting probes against seven production/competitive schemas; nested query sanitization; profile validators/ID stability; and real BGMI/Free Fire registration save/query/update round trips. The HTTP attack leaves business data unchanged; normal updatedAt bookkeeping remains. The existing full-entrypoint startup test additionally checks all five writes return 401 anonymously and 403 for a real logged-in ordinary user. Existing result concurrency/rollback and Valorant/CS2/profile compatibility suites all pass on the patch.

Historical vulnerable casting proof remains in .cache/mongoose-casting-evidence.json (7.8.7); the tracked games-security.integration.test.js now verifies that no pollution occurs. Do not treat the historical proof as current-candidate behavior. Final backend evidence: .cache/games-mongoose-backend.log (97 passed, zero failures/skips); locked install: .cache/games-mongoose-install.log; syntax/payment-lock review: .cache/runtime-lock-delta.json and review-remediation.cjs output. No production connection was made.

Multer 2.3.0 was rejected after the fresh audit identified [aborted disk-write cleanup](https://github.com/expressjs/multer/security/advisories/GHSA-3pph-fpjx-jg34), patched in 2.4.0. The final audit flags none of the seven targeted packages above. Basic compression, successful/rejected/malformed multipart requests and the actual server Socket.IO polling handshake are tested. These checks are compatibility regressions, not an exhaustive exploit/fuzz suite.

## Remaining root advisories

All-dependency audit: **27 packages: 3 critical, 17 high, 7 moderate** (originally 36). Production-only audit: **20 packages: 2 critical, 11 high, 7 moderate** (originally 29). Mongoose, Cloudinary and multer-storage-cloudinary no longer appear. Counts include vulnerable parents/transitive effects, not 27 independent exploits. Newly published advisories may change these totals. Final raw JSON: .cache/games-mongoose-audit-{runtime,all}.json; exact delta: .cache/runtime-lock-delta.json.

| Classification | Packages | Application evidence and minimum next action |
|---|---|---|
| **REQUIRES VALIDATION** | qs, express (inherited) | index.js uses Express's extended query parser and express.urlencoded({extended:true}); qs 6.13.0 parses public query/form keys. The [updated bracket advisory](https://github.com/advisories/GHSA-6rw7-vpxm-498p) explicitly says default parameterLimit=1000 mitigates the described DoS; this application does not override that limit. Other findings depend on comma/stringify options or attacker-controlled isBuffer objects, not merely qs being mounted. No exploit is established here. Confirm effective parser options and ingress bounds with adversarial requests, or apply a narrow compatible Express 4.x/qs patch; do not label default parsing a confirmed DoS. |
| **REQUIRES VALIDATION** | axios, follow-redirects, form-data | Steam and most WhatsApp calls use configured/fixed upstream URLs; WhatsApp media download additionally follows a URL returned by Graph. No new competitive Axios requests. No application HTTP/2/fetch adapter or custom form-data filename construction was found. Several findings require prototype pollution, special adapter/options, proxy credentials or hostile redirects; the confirmed Mongoose pollution entry is now patched. A complete negative assessment across integration redirects and deployment proxy settings is not established. Shared payment dependencies are unchanged; coordinate any further compatible upgrade separately rather than altering payment transitive dependencies silently. No additional confirmed exploit was established in this bounded remediation. |
| **NON-BLOCKING under inspected usage** | lodash | Production parents are Cloudinary and express-validator. Neither application nor these installed packages call the affected lodash template/unset/omit APIs (Cloudinary's string field named template is not _.template). New SDK options are server-defined, not arbitrary request objects. No affected call path found; keep as maintenance and reassess if these APIs are introduced. |
| **NON-BLOCKING under current usage** | body-parser | Advisory requires an invalid limit value. index.js passes the fixed valid string '10mb' to both parsers. Inherited Express advisory does not make this particular condition active. |
| **NON-BLOCKING under current usage** | path-to-regexp | Advisory requires multiple named parameters in a single route segment; candidate application routes do not use that pattern. Recheck if route patterns change. |
| **NON-BLOCKING under current usage** | proxy-addr (critical) | index.js uses numeric trust proxy=1, not the affected IPv4-mapped IPv6 trust subnet. Render hop/trust behavior still requires staging validation. Severity does not establish the required configuration. |
| **NON-BLOCKING under current usage** | gamedig, fast-xml-parser (critical), http-cache-semantics | Only application GameDig reference is the unmounted cs2ServerStatus module. Its query uses protocol-valve, not the farming-simulator XML parser. Do not mount it or introduce arbitrary protocols without fixing these dependencies. |
| **NON-BLOCKING under current usage** | ip-address | Used under MongoDB SOCKS support; application does not configure a SOCKS proxy, emit its HTML methods or accept user-controlled network addresses for these operations. Target DB configuration must preserve that assumption. |
| **NON-BLOCKING under current usage** | jws | Application uses jsonwebtoken.verify with the existing JWT secret. [Maintainer advisory](https://github.com/auth0/node-jws/security/advisories/GHSA-869p-cjfg-cm3x) explicitly excludes jsonwebtoken/jws.verify; the affected createVerify/attacker-dependent HMAC key lookup is not used. |
| **NON-BLOCKING under current usage** | nodemailer | No server import/use found. Active emailService uses Resend. Reassess before introducing SMTP transport or forwarding user-supplied message options. |
| **NON-BLOCKING under current usage** | resend, svix, uuid | Audit follows uuid buffer-bounds issue. Existing application sends email; it does not invoke uuid v3/v5/v6 with user-supplied output buffers. No competitive webhook verification or UUID buffer API added. |
| **NON-BLOCKING under current usage** | validator | No application isURL call or allowlist built on it found; authentication validation uses existing explicit checks. Reassess before relying on affected URL filtering APIs. |
| **NON-BLOCKING under current usage** | xlsx | Used only by manually invoked migrateFromExcel.js, not mounted requests/startup. Do not process untrusted spreadsheets. No migration was run. |

Development-only packages: shell-quote (critical), brace-expansion, braces, chokidar, minimatch, nodemon and picomatch (six high). These are development/build tooling; npm start runs node directly. Do not install/run development tools in the production serving process. These findings are not resolved by this runtime-only task and remain maintenance work.

## Release decision

**GO for code-review PR preparation; production approval pending validation. No confirmed production security blocker remains from this bounded review.** Game mutation authorization and Mongoose casting are fixed and regression-tested. The discontinued CS2 endpoint remains unmounted and inaccessible; no CS2 status feature was restored. Other APIs remain mounted.

All confirmed blockers identified so far (privilege-escalation routes, result integrity/privacy/concurrency, discontinued CS2 mutation, targeted runtime dependencies, Cloudinary ownership/signatures and games/Mongoose) are resolved in the candidate. Close REQUIRES VALIDATION rows with focused testing or compatible fixes before production approval; this is not an application-wide penetration-test or clean-audit claim. Default qs parameter limits mitigate the bracket-array scenario; host ingress bounds still require staging checks. Validate target MongoDB transactions, required unique indexes and representative legacy records on authorized staging, plus live provider/storage/browser workflows. No production database was accessed. No index migration, commit, push, merge or deployment was performed.

Ready for a review GitHub PR after separately authorized commit/push; no PR was created. Production merge/deployment remains NO-GO until the external/data/advisory validation gates are closed. Final validation: 97 backend tests, 18 frontend tests, CI=true frontend build and full backend synthetic startup pass. Backend/Mongo tests use sanitized environment variables and fresh loopback replica sets; casting probes run in a separate process with no database connection.
