# Games backend refactor

Moves the Games model and HTTP handlers into `server/features/games` with separate routes, permissions, controller, service and constants. Existing imports through `server/models/Game` and `server/routes/games` remain compatibility aliases. Model/schema, collection name, API paths and response shapes are preserved.

Main's cache invalidation on successful creation is retained; activation also invalidates both catalogues. Authenticated database roles continue to control mutations. Existing Games security integration tests cover public reads, active filtering, stale token roles, all mutation permissions and Redis cache invalidation. No environment settings or database migration are needed.

Combined release validation: all 285 backend tests passed against disposable local databases and mocked external providers.
