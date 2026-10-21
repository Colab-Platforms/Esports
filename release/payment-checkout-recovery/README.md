# Additional payment release: checkout recovery

Ports dev's implemented abandoned-checkout and uncertain provider-order recovery into main's existing payment architecture. Main's registration claims, tournament transaction lock, fee/index guards, mode checks, webhook validation, receipt delivery and admin-reviewed refund workflow are retained. The unused standalone Refund schema on dev is not an implemented refund-creation workflow and is not introduced here.

## Recovery behavior

- A retry after a lost Razorpay order-creation response searches by the persisted receipt reference. Exactly one matching provider order can be attached to the existing local order. Amount, currency, receipt, local order ID and intent ID must match. Zero results, multiple matches or mismatched evidence cannot trigger another provider create request.
- `POST /api/valorant-payments/intents/:intentId/recover` requires the authenticated captain. Request bodies cannot select another user. It uses the existing payment enablement and recovery-worker flags.
- A live reservation is unchanged. For an expired reservation with no provider order, recovery releases the slot and thirteen roster claims under main's tournament transaction lock. With an existing provider order, recovery additionally requires an untouched `created` order with zero paid amount, zero attempts and a readable complete payment collection containing no payments.
- Any saved payment event, existing registration, authorized payment, attempted checkout, incomplete/mismatched provider response or provider outage prevents on-demand abandoned recovery. Captured money is settled through main's late-capture review path; expired captures do not create a paid registration or receipt automatically.
- Concurrent recovery requests cannot release a slot twice. Transactional rechecks detect local changes after provider reads. The historical intent and order are retained; an abandoned order is locally marked cancelled and inactive. This does not cancel the Razorpay order at the provider.
- If an old checkout later captures after a replacement reservation has started, it receives its own refund review without colliding with the replacement's unique intent guard or deleting the replacement's roster claims. Existing periodic expiry/reconciliation policy remains in place.
- The frontend checks an expired existing attempt through the recovery endpoint before starting a replacement. Uncertain/review-required results stop checkout; a returned existing registration is reused.

## Deployment

Deploy frontend and backend from the same main release. There are no new environment variables, dependencies, schema/index changes or database migrations. Existing payment enablement/mode settings and the live-testing hold are not modified. No automatic refund creation is added; administrators continue to approve reviews and verify externally created provider refunds through the existing flow.

Verify in staging with Razorpay test mode: dismiss and expire an untouched checkout, resume an order after a lost response, check uncertain/authorized states do not start a replacement, and verify a late capture enters review while retaining any replacement reservation. Do not use live funds for these local checks. Actual provider and production behavior must be verified separately from mocked local tests.

## Validation

Payment integration tests use disposable local MongoDB replica sets and mocked Razorpay/Resend providers. Coverage includes lost responses, ambiguous/mismatched order lookup, concurrent recovery, ownership, feature flags, expiry without an order, provider outages, incomplete payment evidence, authorized/captured/failed payments, saved webhook evidence and late capture after replacement. Existing refund approval/provider verification and receipt tests remain part of the full backend suite. Frontend tests verify replacements require server confirmation and uncertain recovery never falls back to another checkout.

Release verification: 299 backend tests passed; 105 frontend tests across 19 suites passed; the CI production build exited successfully (0). No real gateway payment, refund or email delivery was performed.
