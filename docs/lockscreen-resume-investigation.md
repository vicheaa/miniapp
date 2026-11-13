# Five-minute lock/unlock investigation — 2026-11-13

The screenshot is consistent with a WebView transport failure followed by missing
automatic recovery. The recovery gap is reproduced with the current miniapp code.
The precise connection failure on the reported iPhone is not established by the
screenshot or by local tests.

The user reports leaving the screen locked for about five minutes. Whether Retry
recovers the affected device, and its installed SuperApp/bundle versions, remain
unknown. No application behavior or release artifact was changed in this investigation.

## What the screenshot establishes against this source

- `HomePage.tsx` starts separate summary and history queries. The two error boxes
  correspond to these two reads, not necessarily two independent backend failures.
- `request.ts` produces `Unable to reach the server.` for an exception that is
  neither an `ApiError`, a client timeout, nor a cancellation. In the normal fetch
  failure path, this means a rejected fetch/body stream. Other unexpected client
  exceptions inside the same try block are also classified as network errors.
- `formatApiError` prefixes recorded statuses with `HTTP <status>:`. The screenshot's
  unprefixed message therefore fits failure before the client records any response
  status. It does not show an HTTP 401 or the previously investigated wrapped 500.
  This inference assumes the installed bundle matches the current formatter.
- Auth refresh runs after recognized HTTP rejections. A failed connection with no
  response never reaches that branch. Refreshing a token alone cannot repair it.
- The dashes mean the summary query has no usable data under its current key.
  An already successful query retains its data even if a subsequent refetch fails.
  A request in progress, a later initial load, a reload, or a session/cache change
  must be considered; simply returning to a populated, unchanged screen is insufficient.

## Confirmed recovery gap

`src/App.tsx` sets `retry: false` and `refetchOnWindowFocus: false`. Both sales
queries inherit those defaults. They have no independent resume handler.

Consequently, a failed read can stay in error after connectivity returns. The
native `tokenRefreshed` event updates authentication while retaining the session
version, intentionally preserving the query cache; it does not refetch failed
queries. The manual Retry buttons explicitly call `refetch`, which can recover
once the connection works.

There is an existing exception: TanStack's default reconnect behavior remains
enabled. A genuine offline-to-online transition delivered to its online manager
can recover stale failed queries. Unlock does not itself guarantee such a
transition. It would be incorrect to claim all automatic reconnection is disabled.

## Why approximately five minutes matters

There are three different clocks, none of which identifies the trigger alone:

1. Query `staleTime` is five minutes. It marks data stale; it does not schedule a
   request, erase cached data, or create a failure at five minutes. The local
   investigation ages successful data past this threshold and verifies that
   focus still makes no request with the current configuration.
2. Native `LocalServerService` sets an HTTP idle connection timeout of 120 seconds.
   That is an idle connection setting, not a command to stop the server after two
   minutes. A stale/reclaimed connection is a candidate to inspect, not a proven cause.
3. Access tokens may expire during the absence. Earlier Sunmi evidence recorded
   roughly one-minute access-token lifetimes. That does not establish the lifetime
   of this user's iPhone token. The native resume path already attempts token
   synchronization; transport failure can prevent a miniapp read reaching the
   server regardless of token validity.

Apple documents that suspended apps cannot assume their listening sockets remain
usable; connections may need to be re-established on resume. This makes the local
server boundary relevant to this architecture, but does not prove iOS closed a
particular socket in this incident. See [Apple TN2277](https://developer.apple.com/library/archive/technotes/tn2277/_index.html).
TanStack documents its [focus/refetch behavior](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching).

## Native host findings (read-only inspection)

The local-bundle path is:

`WebView fetch → localhost Shelf server → shared Dart http.Client → Central/SFA`.

`SuperAppWebView.didChangeAppLifecycleState(resumed)` only starts
`_injectAuthToken()`. It does not check local-server health, establish a transport
readiness barrier, or emit a dedicated resume-ready event. This means auth
synchronization is not equivalent to recovering failed API queries.

`LocalServerService._handleApiProxy` converts an upstream send exception into an
HTTP 500 `Proxy Error: ...`. A successfully delivered proxy error should display
an HTTP prefix in this bundle. A dropped WebView-to-localhost connection fits the
shown message more directly. Direct remote requests, CORS rejection, and other
pre-response failures remain possible until the installed API origin and actual
WebKit error are captured. The response body is streamed after the proxy handler
returns; a later stream failure also needs separate tracing.

The source already removes gzip/framing headers after decompression. Whether that
code exists in the affected installed host was not verified. It would be premature
to attribute this screenshot to the old framing problem.

A separate native risk is present in `AuthInterceptor._refresh`: a transient
network/refresh exception clears the matching session. Resume can invoke this
path if the access token has expired while networking is still recovering. This
was established by source inspection, not observed for this screenshot. It should
be reviewed separately from retrying sales reads.

## Reproduction and verification

Run on Node 26:

```sh
node scripts/investigate-lockscreen-resume.js
```

This script reads the QueryClient options from the actual `App.tsx`, runs the real
sales functions, shared HTTP client, bridge bootstrap and token store, and observes
the real TanStack Query implementation. A loopback HTTP server supplies dummy
sales data and TCP faults. No real API, user credentials, Flutter proxy, WebKit,
or physical OS suspension is involved. Query focus/online events are driven
explicitly; cache age is changed instead of waiting five minutes.

Observed on 2026-11-13 using Node 26.13.0, working tree based on
`1edf287651205c37dfd48ebc0c86683b0b5ce8d4` with existing uncommitted changes:

| Scenario | Observed result |
| --- | --- |
| Successful cached reads aged past five minutes, then focus | No new requests; successful data remains |
| Both TCP connections lost before response | Both exact screenshot messages; no data; zero native refreshes |
| Healthy server restored, then focus | Both failed queries remain in error; no new requests |
| Native token event after failure | Token changes; session remains; queries remain in error |
| Manual refetch after connectivity returns | Both queries succeed |
| Explicit offline-to-online transition | Failed reads recover automatically |
| Delivered proxy HTTP 500 | `HTTP 500: Proxy Error: fixture upstream unavailable` |
| Truncated body after recorded HTTP 200 | `HTTP 200: Unable to reach the server.` |
| Hanging request past its resource deadline | `The request timed out.` |

The reproduction and syntax check passed. These are investigation scenarios,
not regression assertions that this undesirable behavior should be preserved.
The full existing test suite/build was not rerun because runtime code was unchanged.

The connected Sunmi V3's existing allowlisted log excerpt showed native refresh
at 09:28:17 and successful token checks at 09:28:26 on 2026-11-13. It contained
no miniapp diagnostic network events and does not establish the iPhone failure.
No phone was locked, app relaunched, bundle installed, or OTA record changed.

## Concrete correction and device verification path

1. Give safe reads bounded retries for transient transport failures, with backoff
   that can span brief recovery after unlock. Do not apply that policy to order
   submission or other writes; their outcome may be uncertain after connection loss.
2. Recover active failed reads when returning to the foreground. If native lifecycle
   delivery is required, emit resume-ready only after the local transport is usable
   and native auth synchronization has completed. Coalesce duplicate resume events.
   A token event alone is not a lifecycle/readiness signal.
3. Keep the local origin stable. Blindly restarting the server on another random
   port or reloading the whole WebView can strand the current document or disrupt
   an in-progress cart. Establish server failure before choosing host recovery.
4. Capture a five-minute reproduction on the identified iPhone/build. Correlate
   lifecycle transitions, local-server listener/port, query start/end, WebKit
   error domain/code, proxy arrival/status, and native refresh outcome. Record
   fixed categories and timing only; do not log tokens, headers or order bodies.

Use three states when checking: fully loaded sales page before lock, lock while
sales requests are pending, and unlock followed immediately by navigation to
sales. Repeat with an expired access token and with a genuine network change.
Success means the first resumed safe read completes automatically, loaded data
and cart state remain available, and no order write is replayed.

The remaining device evidence must distinguish a transient broken socket from a
dead local listener, a remote/CORS failure, and session clearing. The current
investigation proves the missing recovery behavior, not which of those triggers
occurred on the reported device.
