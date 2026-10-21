# Payment receipt email release

This selectively ports the receipt email service, HTML/text template, bounded retry worker and in-process scheduler from dev onto main. Main's existing payment settlement already creates a receipt and a unique notification intent in the registration transaction. The worker consumes that outbox after settlement; it does not capture payments, approve registrations, issue refunds or create additional receipts.

## Delivery rules

- Delivery and both worker execution modes default to disabled. Importing the modules does not start polling or send mail.
- A receipt requires a captured, fulfilled payment and a paid registration. Notification, receipt, payment, captain, tournament, intent, amount and currency must agree. Only the captain's current verified email on an active account is eligible. Invalid, synthetic, changed or unverified addresses go to `needs_attention` without sending.
- Atomic leases prevent concurrent claims. Every result/retry update checks claim ownership, so a late provider failure cannot overwrite a newer worker's result. An expired lease can be reclaimed; an exhausted final lease goes to manual attention instead of remaining stuck in processing.
- Each notification uses a stable Resend idempotency key and a saved request payload. Retries preserve the payload, exclude Mongoose metadata from provider requests, and stop after a bounded number of attempts. Provider timeouts and ambiguous acceptance remain `delivery_uncertain`. Notifications outside the configured implementation's 24-hour provider idempotency window require manual attention instead of automatic resend.
- `sent` means the provider accepted the message and returned an ID. It does not establish inbox delivery. Verify provider events/inbox separately.
- The template shows the receipt number, tournament, team, amount, payment date/reference and registration review status. User content is escaped in HTML. The payment confirmation does not promise approval or a review deadline.

## Render configuration

The release changes code only. Existing environment settings are not changed. To enable automatic delivery on the API service, configure these settings after reviewing the queued notifications:

```dotenv
PAYMENT_RECEIPT_EMAIL_DELIVERY_ENABLED=true
PAYMENT_RECEIPT_EMAIL_IN_PROCESS_ENABLED=true
PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME=colab-esports
PAYMENT_RECEIPT_EMAIL_IN_PROCESS_POLL_SECONDS=60
PAYMENT_RECEIPT_EMAIL_IN_PROCESS_BATCH_SIZE=1
```

The expected database must exactly match the API's actual MongoDB database name. The production database previously audited for this release series was `colab-esports` with a hyphen. The scheduler starts only after MongoDB connects and checks identity before every scan. It is disabled in the isolated Phase 2 staging harness and test runtime.

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` must identify a configured Resend account and its verified sender. Set secrets through Render; do not commit them. The receipt sender requires an explicit from address and does not use a console-only delivery fallback.

Optional controls:

| Setting | Default | Purpose |
| --- | --- | --- |
| `PAYMENT_RECEIPT_EMAIL_MAX_ATTEMPTS` | 5 | Maximum attempts for newly created notification intents |
| `PAYMENT_RECEIPT_EMAIL_LEASE_SECONDS` | 120 | Processing lease |
| `PAYMENT_RECEIPT_EMAIL_SEND_TIMEOUT_SECONDS` | 30 | Provider timeout, further bounded by the lease |
| `PAYMENT_RECEIPT_EMAIL_BATCH_SIZE` | 10 | Standalone worker batch limit |

If using a separate Render worker/cron job instead of in-process polling, leave in-process execution disabled, set `PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED=true` and delivery enabled, set the expected database, then run:

```powershell
node server/workers/payment-receipt-email.worker.js
```

This command processes one batch and exits. It needs external scheduling for continuous delivery. The standalone worker refuses an unexpected database. Targeted delivery/preflight is a development-only mode and is rejected in production. Preflight-only mode requires a notification ID and cannot fall back to sending a batch.

## Enablement and verification

Enabling delivery consumes existing eligible pending notifications as well as new ones. Review the backlog first, particularly test-payment records; this release does not add a gateway-mode filter. `isLiveOrder` in the existing model means an active order and is not a reliable test/live Razorpay distinction.

Verify the existing payment/notification indexes with the previously released payment index audit. This release adds no indexes or database backfill. Monitor scheduler logs and notification states; `needs_attention` records require a reason-specific review. Do not reset `sent` or uncertain records blindly, as that can duplicate a message outside the provider's deduplication window.

In staging, make a test-mode payment with a verified captain address and an approved email sender. Check one queued intent becomes provider-accepted, then verify its email contents and that repeating verification does not send a second receipt. Confirm failed provider requests retry without changing registration/payment state. Real inbox delivery and live Razorpay testing remain separate deployment checks.

## Local validation

Run `npm.cmd run test:backend`. Tests use disposable local MongoDB replica sets and mocked email/payment providers; they do not contact Render, production MongoDB, Razorpay or Resend. Coverage includes main's actual settlement-to-outbox path, repeated verification, concurrency, lease recovery, stale responses, provider timeouts, retries, recipient checks, mismatched references, template escaping, feature flags, scheduler identity changes and worker preflight guards.

There are no frontend or dependency changes in this release.

Release verification: the full backend suite passed all 276 tests, including production/staging entrypoint regressions and payment settlement integration. Provider calls were mocked; production inbox delivery was not tested.
