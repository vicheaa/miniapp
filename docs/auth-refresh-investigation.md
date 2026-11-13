# Miniapp refresh investigation — 2026-11-12

The reported order-detail failure bypassed refresh because Central returned HTTP
500 for an upstream SFA HTTP 401. The shared miniapp client only checked the outer
HTTP status. The refresh bridge could be present and correct without ever being called.

## Evidence and request path

1. `src/services/api/order.ts` sends the order-detail GET to
   `/services/central/api/name/staff-order-detail/find?id=32` using the shared client.
2. The screenshot shows an SFA rejection from `SFAApiProxy#staffOrderDetail(Long)`:
   `ex.code = authentication_failed`, `ex.message = Token has expired.`.
3. `../sfa-api/core/authentication/keycloak.py`, `verify_token`, raises that exact
   message for `jwt.ExpiredSignatureError`.
4. `../INTERN-OML-EMPLOYEE-API/oml-core/src/main/java/com/oml/core/rest/StandardRestService.java`,
   `getOne`, catches every exception and returns `internalServerError()` with a
   `FailedResponse("Data failure", e.getMessage(), e.toString())`. The response
   record's numeric body status is 550; the actual HTTP status is 500.
   `DataRestService` and the other StandardRestService methods have the same pattern.
   This matches the screenshot's outer HTTP 500, Feign exception text, and Data failure.
5. Before this change, `src/services/api/request.ts` invoked recovery only when
   `response.status === 401`. It never reached `refreshNativeAuthToken` for this error.

The Central checkout contains this generic error handling but does not contain
the named SFA proxy implementation. Consequently this investigation does not
establish whether that deployed proxy has any additional token caching. Central's
generic `TokenRelayRequestInterceptor` and JWT branch in `AuthorizationHeaderUtil`
relay the caller's bearer token without owning refresh credentials.

Miniapp requests use WebView `fetch`. They do not pass through native Dio's
request interceptors. Native proactive JWT refresh only helps when native requests
or `getAuthToken` run; the miniapp must explicitly bridge recovery for its own failures.

## Additional stale-token path

The current SuperApp source supports `refreshAuthToken` in both the SDK and native
CoreBridgePlugin. The native implementation delegates to DioClient/AuthInterceptor,
which owns refresh credentials, form submission, and token rotation.

`SuperAppWebView.didChangeAppLifecycleState` synchronizes authentication on resume.
The injected SDK converts native `updateToken` into `tokenRefreshed({ token })`.
The miniapp previously subscribed only to language changes, leaving Zustand's
`authToken` stale even when native storage and the SDK cache were updated.

## Changes in this workspace

- The shared client recognizes the exact Central/SFA expired-token wrapper on
  staff-order GET find/list/page reads. It shares the existing refresh operation
  with direct 401 failures, then replays once using the returned token.
- Generic 500s, different proxies, revoked tokens, malformed wrapped errors, public
  requests, and custom Authorization headers do not trigger this compatibility path.
  Wrapped errors on writes are not replayed because their side effects are uncertain.
- Bootstrap subscribes to native token events, including events arriving during
  startup. Token rotation preserves the session version and existing queries.
  An empty native token clears the session; old/disposed listeners cannot restore it.
- Refresh credentials remain native. A missing bridge, failed refresh, or rejected
  replay still surfaces the server error without a retry loop.

## Verification

- Node 26: `npm test` passed all 112 tests, including 43 infrastructure tests.
- `npm run typecheck` and `npm run build` passed; `dist/` and `miniapp.zip` were built.
- Postman CLI 1.74.0 served the extended existing auth fixture on localhost:4912.
  `scripts/verify-auth-refresh-simulation.js` executed the actual injected SDK source
  from adjacent `oml-central`, real bootstrap/store/native-refresh adapter/client,
  and real HTTP requests. Native dispatch was simulated with dummy credentials.
- Three concurrent requests (two wrapped 500s and one direct 401) made one refresh
  POST and three successful replays. Fixture counters reported one refresh and six
  resource requests; Postman request events confirmed the sequence and form encoding.
- A refresh 503 preserved the original wrapped 500 and made no resource replay.
  A still-rejected replay stopped after one refresh and two resource calls.
  A native resume push updated the miniapp token and allowed the next read without refresh.

The fixture models the supplied screenshot and local backend source. It does not
prove production refresh responses, device WebView delivery, or Flutter secure
storage behavior. No production credentials or API calls were used.

## Backend correction and remaining device check

Central should translate upstream authentication failures into actual HTTP 401
with a stable error body, rather than passing them through the catch-all 500.
Apply this where the relayed user authentication failure is known; blindly changing
all dependency 401s can misclassify service-account failures. The backend checkout
was inspected only; this workspace change supplies read compatibility while the
backend correction is pending.

Reload the updated miniapp, leave it open until the access token expires, and open
an order. The expected trace is read rejection, one native refresh, then a successful
read using the new access token. Also background/resume the app and verify the next
read uses the pushed token. Never log full access or refresh token values.

Other observed native behavior, not established as the screenshot's cause:

- Native AuthInterceptor clears the matching session when refresh throws, including
  transient 503/network failures. The miniapp preserves the original API rejection,
  so native logs are needed to distinguish a refresh failure from its original cause.
- Miniapp startup is bounded to 5 seconds and refresh to 10 seconds, while native
  HTTP timeouts are 30 seconds and SDK auth promises permit 120 seconds. A slow
  native refresh can outlast the miniapp's wait. These limits were not changed.
- Debug hot reload does not itself replace an already-injected SDK: the host caches
  the script and the SDK guards repeated initialization. A native SDK edit can
  require restarting the debug host and reopening the WebView. The outer-status
  failure described above occurs even with the current bridge successfully loaded.

## Follow-up: first request must recover without Retry

The user subsequently reported that recovery still required manually tapping
Retry. This follow-up reproduced two additional client timing failures before
changing the implementation:

- A server sends 401 headers and delays the error body. The old implementation
  waited for the body before refreshing. A regression fixture withheld the body
  until refresh began; the old client timed out without invoking refresh.
- A resource consumes part of its timeout, then native refresh succeeds. The old
  single timer expired while refresh was running, rejecting the original query.
  A regression query with React Query retries disabled failed before the fix.

The request client now starts recovery on the first 401 headers and reads its
error body concurrently only to retain failure details. Native refresh has its
own timeout; a successful replay gets a new resource attempt and full resource
timeout. The original query stays pending throughout. Cancellation, session-change
protection, one shared refresh, and at most one replay remain in place.

The previously noted 10-second native bridge wait has now been increased to
120 seconds, matching the SDK auth wait; the initial investigation's statement
that this limit was unchanged describes the first patch only. Resource attempts
remain bounded to 20 seconds by default, including each attempt's body reading.

Verification for the follow-up:

- Both new regressions failed before the timing changes and passed afterwards.
- All 117 tests passed, including 46 infrastructure tests; typecheck and the
  production build passed, producing an updated `miniapp.zip`.
- The existing Postman fixture now supports a dummy `fixture-refresh-slow` token.
  The actual injected SDK and real miniapp bridge/client/query code recovered the
  first HTTP 401 after an 11-second refresh, using a 500 ms resource timeout and
  no query retries. The query never entered error state. Fixture counters and
  request events showed one refresh and exactly two resource calls (401 then 200).
  The refresh HTTP event took 11001 ms; no manual refetch was invoked.

Native dispatch was simulated and no production/device logs were available.
These tests establish the fixed client timing behavior under the modeled conditions;
they do not establish which timing condition occurred on the user's device.

## Staging device verification and captured internal-token wrapper

On 2026-11-12, staging SuperApp build 46 was built and installed on the Sunmi V3.
The sales miniapp's v0.1.8 staging diagnostic package was loaded as a local test
override. The previous APK and sales bundle were backed up under
`/private/tmp/miniapp-auth-sunmi-pfsifc9z`. No credentials were extracted and no
order was submitted. The server OTA record was not published or changed; the
device's v0.1.7 cache marker was preserved so the old server manifest would not
overwrite the local test bundle on launch.

The device reproduced a different exact upstream message at 13:24:35:
`Internal microservice token has expired.` It appeared inside Central's HTTP 500
`Data failure` wrapper, with upstream HTTP 401, `SFAApiProxy`, and
`ex.code: authentication_failed`. The deployed message is absent from both local
backend checkouts, so the exact ownership and generation of that internal token
remain unverified. It must not be treated as proof that a valid user session
should be refreshed.

The client now handles that exact read wrapper only when the rejected user's JWT
also has a numeric expiry that has passed. With a valid or opaque user token, the
same response remains an HTTP 500 without a native refresh. This guard preserves
backend credential failures while recovering the expired-user-token case. A new
local HTTP regression failed before this change and passed afterwards. Generic
500s, writes, custom authorization, and unrelated proxies retain their behavior.

Actual device events, recorded before this final guard, establish immediate
recovery for direct 401 responses:

- At 13:28:15, history and summary failed together, shared one 113 ms native
  refresh, and completed their automatic replays in 620 ms or less. No Retry was
  pressed. Refresh began about 5 ms after the first 401 event.
- At 13:33:36, an order-detail request had an access token 76 seconds past expiry.
  Its 401 started a 94 ms native refresh and automatically replayed to HTTP 200.
- Catalog reads also succeeded in this debug build; after deployment, a new
  expired-token catalog recovery was not captured before the device disconnected.

The safe event excerpts are in `docs/auth-refresh-device-verification.json`.
`VITE_AUTH_DIAGNOSTICS=true` enables staging-only `[Miniapp Auth]` events. They
contain paths without query parameters, numeric expiry/timing hints, statuses,
and fixed wrapper indicators; never tokens, headers, claims, or response bodies.
The production build excludes this console sink even if the flag is supplied.
`scripts/collect-auth-diagnostics.py` saves only allowlisted events, not raw logs.

Final local verification passed all 123 miniapp tests, TypeScript checking, and
seven SDK/HTTP simulation scenarios. The added scenarios prove one automatic
refresh/replay for the captured wrapper with an expired user JWT, and no refresh
for the same wrapper with a valid JWT. The native dispatcher is simulated in
those scenarios. Earlier native verification passed 122 Flutter and 19 SDK tests;
the native source was not modified during this implementation.

`miniapp.zip` contains manifest ID 4, version 0.1.8. `miniapp.release.json` records
its SHA-256, staging mode, and enabled diagnostics. The final guarded package was
built after the Sunmi disconnected and has not been deployed or verified there.
Build 46 and the earlier diagnostic package remain installed. Publishing the
new OTA manifest and checking the final guarded package on the Sunmi remain
delivery steps; no backend code or production publishing was performed.

## Follow-up: order submission skips refresh — 2026-11-13

The new Cart Detail screenshot shows a different operation:
`POST /mobile/staff-order/save/`, invoked by `SFAApiProxy#staffOrder(JsonNode)`.
Central returns HTTP 500 with `Data failure` around the upstream HTTP 401. The
upstream response body is empty (`[]`), so this screenshot does not establish
which credential failed or prove that the user's access token has expired.
Local `StandardRestService.exec` has the same catch-all 500 handling previously
observed on reads. The deployed proxy implementation is still unavailable here.

The shared client recovers actual HTTP 401s and specific wrapped GET failures.
It does not recover this wrapped POST failure. WebView fetch bypasses native
Dio interceptors, and the client previously had no expiry check before sending
an order. Two new order regressions failed before the change: an expired token
was sent without native refresh, and refresh unavailability did not prevent it.

The client now checks managed authentication before POST, PUT, PATCH and DELETE.
When the JWT's numeric expiry is within 30 seconds or already past, it awaits
the existing shared native refresh before any HTTP write. The threshold matches
native AuthInterceptor. Refresh has its own deadline, followed by a full resource
timeout. Cancellation or session replacement blocks the pending write. A failed,
unchanged or still-expiring refresh result also blocks it. Refresh credentials
remain native; no new token endpoint or refresh credentials were added to JS.

After this proactive refresh, the request has consumed its one recovery attempt.
A subsequent rejection is returned without repeating the write. Wrapped POST
500s remain unreplayed because neither the screenshot nor the local contracts
prove that repeating them is safe. Public requests, caller-supplied Authorization
and tokens without a readable numeric expiry retain their previous behavior.
JWT expiry is only a scheduling hint, never identity verification.

Verification on Node 26.13.0:

- All 158 tests, TypeScript checking and the production build passed. The two
  order regressions now pass. Additional real localhost HTTP tests cover shared
  refresh across writes and a rejected read, failure before sending, cancellation,
  session replacement, separate deadlines and at most one refresh per write.
- All 11 existing/extended SDK simulation scenarios passed against Postman CLI
  1.74.0 on localhost:4921. The actual injected SDK, miniapp bootstrap, token store,
  bridge adapter and request client ran; native dispatch was simulated.
- Postman events show refresh HTTP 200 at 06:12:22.526 UTC, followed by the sole
  successful order POST at 06:12:22.529 UTC, with its JSON payload preserved.
  A separate refresh 503 caused zero order POSTs. A modeled wrapped POST rejection
  after successful refresh caused one POST and no replay. Fixture counters ended
  at three order requests and one simulated saved order across these cases.
- Staging diagnostics now expose the fixed `auth_preflight` phase without token
  values; the existing redacted collector accepts this phase.

The rebuilt `miniapp.zip` is production mode, manifest ID 4/version 0.1.8, with
diagnostics disabled; its checksum is in `miniapp.release.json`. It has not been
published or tested on the reported iPhone. No live order was submitted. Central
still needs to preserve known relayed-user authentication failures as HTTP 401.
If a fresh user token still produces this wrapper, investigate the deployed
proxy's forwarded credential and any backend service token instead of assuming
another user refresh will fix it.

## Follow-up: immediate 401 recovery and readable errors — 2026-11-13

The user requested immediate refresh without exposing the first 401, plus better
error styling. Actual HTTP 401 headers already started recovery before the error
body completed. However, the write preflight added above suppressed subsequent
401 recovery. That restriction has been removed: a real 401 now gets one reactive
refresh and at most one replay even after proactive refresh. The preflight's
completed refresh result is not reused to recover a rejection of that same token.
A second rejected response terminates the request. This supersedes the previous
section's statement that preflight consumes the reactive recovery attempt.

The original order promise stays pending throughout refresh/replay. Checkout
keeps its submitting dialog open, blocks duplicate submissions and exposes no
intermediate submitError. Failure only reaches the UI after recovery fails or the
replay is rejected. Wrapped POST 500s remain unreplayed; changing the presentation
does not establish that an ambiguous write is safe to repeat.

Checkout, catalog and order read errors now use a shared accessible error card
with a soft background, icon, title, explanatory text and appropriate action.
English and Khmer translations replace raw server exception strings and HTTP
codes. Failed authentication gives session-reconnection guidance; validation,
permission and connectivity failures have distinct copy. An uncertain order
outcome offers order history before another submission. Original ApiError status,
body and cause remain available programmatically; only presentation changes.

Verification:

- All 162 tests passed, including actual saveOrder/draft tests withholding a 401
  body until native refresh started. Both ordinary and post-preflight 401 cases
  completed without an intermediate error or a manual Retry. Repeated rejection
  stopped after one reactive refresh/replay. TypeScript and production packaging
  passed; miniapp.release.json has the updated archive checksum.
- All 12 SDK/HTTP scenarios passed against the local Postman fixture. Request
  events for the added scenario showed proactive refresh 200, order POST 401,
  reactive refresh 200 and order POST 200, with two requests and one modeled save.
  The injected SDK and miniapp client ran; native dispatch was simulated.
- Headless Chromium exercised the real React checkout against local fixture
  responses. A streaming 401 kept the submitting dialog open with zero alerts,
  then automatically completed after the simulated native refresh. A failed
  refresh displayed friendly session guidance without a raw 401. The wrapped
  500 displayed the new card without backend URLs or proxy names. English and
  Khmer screenshots at 320px and 390px were inspected and had no horizontal
  overflow. Browser script: /private/tmp/miniapp-checkout-errors-browser.mjs;
  screenshots: /private/tmp/miniapp-checkout-error-{en,km}-{320,390}.png.

The updated production-mode miniapp.zip has not been deployed. The reported
iPhone, real native refresh/storage and production order submission were not
exercised in this follow-up.
