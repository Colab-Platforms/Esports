# Competition Dashboard release

Source: dev's Competition Hub (`8e13825`), adapted to production main after the
OAuth release (`9cd36db`). The dashboard is now a Competition Dashboard tab
under My Profile at `/profile?tab=dashboard`. The protected `/dashboard` route
redirects there, and there is no separate dashboard navbar entry.

## Included behavior

- Player header with connected accounts, saved game IDs and primary games.
- Distinct tournaments joined/completed, live registrations and active team counts.
- Upcoming/ongoing competitions, own teams, active registration status, recent
  competition notifications and a read-only wallet balance/earned/spent snapshot.
- Empty/loading/error/retry states and protection against stale StrictMode requests.
- Existing saved IDs remain unverified; OAuth accounts are labelled Linked.
  Steam entries are deduplicated and legacy Google/Steam accounts remain visible.

GET `/api/competition-dashboard` authenticates with the existing Bearer-token
middleware and always derives ownership from `req.user`, ignoring supplied user
IDs. Captain and immutable Valorant roster membership both establish ownership.
No other player's wallet, notification, roster, contact information, room
credentials, payment records or provider tokens are returned. Responses use
`Cache-Control: private, no-store`.

Counts use distinct existing tournaments, deduplicating registration and participant
sources. Rejected/cancelled attempts do not inflate counts. Missing tournament
references are excluded. Live registrations are filtered before limiting, so old
completed rows and retained rejection history cannot hide current entries.
Recommendations exclude full, expired, already joined and registration-closed
tournaments. Existing participants remain visible for ongoing/closed competitions.

The endpoint reads existing collections only. It does not create wallets, grant
coins, check in streaks, register teams, mutate financial records or call external
providers. No schemas, dependency manifests, payment flags or env files change.
Activity Streak remains a separate release. No new credentials, collections,
indexes or database migration are required.

## Verification

Disposable MongoDB replica-set tests cover authenticated ownership, zero state,
rejected-history retries, captain/roster/participant overlap, orphan references,
current registrations behind completed history, recommendations, account labels,
private team visibility, notification links and invalid/missing users. The actual
production entrypoint test checks the authenticated dashboard response and its
anonymous access boundary. Test setup denies external network connections.

Frontend coverage includes empty/populated views, account labels, wallet display,
valid links, invalid dates, error/retry, stale responses and navigation/route access
on desktop and mobile.

Local release results: all 222 backend tests passed; all 84 frontend tests across
16 suites passed; the CI production build compiled successfully. The focused
dashboard integration suite passed eight checks again after final compatibility
adjustments. Existing browser-data/deprecation/bundle-size notices remain.

## Deployment and recovery

Deploy the same release to the existing backend and frontend from main. After
deployment, log in and visit `/dashboard` or use DASHBOARD in navigation. Check a
new player and a player with a current team registration, including a Valorant
substitute, then compare the displayed counts/status/balance with existing pages.
Log out and verify the dashboard requires login. Existing provider logins and
payment settings are unchanged.

Local tests use synthetic records and do not establish deployed browser success
or production-scale query latency. Monitor dashboard latency on representative
accounts. Aggregations use MongoDB `$lookup` pipelines and `$unionWith`; they run
on the same MongoDB deployment as the existing app. No production data was
accessed or changed to prepare this release. Recovery is a source revert; there
is no data migration to undo.
# Navigation update

The Competition Dashboard now lives in My Profile as a tab beside General, My Tournaments and Profile Settings. Open `/profile?tab=dashboard` directly; the old authenticated `/dashboard` route redirects there. Desktop and mobile navbar entries have been removed. Dashboard data loads only when its profile tab is selected, and the embedded layout uses the profile page's width and spacing. The existing API, Activity Streak and other dashboard features remain available.
