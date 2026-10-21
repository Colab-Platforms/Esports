# Activity Streak release

This selectively ports the Activity Streak feature from dev onto main's Competition Dashboard and OAuth releases. Other dev features are excluded.

## Behavior

- Authenticated visits check in automatically. A visible tab checks again after the India Standard Time day changes, and failed requests retry on focus, reconnection or the next minute. Responses from a previous account or an unmounted hook are discarded.
- `POST /api/streak/check-in` uses the authenticated user and server time. An atomic MongoDB update counts each IST calendar day once, including concurrent requests. Consecutive days extend the streak; a missed day resets the current streak while retaining the longest streak and total active days. A delayed request cannot overwrite a newer day.
- `/dashboard` shows Top Streak Performers, the player's current and best streak, and their rank when eligible. The leaderboard loads after check-in and refreshes when the app confirms another daily check-in. Errors have an independent retry button.
- `GET /api/streak/leaderboard?limit=5` includes only active users with explicitly public profiles and activity today or yesterday. Ranking uses current streak, longest streak, total active days, then user ID. Limit defaults to 10 and is capped at 50. Private players can see their own counters but have no public rank. Public rows expose username, avatar and streak counters, excluding email and full name.
- Both endpoints require authentication and return `Cache-Control: private, no-store`.
- Profile displays Activity Streak. Existing daily coin claims remain a separate Reward Streak; check-in does not create a wallet, award coins or modify payment configuration.

## Deployment

Deploy backend and frontend from the same main commit. There are no new environment variables or package dependencies. Additive User fields initialize on the first check-in; historic login rewards are not converted into activity history. The User schema adds a non-unique leaderboard index using the existing Mongoose index lifecycle. The API remains functional if index creation is disabled, although a large collection should have that index built through the normal database process.

After deployment, sign in and visit `/dashboard`. Confirm the streak and performers section loads, refresh to verify the count stays unchanged, and check Profile. A private profile should retain its own counters without appearing among public performers. Deployment availability must be verified separately from the local checks.

## Validation

The backend integration tests use a disposable local MongoDB replica set. They cover concurrent check-ins, IST midnight and leap/year boundaries, gaps, delayed requests, legacy counters, public ranking and privacy, inactive accounts, authentication, forged request bodies, and unchanged wallet/reward data.

Frontend tests cover automatic check-in, retries, in-flight deduplication, IST day changes, account switching, anonymous sessions, dashboard rankings, independent failure recovery and existing dashboard behavior. Run the full backend and frontend suites plus the CI production build before promotion.

Release verification: 228 backend tests passed; 90 frontend tests across 17 suites passed; the CI production build exited successfully (0).
