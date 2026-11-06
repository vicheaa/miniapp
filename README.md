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
is 20 seconds; override it with `timeoutMs` per request. Timers include response
body reading. AbortController handles cancellation without relying on newer
WebView `AbortSignal.any()` or `AbortSignal.timeout()` methods.

The HTTP client retries an authenticated 401 once after native token refresh.
Network failures and other HTTP errors are not retried. React Query also defaults
to no retries for queries and mutations. Manual token changes and session resets
cancel and clear cached queries; token rotation preserves in-flight queries.

### Expired access tokens

When an API request returns 401, the shared client calls
`bridge.refreshAuthToken(rejectedToken)`. Concurrent requests share the refresh.
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

If the bridge method is missing, refresh fails/times out, or the replay also returns
401, the caller receives a 401. A refresh failure preserves the original API error
body. There is no refresh loop or mini-app login redirect. Public requests using
`auth: false` and requests with their own Authorization header skip this recovery.
Cancellation still cancels that caller without cancelling a refresh shared by others.

This needs the updated SuperApp SDK and native `refreshAuthToken` action. Rebuild
the SuperApp as well as the mini-app; existing installed containers without this
method retain their previous 401 behavior. The native implementation is in the
adjacent `oml-central` repository. `AUTH_URL` and refresh credentials remain native
configuration; no new mini-app environment variables are needed.

`authRefreshTimeoutMs` in `src/config.ts` bounds the bridge refresh to 10 seconds.
For a separate custom client, provide a `refreshAuthToken` callback to
`createApiClient` if that client should use this recovery too.

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
| `VITE_DEV_PROXY_TARGET` | Development server proxy target for `/api`, `/services`, `/files`, and `/storage`. |
| `VITE_DEV_AUTH_TOKEN` | Initial development-only token; prefer entering temporary tokens in Dev tools. |

For a local proxy, leave `VITE_API_ORIGIN` empty and set
`VITE_DEV_PROXY_TARGET=https://api.example.com`. Restart Vite after changing env
files. In the native container, relative requests rely on the host's backend routing.

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
