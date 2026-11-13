# SuperApp mini-app starter

React, TypeScript, and Vite starter for mini-apps hosted by the SuperApp. Includes
the native bridge, browser development tools, authenticated HTTP requests, English/Khmer
localization, hash routing, Zustand, React Query, and Tailwind. No backend is required
to start, and the starter page makes no API calls.

New to this project? Follow the short [getting-started guide](GETTING_STARTED.md)
to set up your first mini-app and add a feature.

## Start a new mini-app

Create a branch or copy this starter, then:

```bash
nvm install
nvm use
npm ci
cp .env.example .env.dev
npm run dev
```

Use Node 26 LTS and npm. The system `zip` utility is required for packaging
(preinstalled on macOS; install it on Linux if necessary).

Customize `src/config.ts` for the app title, startup timeout, request timeout,
default language, and native pull-to-refresh setting. Rename the package in
`package.json` and update the lockfile with `npm install --package-lock-only`.
Add your screens under `src/pages/` and register them in `src/router/index.tsx`.
The homepage links to the New PO product catalog at `#/products`. It queries the
staff-order category and product APIs using the current native bearer token.
Product requests omit pagination parameters and expect `{ items, page, page_size, total }`;
the backend must return the complete matching list when pagination is omitted.
Category filters and search run on the server. Selected quantities remain in a
localStorage cart that restores after reload or reopening on the same origin.
Every quantity change and removal is saved; emptying the cart removes the saved
entry. Native startup restores after authentication, while a session change or
logout clears it. JWT sessions use the stable issuer/subject to prevent restoring
another user's cart; public or opaque-token sessions use a device-level cart.
Credentials are never saved with the cart. If storage is unavailable, the cart
continues to work in memory. No order is submitted.
localStorage is scoped to the page origin, including its port. The current native
SuperApp starts its localhost server on a random port each launch, so persistence
across full native relaunches additionally requires a stable host origin; this
mini-app change preserves carts across reloads on the same origin.
Selecting a product shows a bottom View your Cart bar. Its badge counts selected
products, and the summary page at `#/cart` shows each product's unit and editable quantity.
Quantities and removals stay synchronized with the catalog across filters and
searches. The back button and Continue shopping link return to the product list.
Thumbnail URLs append `thumbnail.file_url` to `VITE_API_ORIGIN`, preserving any
base path. With an empty origin, relative media requests use the development proxy.
Hash routes work in static hosting and native WebViews.

## SuperApp bridge

The host injects `window.superApp`; its contract is defined in `src/types/bridge.ts`.
Keep native method names aligned with the container. Startup resolves the bridge,
sets its title and pull-to-refresh behavior, reads auth, launch parameters, and
language, subscribes to `onLanguageChanged`, and calls `ready()`.

Production bridge discovery and each startup call have a five-second timeout,
configurable in `src/config.ts`. Development bridge discovery waits only 300 ms
before starting the browser mock (`developmentBridgeTimeoutMs`).
Discovery or authentication failures show a retry screen.
Launch parameters and localization are optional: failed/unsupported calls fall back
to an empty map and the default language. Launch parameters may be an object or a
JSON object string. Empty auth tokens are allowed for public features; no token
is invented. Applications decide which features require authentication.

Use the initialized bridge and shared state in a screen:

```tsx
const bridge = useMiniAppStore((state) => state.superApp);
const params = useMiniAppStore((state) => state.initParams);
const token = useMiniAppStore((state) => state.authToken);

const result = await bridge?.scanQR();
bridge?.showToast('Saved');
```

Import `useMiniAppStore` from `src/store/miniAppStore`. Profile, launch parameter,
device, and event payloads use `unknown`; narrow them before reading app-specific
properties. Printer methods remain available in the bridge contract; feature code
should check method availability and native results on older containers.

Only mount `useSuperApp()` once, at the application root. Its session is cancelled
on unmount/retry, timers are cleared, and language listeners are detached where
the host supports unsubscribe. Callbacks from hosts without unsubscribe become
inactive after cleanup. Hosts that implement `refreshAuthToken(rejectedToken)`
also support automatic recovery from an expired access token (see below).

## Browser development

When no native bridge appears within 300 ms, the Vite development
server loads a browser mock and shows **Dev tools**. It can set a development auth
token, switch English/Khmer, inspect launch parameters and user/device information,
and exercise QR, dialogs, toasts, haptics, close, and printer actions.

Development tokens are held in memory and session storage for the current tab.
An optional `VITE_DEV_AUTH_TOKEN` is used only as the initial development value.
Storage access failures do not prevent local development. Mock printing reports
that no printer is connected. Mock launch parameters combine query parameters
from the hash and the page URL, with page query parameters taking precedence:
`/?example=value#/`.

Production builds require the native bridge. They show a connection error with
retry outside the SuperApp, and exclude the browser mock and development console.
All `vite build` modes, including `build:dev`, produce this production behavior.

## HTTP requests

Import `api`, `ApiError`, and optional types from `src/services/api/request`.
The client uses fetch and reads the current token for every request.

```ts
import { api, ApiError } from './services/api/request';

type Item = { id: number; name: string };

const items = await api.get<Item[]>('/api/items', {
  query: { page: 1, active: true, tags: ['new', 'featured'] },
});
const created = await api.post<Item>('/api/items', { name: 'Example' });
await api.put<Item>('/api/items/1', { name: 'Replaced' });
await api.patch<Item>('/api/items/1', { name: 'Updated' });
await api.delete('/api/items/1');

// Pass React Query's signal through to fetch.
const query = {
  queryKey: ['items'],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    api.get<Item[]>('/api/items', { signal }),
};

// Public requests omit the automatic bearer header.
await api.get('/api/public', { auth: false });

try {
  await api.post('/api/items', { name: '' });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.kind, error.status, error.data);
  }
}
```

Requests accept endpoint paths relative to the configured API origin; absolute
URLs are rejected. Query arrays become repeated parameters; null/undefined values
are omitted. JSON bodies receive a content type, GET requests do not, and supplied
headers can override defaults. An explicit Authorization header takes precedence.
Bodies on DELETE are supported through `api.delete(path, { body: ... })`.

Successful JSON/text responses with no body, and 204/205/HEAD responses, return
`undefined`. JSON generics describe the expected shape without runtime validation.
Errors expose `kind` (`http`, `network`, `timeout`, `aborted`, or `parse`),
`status`, `data`, `url`, `method`, and the underlying `cause`.
Server response bodies remain available for validation errors. The default timeout
is 20 seconds per resource attempt; override it with `timeoutMs` per request.
Native refresh has a separate timeout, and the replay receives a fresh resource
timeout. Timers include response body reading. AbortController handles cancellation without relying on newer
WebView `AbortSignal.any()` or `AbortSignal.timeout()` methods.

The HTTP client retries an authenticated 401 once after native token refresh.
It also recognizes Central's specific HTTP 500 wrapper for an expired SFA token
on staff-order GET reads, described below. Other server and network failures are not retried. React Query also defaults
to no retries for queries and mutations. Manual token changes and session resets
cancel and clear cached queries; token rotation preserves in-flight queries.

### Expired access tokens

When an API request returns 401, the shared client calls
`bridge.refreshAuthToken(rejectedToken)`. Concurrent requests share the refresh.
Recovery starts when the 401 headers arrive, without waiting for the error body.
The original request/query stays pending through refresh and its automatic replay;
successful recovery requires no Retry click or page reload.
Central currently wraps some SFA 401 rejections as HTTP 500 with `error: "Data failure"`.
For GET `/services/central/api/name/staff-order-*/find|list|page`, the client also
recovers when the Feign message identifies `SFAApiProxy`, upstream 401, and the
JSON error `ex.code: "authentication_failed"`, `ex.message: "Token has expired."`.
The captured staging variant `Internal microservice token has expired.` also
recovers on these reads when the rejected user access token has a numeric JWT
expiry that has passed. With a valid or opaque user token, that variant remains
a backend error; refreshing user credentials cannot be assumed to repair an
independent service credential.
This compatibility path never replays a wrapped server failure on a write.
Central should preserve the authentication status as HTTP 401 at the backend boundary.
The SuperApp sends the following form-encoded POST to its configured
`AUTH_URL` + `/mobile/auth/refresh`:

```text
grant_type=refresh_token
client_id=central_app
refresh_token=<value from native secure storage>
```

The SuperApp saves `access_token` and any rotated `refresh_token` from the response.
It uses the same configured OAuth client as native login (`central_app` by default).
Only the new access token is returned to JavaScript. The mini-app updates its
in-memory token and replays the original request once with the same body and options.
It does not store or request refresh credentials in JavaScript.

If the bridge method is missing or refresh fails/times out, the caller receives
the original API error (401 or the wrapped 500). A failed replay returns its error
body. There is no refresh loop or mini-app login redirect. Public requests using
`auth: false` and requests with their own Authorization header skip this recovery.
Cancellation still cancels that caller without cancelling a refresh shared by others.
The mini-app also listens to native `tokenRefreshed` events, including `updateToken`
pushes after the SuperApp resumes. Rotation preserves the current session and queries;
an empty native token clears the session. Disposed or replaced sessions ignore late events.

This needs the updated SuperApp SDK and native `refreshAuthToken` action. Rebuild
the SuperApp as well as the mini-app; existing installed containers without this
method retain their previous 401 behavior. The native implementation is in the
adjacent `oml-central` repository. `AUTH_URL` and refresh credentials remain native
configuration; no new mini-app environment variables are needed.

`authRefreshTimeoutMs` in `src/config.ts` bounds the bridge refresh to 120 seconds,
matching the injected SDK's authentication wait. A resource's 20-second timeout
does not expire a successful native refresh halfway through.

For a temporary staging investigation, set `VITE_AUTH_DIAGNOSTICS=true` when
running `npm run build:staging`. The `[Miniapp Auth]` console events contain a
request ID, endpoint path without query parameters, status, attempt, timings,
refresh start/result, access-token lifetime in seconds when readable, and fixed
booleans describing the recognized SFA wrapper.
They never include credentials, headers, or response bodies. A debug SuperApp
forwards these events to Android logcat. The console sink is disabled by default
and removed from production bundles even if the flag is supplied. Custom clients
can provide `onAuthDiagnostic`; a throwing listener cannot break requests.
`python3 scripts/collect-auth-diagnostics.py --serial <device> --output /tmp/auth-events.json`
collects only allowlisted events from the staging process. Raw device logs are
never saved; `--screenshot /tmp/auth-screen.png` optionally captures the screen.

`miniapp.manifest.json` tracks this sales miniapp's OTA ID and version. Packaging
includes that descriptor inside the ZIP and writes `miniapp.release.json` beside
it with the ZIP's SHA-256 hash, build mode, and diagnostic setting. These files
do not publish anything. When releasing through the existing OTA service, merge
the new version and hash into its existing manifest and retain its configured
download URL. The native launcher compares the server manifest version with the
device cache marker, so changing the ZIP alone under the same OTA version does
not update an already downloaded app.

For a separate custom client, provide a `refreshAuthToken` callback to
`createApiClient` if that client should use this recovery too. Custom clients can
also set `authRefreshTimeoutMs` independently of their resource `timeoutMs`.

See [the refresh investigation](docs/auth-refresh-investigation.md) for the traced
failure and local verification. To reproduce with the existing local fixture:

```bash
postman simulation run postman/simulations/auth-refresh.sim.yaml --port 4912 --output ndjson --no-history
# In another terminal, using Node 26 and the adjacent oml-central checkout:
node scripts/verify-auth-refresh-simulation.js
```

The verification uses the real injected JavaScript SDK and mini-app code with a
simulated native dispatcher. It does not call production or test Flutter secure storage.

### Uploads and downloads

```ts
const form = new FormData();
form.append('file', file);
await api.post('/api/uploads', form); // Browser sets the multipart boundary.

const text = await api.get('/api/export.txt', { responseType: 'text' });
const blob = await api.get('/api/export.pdf', { responseType: 'blob' });
if (blob) {
  const url = URL.createObjectURL(blob);
  // Use the URL, then call URL.revokeObjectURL(url) when finished.
}
```

For a separate backend, use `createApiClient({ baseUrl, getToken, timeoutMs })`.
It returns the same helpers without changing the shared client.

## Backend configuration

Both settings are optional and empty by default:

| Variable | Purpose |
| --- | --- |
| `VITE_API_ORIGIN` | Direct API origin or base path, used in built apps; requires backend CORS for cross-origin requests. |
| `VITE_DEV_PROXY_TARGET` | Development server proxy target for `/api`, `/services`, `/files`, `/storage`, `/central`, and `/media`. |
| `VITE_DEV_AUTH_TOKEN` | Initial development-only token; prefer entering temporary tokens in Dev tools. |

For a local proxy, leave `VITE_API_ORIGIN` empty and set
`VITE_DEV_PROXY_TARGET=https://api.example.com`. When a proxy target is configured,
the development server always uses same-origin API requests, even if a direct
`VITE_API_ORIGIN` is also present. Production builds still use `VITE_API_ORIGIN`.
Restart Vite after changing env
files. In the native container, relative requests rely on the host's backend routing.

The catalog endpoint paths include `/services/central/...`, so use the backend
root as the proxy target (for example `http://backend.example.com`), with no
additional `/services` prefix. Older
`VITE_DEV_API_BASE_URL` settings are not read; migrate them to
`VITE_DEV_PROXY_TARGET` and leave `VITE_API_ORIGIN` empty for local proxy use.

Copy the new `.env.example` rather than reusing environment files from the previous
application. The old API configuration keys are no longer used.
All `VITE_*` values are public build-time configuration. Never commit real tokens
or environment files. Production credentials come from the SuperApp bridge.

## Localization

Translations live in `assets/lang/en.json` and `assets/lang/km.json`.
Use `useTranslation().t('home.title')`; missing keys return the key itself.
Khmer locale variants normalize to `km`; other locales fall back to English.
The document language follows the shared language state and switches the app font:
English uses Inter, and Khmer uses Kantumruy Pro. Both fonts are bundled locally
and work offline, including in the SuperApp. Inter's license is included in
`public/licenses/Inter-OFL.txt` and copied into build archives.

Use `font-sans` (or inherit the body font) for automatic language-based fonts.
Use `font-inter` when an element should explicitly use Inter, with Kantumruy Pro
as the fallback for Khmer characters.

## Mobile WebView behavior

Production CSS targets the Sunmi V3's WebView 101. Tailwind's separate CSS
optimization is disabled so Vite can preserve older-WebView fallbacks such as
`height: 100vh` before `height: 100dvh`. Removing that fallback lets the whole
catalog page scroll on Sunmi, moving the header out of view. The production CSS
regression check builds in memory and verifies both declarations remain.

The starter locks page zoom, hides scrollbars, and keeps normal touch scrolling.
The layout uses dynamic viewport height and safe-area padding. Inputs remain at
least 16 px to avoid focus zoom, and editable fields keep text selection and their
native editing menus. Use the `selectable` class for other text users should copy.
Read-only labels suppress accidental text selection and long-press link/image
callouts; buttons retain keyboard focus outlines and provide pressed feedback.

The SuperApp's `SuperAppWebView` also disables native zoom controls, scroll
indicators, and overscroll effects. Rebuild the SuperApp to apply those container
settings; CSS alone cannot control the native scroll indicators. When adding a
scrollable panel, give it a constrained height and `overflow-auto`; avoid locking
all page scrolling with `overflow-hidden`.

## Check, build, and package

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

Tests use Node's test runner, Vite's TypeScript loader, fake native bridge sessions,
and a temporary local HTTP server. No external backend or credentials are needed.

The optional Postman fixture in `postman/simulations/auth-refresh.sim.yaml` checks
the refresh contract using dummy tokens. Start it with:

```bash
postman simulation run postman/simulations/auth-refresh.sim.yaml --port 4900 --no-history
```

In `../oml-central`, the native auth tests can use this stand-in over real HTTP:

```bash
flutter test --no-pub --dart-define=AUTH_SIMULATION_ORIGIN=http://127.0.0.1:4900/central test/data/network/interceptors/auth_interceptor_test.dart test/features/webview/auth_refresh_bridge_test.dart
```

The fixture is development tooling and is never included in the mini-app build.

For catalog development without the backend, run:

```bash
postman simulation run postman/simulations/product-catalog.sim.yaml --port 4901 --no-history
```

Start Vite with `VITE_API_ORIGIN` empty and
`VITE_DEV_PROXY_TARGET=http://127.0.0.1:4901`. Open `#/products` to use the
local catalog and media fixtures. Searching for `__error__` simulates a product
503 response; a search with no matches exercises the empty state. Fixture images
include missing files to exercise image fallback. The fixtures model the supplied
contract; they do not establish live backend behavior.

Both catalog endpoints return `{ count, next, previous, results }`. Categories
are sorted by `order_index`. The product service maps numeric `category` and
`default_uom` IDs plus their name fields into the objects used by the catalog
and cart, and maps the thumbnail URL string into an image reference. Missing
`qty_step` defaults to increments of one. Requests omit pagination parameters;
the app renders the returned `results` without following `next` links.

### My Sales dashboard

The home page at `#/` shows My Sales with summary cards and the three most recent
orders. Summary data comes from `/services/central/api/name/staff-order-summary/find`.
History uses `/services/central/api/name/staff-order-employee-order-history/find`
with only `page` and `page_size=20`, using the current bearer token. It does not
send `staff_code` or wait for `bridge.getUserInfo()`. See All opens `#/orders`, with
previous/next controls when the response supplies more pages. Dates use Cambodia
time, statuses retain their API meaning, and the home back button closes the
mini-app through the bridge. Confirmed order submissions invalidate the summary
and history caches. English and Khmer labels are included.

Order cards on both views open `#/orders/:orderId`, fetching
`/services/central/api/name/staff-order-detail/find?id=...`. The detail view shows
the order number/status, customer and staff information, delivery date, and
read-only product quantities with images and localized names. Nested products
use the same normalization and image fallback as the catalog. Null delivery dates
show Not scheduled. As requested, the product cards now show estimated USD values
using quantity multiplied by the current product unit price, less any supplied
line discount. Missing discounts are treated as zero for this estimate. Line
subtotals and discounts round to cents before summing; unavailable or invalid
prices leave the affected amount and total unavailable. These estimates exclude
tax and are not confirmed historical totals. VAT, KHR conversion, and attachment
sections require additional API fields. Back returns
to the source view, retaining history pagination in `#/orders?page=...`.
The detail content uses flat white cards on a light gray background: customer/status header, combined
order-number/date line, phone/salesperson/delivery rows, borderless item rows,
and subtotal/discount/total separated by dividers. Product code, quantity, and
unit price share a metadata line, with the line amount aligned on the right.

### Submit a staff order

Customer name and delivery date are optional. Phone and map-selected location
are required in the checkout UI. Blank optional values are omitted from the
order payload. The date starts empty, can be cleared after selection, and opens a bottom sheet
with native-style date wheels, momentum scrolling, and swipe-down dismissal.
Done at the bottom commits the selection. Earlier values stay visible but cannot
be selected. Past dates are rejected again at submission, including after
midnight. Time selection is disabled; dates serialize at `00:00:00+07:00`.
Location opens the full-screen `#/cart/location` route with an interactive Google
Map, center pin, My location action, and editable address. The flat street map
is the default; the layer button switches to labeled satellite imagery, and
the zoom buttons adjust the view without changing the selected point.
Reverse geocoding fills the address field with readable location text. Coordinates
remain separate from the address. While lookup is pending, the field is empty
and shows Finding address; if lookup fails, enter an address manually before
confirming. Legacy coordinate-only addresses are cleared when reopening the picker.
On first selection it
requests device location and centers the map there when permission is granted;
reopening an existing selection preserves the saved pin. Dragging the map or
tapping a point chooses that location. Only Use this location commits it; Back
discards unconfirmed changes. Checkout details remain in memory across navigation,
without adding personal information to persisted cart storage.
Product search, quantity entry, checkout, and address editing share one app-level
keyboard viewport controller. It applies changed viewport measurements once
per animation frame, then smoothly reveals the focused field after keyboard movement
settles (immediately with reduced motion). Bottom cart/checkout/location actions hide
synchronously when editing starts, before the first keyboard resize can move them.
They fade back in only after viewport recovery, including Android Back with a
still-focused input. A provisional hide expires after 500ms if no software keyboard
opens, so hardware keyboard focus cannot leave actions hidden. Tapping a field
after Android Back also hides actions before resizing without needing another focus event.
A deliberate vertical swipe in the content, a background tap, or Done/Search
dismisses editing; selection, clear buttons, category swipes, map gestures, and
programmatic scrolling do not trigger dismissal. Rotation dismisses editing and
resets viewport measurements. Screen scroll containers use `data-keyboard-scroll`;
special gesture surfaces use `data-keyboard-gesture-exempt`, and clear buttons use
`data-keep-keyboard`. Inputs retain their values and native text selection.
On iOS, a tap on an unfocused field uses `focus({preventScroll: true})` inside
the touch gesture. This avoids native whole-page panning before viewport events
arrive. Dragged or cancelled taps are ignored; already-focused fields keep native
caret placement and selection. The form reveal runs after keyboard movement settles.
Input screens lock the document body and scroll their own content. The screen
follows the visual viewport offset inside that body without forcing the whole
page into a compositing layer. Footers overlay the scroll panel
with measured bottom spacing, so hiding actions does not resize the form. Map
minimum height and scroll spacing remain stable during editing. Repeated events
with unchanged geometry do not write page styles. Closing waits for stable viewport geometry and accepts a
small safe-area change (including the 34px bottom inset observed in WKWebView),
then updates the baseline and resets only document panning, preserving form scroll.
The map surface also uses `data-no-ptr` to opt out of the host's pull-to-refresh
gesture. Map selection waits for drag/pan settling before reverse geocoding;
layout-only idle events cannot replace a manually edited address. A new drag
invalidates the preceding lookup and disables confirmation until selection settles.
On iOS the Flutter host keeps `Scaffold.resizeToAvoidBottomInset` false and
`SafeArea.maintainBottomViewPadding` true. WKWebView owns the visible keyboard
viewport while its native surface and bottom safe area remain stable throughout
the animation. Android retains Scaffold resizing and `adjustResize`. The native
host change requires a hot restart in development or a rebuilt installed iOS app,
in addition to the updated miniapp bundle; an OTA ZIP cannot change that policy.
`scripts/check-keyboard.test.js` covers viewport recovery, field switching, gesture
dismissal, iOS tap focusing, rotation, and cleanup with a deterministic DOM/clock fixture. Confirm
animation quality on the installed WebView as well as with browser simulation.
The optional native test in `scripts/ios-keyboard/` uses a real iOS keyboard and
WKWebView with local catalog/map fixtures. It tests taps on phone, customer,
quantity, search, and address inputs in both overlay and resizing hosts, including
repeated dismissal, physical input visibility, footer recovery, and retained text.
Every editing animation frame is sampled to assert that the cart and submit actions
never become visible between focus and keyboard dismissal.
The overlay scenario also asserts that native WebView frame changes stay at zero
through every opening and closing cycle. The Flutter host regression separately
checks intermediate keyboard insets and bottom safe-area consumption.
On macOS with Xcode, an installed iPhone simulator, and Ruby's `xcodeproj` gem:

```bash
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
# In another terminal, with an iPhone simulator booted:
ruby scripts/ios-keyboard/create-project.rb /private/tmp/miniapp-ios-keyboard
xcodebuild -project /private/tmp/miniapp-ios-keyboard/Keyboard.xcodeproj \
  -scheme KeyboardHost -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath /private/tmp/miniapp-ios-keyboard/build \
  -parallel-testing-enabled NO test
```

The generated test app is separate from the Flutter host and does not contact
the live order or Maps services. It validates native keyboard behavior, while
the installed host still needs the freshly versioned OTA bundle to receive fixes.

Province/City, District/Khan, Commune/Sangkat, and Village appear below the address.
They use typed address components across the reverse-geocoding results, with
explicit administrative levels preferred over numbered sublocality levels.
Missing components show Not available; street text, business names, and nearby
neighborhoods are not used to guess village names. Confirmed components remain
in the in-memory draft with their pin. Order submissions use the formatted address
string; changing the pin or session clears stale administrative details.
Submit order posts JSON to
`/services/central/api/name/staff-order-save/exec`, using the same gateway and
bearer token as the catalog. Each cart item sends `product_code` from
`internal_code`, its numeric `quantity`, and numeric `unit_price`.
The existing customer/phone/email/address/items fields are preserved, with
`delivery_date` (ISO datetime), `latitude`, and `longitude` (JSON numbers) added
when supplied. The lower-level payload builder remains compatible with earlier
callers that omit the new fields and rejects invalid dates/coordinate pairs.

Set `VITE_GOOGLE_MAPS_API_KEY` in the relevant local environment file, restart
Vite for development, and rebuild for the native container. Configure the key
separately in `.env.prod` for the default `npm run build`; `.env.dev` is
only loaded for development mode. Packaging rejects a missing or empty Maps
key so an unusable location screen cannot silently ship. Enable the Maps
JavaScript API and Geocoding API for the key's project and restrict the browser
key to the app's origins/APIs. The Google SDK loads only when opening the map;
no app bearer token is sent to Google. Missing or rejected Maps SDK configuration
leaves the map picker unavailable and prevents confirming a location. Address
lookup failures, including a denied Geocoding API request, keep the map and pin
available and show an address-lookup message; they never substitute coordinates
for an address. A denied lookup gets a separate message, and the browser console
records the provider status without the key or coordinates. Enter a readable
address manually to continue. Lookups time out after ten seconds; late responses
cannot overwrite a manually entered address, and editing the address does not
cancel administrative-detail lookup. Confirmation waits for lookup to finish so
the resolved details stay with the selected pin. Device
location failures also leave manual pin selection available. Browser geolocation
requires a secure context and permission; the native container must grant access
to device location. See Google's
[loading/setup documentation](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
and [Geocoding service documentation](https://developers.google.com/maps/documentation/javascript/geocoding).
On Android, the Flutter host must enable WebView geolocation and register
`AndroidWebViewController.setGeolocationPermissionsPromptCallbacks` before
loading the miniapp. Without this callback, the plugin denies browser geolocation
even when the Android manifest declares location permissions. The sibling
`oml-central` host now requests native permission through `LocationService` and
grants WebView access only for the loaded miniapp's origin. Grants and denials
are not retained, so My location can retry after a permission change. Restart
or rebuild the Flutter host to pick up this fix; repackaging this miniapp alone
does not update the native WebView. Installed-device behavior still needs
verification with the updated host and location permission granted.
The key is intentionally empty in `.env.example`. The configured production
bundle was checked against live Google Maps on localhost: map rendering and
pin display succeeded, while Geocoding returned `REQUEST_DENIED`. Check the
Geocoding API and key permissions in Google Cloud for automatic address lookup;
manual address entry remains available. Installed WebView permissions still
need device verification.
In Google Cloud, enable Geocoding API on the key's project and include Geocoding
API in that key's allowed APIs. Enabling the API and allowing it for the key are
separate settings; see [Google's setup steps](https://developers.google.com/maps/documentation/geocoding/guides-v3/get-api-key).

`saveOrder(payload, signal?)` in `src/services/api/order.ts` also accepts
optional `product_id` and `product_name` on items. `buildOrderPayload` builds
the request from customer details and cart selections. The response must have
`status: "success"` and a positive integer `data.id`. Confirmation opens an
Order Submitted modal with a green checkmark and a waiting-confirmation message.
View Order opens the detail route for the returned ID; Create New PO opens the
product catalog with the cleared cart. The native dialog handles modal focus,
and Escape dismisses it. It does not reopen when returning to the empty cart.
Failed or unconfirmed submissions preserve the cart and do not show the modal.
Submitting locks quantities and additional submissions until the request finishes.
Session changes prevent late confirmations from clearing another user's cart.

The local Postman catalog fixture models the supplied success response. Use
customer `__error__` for HTTP 503 or `__rejected__` for HTTP 200 with
`status: "error"`. These fixture orders never reach the real backend.
The simulation also includes a `maps` member for local SDK/geocoding checks.
Its `/sdk.js?origin=http://127.0.0.1:4910/maps` and `/geocode` routes model the
documented JavaScript map/geocoder interface for browser interception tests;
they are clearly labeled local fixtures, not live Google map tiles or addresses.
The production application always loads Google's actual SDK.

`npm run build` checks types, builds to `dist/`, and creates a real `miniapp.zip`
with `index.html` at its root. Relative asset paths allow loading from the SuperApp
container. The archive is recreated each time, so stale assets are not retained.

Environment modes remain available:

| Development server | Production build | Optional env file |
| --- | --- | --- |
| `npm run dev` | `npm run build:dev` | `.env.dev` |
| `npm run staging` | `npm run build:staging` | `.env.staging` |
| `npm run prod` | `npm run build:prod` | `.env.prod` |

`npm run zip` repackages an existing `dist/`. Build outputs, archives, and local
environment files are ignored by Git. Native QR, printing, authentication, and
container lifecycle behavior still require verification inside the real SuperApp.
