# Teams backend refactor

Moves Team and TeamInvitation models plus team/invitation/member HTTP operations into `server/features/teams`. Existing model and route imports remain compatibility aliases to the same models and MongoDB collections. Existing API paths, public listing filters, captain authorization and active-tournament deletion protections remain available.

Roster updates now copy Mongoose member values through `toObject()` so existing user IDs survive substitute changes. Team creation retains main's behavior and does not add dev's new profile-mutation side effects. Integration tests cover model compatibility, creation, public filtering, captain-only updates, substitute identity, invitation ownership, repeated invitation acceptance and active-tournament deletion protection. Existing competitive/payment tests also exercise the relocated Team model. No environment settings or schema migration are needed.

Combined release validation: all 285 backend tests passed. The three focused Teams integration tests also passed after the final compatibility adjustment.
