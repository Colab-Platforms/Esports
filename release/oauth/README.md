# OAuth release from dev

This release selectively ports dev's Google, Steam, Facebook and Xbox adapters,
one-time code exchange, and Connected Accounts page onto main. It preserves
the existing local login and registration endpoints and the payment implementation.
No payment mode, worker flag, merchant credentials or hosted data is changed by
this source release.

## Behavior

- Login/signup buttons use a read-only provider availability endpoint before
  navigating to a provider; preflight does not create an OAuth session/state.
- Provider callbacks redirect with a 60-second, single-use code instead of a JWT.
  The frontend exchanges it once, including under React StrictMode, and removes
  callback credentials from the visible URL before fetching the current user.
- OAuth state/connect intents persist in Mongo-backed sessions across instances.
  Steam also uses a browser nonce in its signed OpenID return URL, using a fresh
  strategy instance per handshake rather than modifying a shared strategy.
- Authenticated users can connect/disconnect providers at `/connected-accounts`,
  linked from Profile Settings. Callbacks validate state before linking.
- Existing Google/Steam subjects resolve to the same User ID and migrate to an
  Identity on successful login. This includes old Steam profiles with default
  `isConnected:false`. Existing game IDs, saved Steam games and account age stay
  available; email matching alone never attaches a new provider.
- User/Identity creation is transactional, with unique provider-subject and
  user-provider indexes. Linking/disconnecting serializes on the existing user,
  preventing concurrent disconnects from removing every login method. Disconnect
  also clears the old subject fields so legacy fallback cannot restore it.
- Missing-email providers use an unverified synthetic `.invalid` address. User
  email validation accepts longer domains; new authProvider enum entries cover
  Facebook and Xbox. Existing user fields and security pins are preserved.

## Render and frontend configuration

Keep the backend's existing production `MONGODB_URI`, `JWT_SECRET`, `SERVER_URL`
and `CLIENT_URL`. `SERVER_URL` is the public backend origin; `CLIENT_URL` is the
frontend origin. Set a stable `SESSION_SECRET` shared by all backend instances;
existing JWT_SECRET is the compatibility fallback if it is absent. Production
sessions use secure, HTTP-only SameSite=None cookies by default, configurable
with `SESSION_COOKIE_SAMESITE`. Never expose backend secrets through REACT_APP vars.

| Provider | Backend environment | Registered callback |
| --- | --- | --- |
| Google | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | SERVER_URL/api/auth/google/callback |
| Steam | STEAM_API_KEY; optional STEAM_RETURN_URL, STEAM_REALM | SERVER_URL/api/auth/steam/return |
| Facebook | FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET | SERVER_URL/api/auth/facebook/callback |
| Xbox | MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET | SERVER_URL/api/auth/xbox/callback |

The frontend uses its existing REACT_APP_API_URL. Provider secrets stay on Render.
Providers without credentials report unavailable. Facebook/Xbox require the
provider application and callback configuration before their buttons can sign in.
Steam return URLs now include a per-browser query nonce; the configured base
callback remains the same.

`identities`, `authcodes` and `sessions` are additive auth collections in the same
configured database. Auth models initialize their indexes; sessions use a TTL
index. New auth operations wait for Identity/AuthCode initialization. There is no
startup bulk migration or User backfill and no manual payment migration required
for this release. The existing isolated staging guard remains in place.

## Validation and remaining hosted checks

Local release evidence: `npm run test:backend` passed 214 checks; frontend
`CI=true npm test -- --watchAll=false --runInBand` passed 79 checks across
15 suites; `CI=true npm run build` compiled successfully. Existing browser-data
and Node deprecation notices remain. No live provider account or hosted database
was accessed for this release.

Tests use disposable loopback replica sets, synthetic identities, mocked external
provider responses and real HTTP/session/database/JWT flows. They cover legacy
account reuse, email collisions, concurrency, inactive accounts, code replay and
expiry, shared sessions, callback state, cross-user linking and last-method
disconnect protection. Frontend tests cover the single-use exchange in StrictMode.

Before considering hosted OAuth verified, check real provider consent and return
to the deployed frontend, existing Google/Steam login, connect/disconnect, disabled
providers, browser cookie behavior, and ordinary password login. Local tests do
not establish live provider configuration. Deploy both frontend and backend from
this release; keep payment live testing on hold as requested.
