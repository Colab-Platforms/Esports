# Store backend refactor

Moves StoreItem/Order models and catalogue, purchase, order and claim handlers into `server/features/store`. Existing model/route imports remain aliases; collections, schemas, paths and response envelopes are preserved.

The extracted order-list handler always takes ownership from the authenticated user, overriding any `userId` query parameter. Administrative claim reads and fulfillment/failure require an admin or moderator. A cancelled or completed claim cannot subsequently be fulfilled or failed for another refund. Existing prices, stock handling, five-hour cancellation window and coin accounting are retained.

Integration tests exercise authenticated order ownership, purchases, balances, stock, forbidden administrative access, fulfillment and sequential cancellation/refund protection. These refactors do not redesign concurrent purchases/refunds or the existing transaction architecture. No database migration, dependencies or new environment settings are required. Verify purchases, own order history, cancellation and authorized claim administration on staging before relying on hosted behavior.

Combined release validation: all 285 backend tests passed against disposable local databases and mocked external providers.
