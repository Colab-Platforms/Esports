# Wallet backend refactor

Moves Wallet/Transaction models and wallet HTTP handlers into `server/features/wallet`. The relocated wallet service retains main's existing methods and adds the extracted summary, embedded history, daily reward, streak status and deduction handlers. Legacy model, service and route imports remain compatibility aliases to the same model/service objects and MongoDB collections.

Existing response envelopes, coin reward amounts, seventh-day bonus, server-local reward day boundaries, wallet balance/history and Activity Streak separation are preserved. This release does not change Razorpay configuration or reward scheduling. No database migration, new environment settings or dependencies are required.

Integration tests cover alias compatibility, authenticated wallet ownership, summary/history shapes, seventh-day rewards, sequential duplicate-claim rejection, unchanged Activity Streak, deductions and insufficient-balance validation. They do not redesign the existing reward concurrency or wallet transaction architecture. Verify wallet summary, daily rewards and transaction history after deployment.

Combined release validation: all 285 backend tests passed against disposable local databases and mocked external providers.
