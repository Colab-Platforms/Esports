# Leaderboard scoreboard and published-results views

`/leaderboard` now offers BGMI, Free Fire and Valorant game selectors, each with two separate views:

- **Scoreboards** is the default. It lists existing public tournament scoreboard images, newest first, with image links, tournament links and pagination. Final standings do not need to be published for an image to appear here. Existing image records are reused without migration or re-uploading.
- **Published Results** shows official tournament winners, ranks, scoreboard availability and links to full results, using the existing results directory API. Only published snapshots and snapshots awaiting review appear. Uploading an image alone does not create published standings.

The existing `/admin/bgmi-registrations` scoreboard upload flow and upload/delete APIs are preserved. Player verification screenshots are separate and are not included in this gallery. The new public `GET /api/tournaments/scoreboards-gallery?gameType=bgmi&page=1&limit=12` reads only public scoreboard fields, supports all three games, validates pagination and avoids stale response caching after uploads/deletions. Existing BGMI/Free Fire scoreboard endpoints also remain available.

CS2 player rankings remain accessible through a CS2 selector, and the page links to the existing competitive team rankings at `/competitive-leaderboards`. The standalone `/tournament-results` directory remains available and shares its published-results component with the new view. It now guards against stale requests and invalid dates.

Game and view selection are shareable through query parameters, for example `/leaderboard?game=freefire&view=published`. Game changes reset per-view pagination. Errors can be retried independently, and late responses cannot replace the selected game's content. The result-view tabs support keyboard navigation. Images use HTTP(S) links and open safely in another tab.

Deploy frontend and backend from the same main commit. There are no new environment variables, dependencies, indexes, schema changes or database migrations. Publishing final standings remains an explicit authorized admin operation; this release does not automatically publish old images or add OCR.

Local validation uses disposable MongoDB replica sets and mocked external providers. Backend tests cover game isolation, legacy unpublished images, ordering/pagination, query validation, public projection and the existing admin upload/delete workflow. Frontend tests cover default legacy images, both views for each game, published ranks/private-team links, safe images, retries, stale requests, game pagination reset and CS2/competitive navigation. Hosted image availability, production uploads and published result contents should be checked separately after deployment.

Release validation: all 303 backend tests and all 113 frontend tests across 20 suites passed. The CI production build exited successfully (0).
