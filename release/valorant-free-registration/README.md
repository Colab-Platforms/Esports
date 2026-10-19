# Valorant registration candidate: free and paid

Branch: release/valorant-free-registration. Draft PR #9.
Base: 70111b5d2e47a896a9d081dbfca3536d63b6bf63.
Free-registration foundation: b6bb6f837c9716e66eca154c3ddb229b93307ac6.
This candidate includes the paid extension and supersedes the former free-only
release scope. No hosted database, payment account or deployment has
been accessed for this implementation.

## Product and payment rules

- Both free and paid Valorant use the existing production Team/User models,
  captain ownership and authoritative saved 5 starters + 1 substitute roster.
  Riot IDs remain manually saved, not Riot-verified. All six platform user IDs
  remain in immutable snapshots used by competitive history/statistics/results.
- The administrator configures entryFee in INR per team. The planned fee is 500
  (50000 integer paise). Zero uses direct free registration. Invalid amounts fail
  closed. Existing tournaments are never repriced automatically. Non-Valorant fee
  validation remains free-only; BGMI/Free Fire lifecycle and wallets are unchanged.
- Paid checkout reserves one slot and 13 exclusive claims (team, six users, six
  normalized Riot IDs). Its deadline is ten minutes or the registration deadline,
  whichever comes first. No registration/participant entry exists at reservation.
- The server snapshots amount/currency/roster. It creates one provider order per
  intent, with durable idempotency and correlation. Browser amounts, rosters and
  payment-success messages are never authoritative. A provider timeout has an
  unknown outcome; it does not authorize creation of a replacement order.
- Checkout verification checks ownership, HMAC signature, order association,
  exact amount/currency and provider-fetched captured status. Signed webhooks use
  raw bytes before JSON parsing. They are persisted, deduplicated and processed
  with atomic leases; failed and expired-lease events are retried.
- Callback, webhook and reconciliation share one settlement path and the existing
  tournament/result transaction lock. Captured money is recorded before attempted
  fulfillment. Registration, receipt, claim transfer and participant insertion
  commit together. Capacity transfers from the reservation without incrementing
  again. Unique payment/intent indexes prevent repeat registration/receipts.
- Authorized, failed and unpaid attempts never create registrations. Older events
  cannot downgrade captured payments. Captured payment creates a pending roster
  registration; admin/moderator eligibility verification is a separate action.
- Settlement after expiry or registration closure cannot register the team, even
  if the provider captured earlier. Money enters manual refund review. Slot/claims
  release on the next reconciliation scan, including during provider outages;
  financial records remain for late-payment detection and review. The scan is
  bounded (25 intents, 25 events per minute); release latency depends on backlog.
- Pending captains may cancel; admin/moderator may reject pending/submitted rosters.
  Both preserve rejected history, release slot/claims atomically and open a single
  refund review for paid entries. Verified entries keep the previous locked policy.
  New rejected-history attempts are allowed while open, subject to all checks.
- Only admins decide refund reviews. Approval does NOT issue a refund. An authorized
  operator issues a FULL refund in Razorpay Dashboard, then supplies its refund ID.
  Backend fetches that refund and checks original payment ID, exact amount and INR.
  Only provider status processed marks review processed; pending/failed is tracked.
  Partial refunds and automatic refund issuance are outside this scope. A declined
  review retains funds and decision history; disputes require the owner's process.
- Fee edits serialize against registrations/reservations and lock after any such
  activity. Valorant game-type conversion is rejected. Tournaments with financial
  activity cannot be force-deleted, preserving settlement/refund references.
- Receipt and notification-outbox records are transactional. Captains can view the
  receipt and refund status. Email delivery is NOT enabled or implemented here;
  the outbox is retained for a separately reviewed delivery worker, if required.
  There are no WhatsApp messages, registration bonuses, wallet changes or provider
  authentication changes. Redis invalidation is best-effort, after commit only.

## Source reuse and files

Selectively reused from origin/dev 449e4b0c009f9e4496aa3b08848130db114638f6:
registration-intent.model.js, payment-order.model.js, payment-event.model.js,
payment-receipt.model.js, payment-notification-intent.model.js, razorpay.adapter.js.
The gateway adapter was hardened; financial models disable automatic collection
creation/indexing. No dev merge/cherry-pick, auth/team migration, old wallet payment
service or dev registration hooks were copied. Installed dependencies are reused;
package manifests and lockfiles are unchanged.

New payment.service.js adapts the foundation to the candidate's transaction lock,
model paths, participant counters and active claims. It replaces the audited unsafe
webhook downgrades, missing-payment-ID recovery and non-atomic event claiming.
The refund-review model/service/UI is new and deliberately has no refund-creation
provider method. The existing roster-management page embeds admin-only reviews.

## API contract

All API requests use the configured frontend API service. No staging API URL is
hardcoded. New prefix: /api/valorant-payments.

- POST /intents: captain, tournamentId, teamId, stable idempotencyKey.
- POST /intents/:intentId/order: owning captain, stable idempotencyKey.
- POST /verify: owning captain, local paymentOrderId plus Razorpay signed response.
- POST /webhook: raw signed provider request, no user token; event header supported.
- GET /active?tournamentId=...&teamId=...: own resumable attempt.
- GET /my-attempts?tournamentId=... and GET /intents/:intentId: own status/receipt.
- GET /refund-reviews?page=1: admin only, pages of 25.
- POST /refund-reviews/:reviewId: admin only, approve/decline with decision reason,
  or check_refund with refundId. No endpoint issues a provider refund.

The existing /api/valorant-registration free and roster-review APIs remain.
Public teams expose names/status/dates only. Own history includes own payment,
receipt and limited refund status. Staff roster access remains admin/moderator;
refund decisions/provider IDs are admin-only. Paid/free eligibility stays server-side.

## Additive database requirements (not executed)

indexes.json contains exact schema-derived definitions for review, not an executor.
Complete candidate scope: seven collections (claims plus six financial collections),
38 secondary indexes plus seven automatic _id_ indexes if all are newly created.
If the former free-only plan was already provisioned, compare and create only missing
approved additions. Preserve setup_check and every existing collection/index.

New financial collections: registrationintents, paymentorders, paymentevents,
paymentreceipts, paymentnotificationintents, paymentrefundreviews. Claims use the
existing tournamentregistrationclaims collection; optional intentId owns unpaid
claims, registrationId owns confirmed claims, exactly one owner. Existing free
claims need no rewrite/backfill. Add intentId_1, retaining existing unique
uniq_tournament_registration_claim on tournamentId/type/value.

Existing tournamentregistrations needs the previously proposed nonunique
valorant_roster_user_status and the unique partial objectId indexes
uniq_registration_payment_intent and uniq_registration_payment_order. Historical
records without payment/roster remain valid. No User/Team schema migration exists.
No automatic syncIndexes(), drop, replacement or backfill is permitted.

Every paid write entry checks the physical unique claim/financial/payment-link
indexes. Missing/incompatible definitions return 503 before accepting new checkout.
New financial models have autoIndex:false and autoCreate:false. Existing main
model auto-index behavior is otherwise unchanged: provision/review additive indexes
BEFORE deployment, or explicitly review automatic-index startup policy.

A separately authorized production read-only audit must confirm transactions,
nonunique legacy owner index for rejected-history retries, legacy active Valorant
records/participants/counters, references and claim ownership/index compatibility.
If the actual tournamentId/userId index is unique, retry after rejection may capture
money then fail registration; this is NO-GO until an owner-approved index-policy
resolution. This candidate never drops that index. Legacy rows without authoritative
rosters or counter consistency fail closed; do not silently migrate them.

## Activation and isolation

Default: paid APIs disabled and reconciliation worker off; free flow still works.
Activation requires BOTH VALORANT_PAYMENTS_ENABLED=true and
VALORANT_PAYMENT_WORKER_ENABLED=true. The latter starts a single-flight, bounded,
one-minute reconciliation loop only at normal app startup, not on module import.
The former free-only dev payment feature flags do not control this implementation.

Required secure server settings: RAZORPAY_MODE=test for sandbox (default),
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET. Live requires an
explicit RAZORPAY_MODE=live and matching live key prefix after release approval.
Never mix test/live keys, orders or webhook secrets. Only keyId is sent to Checkout.
No credential has been configured or tested here. Provider HTTP is bounded to ten
seconds, disables redirects and inherited proxies on the dedicated locked SDK
transport. Normal application HTTP clients remain unchanged.

Configure the provider webhook to the candidate backend's
/api/valorant-payments/webhook for payment.captured, payment.authorized and
payment.failed. Confirm automatic capture settings and merchant live readiness
through separately approved Razorpay account checks. Reserve financial records
and monitor captured_unfulfilled, failed/stuck events, reconciliation errors,
provider_create_unknown and requested/approved refund reviews.

The existing Phase 2 staging safety guard is intentionally UNCHANGED. It still
blocks payment mutations, webhooks and external network access, disables schedulers
and automatic indexes, and pins the approved isolated database/service/user. Paid
hosted staging is BLOCKED until a separately approved narrow Razorpay TEST-mode
isolation/allowlist plan exists; setting payment flags does not bypass the guard.
Do not weaken it or enable live payments for staging. Preserve the existing
41-document baseline and provision separate tracked synthetic fixtures only after
approval. Never use staging credentials against production.

## Validation and release gates

Local evidence is recorded below. Backend tests run with sanitized
environment and external-network denial, synthetic records and disposable loopback
MongoDB replica sets. Gateway calls are mocked; signature logic/SDK transport
configuration are real local checks. These do not establish Razorpay sandbox,
Atlas, Render, Vercel or browser success for this paid candidate.

Next gates: review this diff; approve isolated fixture/index and sandbox-isolation
plan; provision only reviewed test indexes; run actual checkout/webhook/recovery and
refund-review cases; complete deployed browser checks; authorize production
read-only compatibility; approve exact additive provisioning and recovery readiness;
review live merchant configuration, refund terms and support ownership; then obtain
explicit commit/push/merge/deployment approval. Keep PR #9 draft until ready.

Recovery: set VALORANT_CHECKOUT_PAUSED=true through a separately approved operational
change to stop new reservations/orders while keeping existing webhook, verification
and reconciliation available. Do not disable the global payment/recovery flags
while money is in flight. Retain all financial/claim data.
Never roll back to code that cannot settle or safely reject new intent/claim states.
Do not drop collections/indexes as cleanup. Actual hosted recovery remains an owner
approval gate, not a locally verified action.

Provider API reference: https://github.com/razorpay/razorpay-node/blob/master/documents/order.md

## Local paid-registration evidence

Validated 2026-10-19 on release/valorant-free-registration. The paid extension
is based on free-registration foundation b6bb6f837c9716e66eca154c3ddb229b93307ac6.
This evidence describes local automated validation, not hosted payment approval.

- Full backend: npm run test:backend - 180 passed, zero failed/skipped.
- Frontend: CI=true npm test -- --watchAll=false --runInBand - 77 passed,
  14 suites, zero failed.
- Frontend: CI=true npm run build - compiled successfully.
- Git diff --check, new-file whitespace and changed server JS syntax - PASS.
- Dependency manifests/lockfiles, User/Team models, hosting config and environment
  files - unchanged. No credentials/URIs, build artifacts or ignored fixtures are
  in the reviewed change set.

Backend includes 37 new payment checks in a fresh loopback MongoDB replica set:
fee validation; feature/mode/recovery gates; authoritative ten-minute reservation;
idempotency; roster overlap and capacity races; captured-only exactly-once
registration/receipt; signature/amount/order/currency failures; callback/webhook
concurrency; monotonic capture; missed-callback and uncertain-order recovery;
transaction rollback retaining captured evidence; expired authorized/provider-outage
release; failed webhook retry; physical-index fail-closed checks; paid cancellation
and rejected history; admin-only manual refund approval and provider verification;
SDK timeout/proxy/redirect settings without a connection; paid competitive results
and statistics; checkout-only pause; immutable fees, atomic fee/field validation
and protection from stale admin edits/financial tournament deletion.

The existing 143 backend checks remain included, covering BGMI/Free Fire,
competitive operations, legacy boundaries, public privacy, normal backend startup
and opt-in staging isolation. New frontend checks cover checkout/recovery without
trusting browser success, paid team selection, admin refund controls and own
receipt/refund/reservation status. Existing Explore, Games, profile, friend-action,
competitive and role-scoped navigation tests remain included.

All gateway HTTP is mocked. The real SDK is constructed only to inspect transport
configuration and never connects. Tests reject external network access and do not
inherit application DB/provider credentials. Every database write is confined to
disposable local synthetic fixtures. Existing hosted Atlas evidence is NOT
evidence for this new paid candidate.

Build notices for browser metadata, Node deprecation and bundle size are
non-blocking; no global lint suppression or dependency upgrade was used.

NOT TESTED / release gates:
- Real Razorpay TEST checkout, merchant capture settings, signed deployed webhook,
  delayed delivery, actual provider receipt lookup and refund outcomes.
- Newly approved Atlas fixtures/index provisioning and deployed browser/payment
  tests. Current staging guard still blocks all payments/external transports.
- Dedicated read-only production compatibility audit, exact additive provisioning,
  live merchant/key/webhook readiness, operational monitoring/support and recovery.
- Email delivery: receipt/outbox persistence is tested; no delivery worker is added.

Local GO for review; NO-GO for merge/live payments until these gates are complete.

### Exact committed file inventory (34 files)

- client/src/components/tournaments/TeamSelectionModal.js
- client/src/components/tournaments/TeamSelectionModal.test.js
- client/src/components/tournaments/ValorantRefundReviews.js
- client/src/components/tournaments/ValorantRefundReviews.test.js
- client/src/components/tournaments/ValorantRegistrationStatus.js
- client/src/components/tournaments/ValorantRegistrationStatus.test.js
- client/src/pages/admin/AdminValorantRegistrations.js
- client/src/pages/admin/AdminValorantRegistrations.test.js
- client/src/pages/admin/TournamentManagement.js
- client/src/pages/tournaments/SingleTournamentPage.js
- client/src/services/valorantPaymentService.js
- client/src/services/valorantPaymentService.test.js
- release/valorant-free-registration/README.md
- release/valorant-free-registration/indexes.json
- server/config/paymentFeatures.js
- server/features/payments/payment-event.model.js
- server/features/payments/payment-notification-intent.model.js
- server/features/payments/payment-order.model.js
- server/features/payments/payment-receipt.model.js
- server/features/payments/payment-webhook.routes.js
- server/features/payments/payment-worker.js
- server/features/payments/payment.integration.test.js
- server/features/payments/payment.routes.js
- server/features/payments/payment.service.js
- server/features/payments/razorpay.adapter.js
- server/features/payments/refund-review.model.js
- server/features/registration-intents/registration-intent.model.js
- server/features/valorant-registration/registration-claim.model.js
- server/features/valorant-registration/registration.routes.js
- server/features/valorant-registration/registration.service.js
- server/index.js
- server/models/Tournament.js
- server/models/TournamentRegistration.js
- server/routes/tournaments.js

The local VALIDATION.md helper remains Git-ignored and is not part of this commit.
