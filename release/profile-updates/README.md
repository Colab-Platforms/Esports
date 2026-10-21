# Profile and Public Profile release

The public player page at `/player/:username` uses the existing public competitive profile, statistics and history endpoints. It displays gaming accounts, games, tournament participation, verified statistics, teams and achievements with responsive layouts and reduced-motion support. Saved IDs remain unverified. Empty sections have explicit empty states; statistics failures have a separate retry path. Private/missing profiles and stale requests do not display cached profile data. Invalid dates render as TBA.

The existing friend-request action is preserved alongside the new layout through the existing authenticated friend-status and request endpoints. The signed-in profile at `/profile` adds a public-profile link for explicitly public accounts and a Players & Teams link. Existing settings, Activity Streak and tournament tabs remain available. This release includes the profile edits already present in the checkout before preparation; their original patch is preserved in the local ignored cache.

No backend endpoints, database fields, environment settings or dependencies are added. Validate logged-in and anonymous profiles, a private profile, friend requests, statistics/history, links to tournaments and Profile settings after deployment. Local frontend tests cover empty states, privacy failures, retries, saved IDs, invalid dates, stale StrictMode responses, profile visibility and the existing friend-request action.

Release validation: all 97 frontend tests in 19 suites passed, and the CI production build exited successfully. Hosted deployment and browser smoke checks are separate verification steps.
