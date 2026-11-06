# Start a new mini-app

This starter already handles the SuperApp bridge, auth token, HTTP requests,
routing, and English/Khmer language switching. Start by adding your app's screens
and features.

## 1. Run the starter

Create your app branch from `dev/boilerplate`, or copy the starter into a new
repository. Run these commands from the project folder:

```bash
nvm install
nvm use
npm ci
cp .env.example .env.dev
npm run dev
```

Open the URL printed by Vite. Node 26 LTS is required.

In a browser, the starter uses a mock bridge after a short 300 ms wait. Open
**Dev tools** to enter a development token, switch languages, or try bridge actions.
You can start building the UI without connecting a backend.

## 2. Make it your app

Change the title in `src/config.ts`. This also updates the browser and native
header titles. Rename the package in `package.json`, then run
`npm install --package-lock-only` to update the lockfile.

| What you want to change | Where to work |
| --- | --- |
| First screen | `src/pages/HomePage.tsx` |
| More screens and routes | `src/pages/` and `src/router/index.tsx` |
| Reusable UI | `src/components/` |
| Backend calls | `src/services/api/` |
| English and Khmer text | `assets/lang/en.json` and `assets/lang/km.json` |
| App title and timeouts | `src/config.ts` |

Use Tailwind classes for styling. To add another screen, import it in the router
and add a `<Route path="/items" element={<ItemsPage />} />` before the `*` route.
Use React Router's `<Link to="/items">` for navigation; the app handles hash URLs.

Mobile defaults already prevent page zoom and hide scrollbars without disabling
touch scrolling. Inputs stay editable; use `className="selectable"` on other text
that should support copying. Keep the existing safe-area padding and use
`overflow-auto` for panels that need their own scrolling.

## 3. Connect your backend

For local development, edit `.env.dev`:

```dotenv
VITE_API_ORIGIN=
VITE_DEV_PROXY_TARGET=https://your-backend.example.com
```

Restart Vite. Requests starting with `/api`, `/services`, `/files`, or `/storage`
will use this proxy. If the backend requires auth, enter a temporary token in
**Dev tools**. Keep real tokens out of Git.

Use the shared `api` client so auth headers, errors, cancellation, and timeouts
are handled for you. For example, create `src/services/api/items.ts`:

```ts
import { api } from '@/services/api/request';

export type Item = { id: number; name: string };

export async function getItems(signal?: AbortSignal): Promise<Item[]> {
  return (await api.get<Item[]>('/api/items', { signal })) ?? [];
}
```

`/api/items` is an example: replace it and the response type with your backend's
actual contract. Load the data inside a page with React Query:

```tsx
import { useQuery } from '@tanstack/react-query';
import { getItems } from '@/services/api/items';

// Inside your page component:
const items = useQuery({
  queryKey: ['items'],
  queryFn: ({ signal }) => getItems(signal),
});
```

Render loading, error, and empty states before showing `items.data`. For writes,
use `api.post`, `api.put`, `api.patch`, or `api.delete`. Successful responses with
no body return `undefined`; failed requests throw `ApiError`. An authenticated 401
can retry once after the SuperApp refreshes the token; other failures do not retry.
See [the HTTP reference](README.md#http-requests) for examples,
including uploads and downloads.

For production, relative requests use the SuperApp's backend routing. Set
`VITE_API_ORIGIN` in `.env.prod` only when you need a direct backend origin;
cross-origin backends must allow CORS. Development proxy settings do not apply
to built apps.

## 4. Use the SuperApp bridge and translations

Read the initialized bridge from the store inside your component:

```tsx
import { useMiniAppStore } from '@/store/miniAppStore';

const bridge = useMiniAppStore((state) => state.superApp);
const initParams = useMiniAppStore((state) => state.initParams);

// In an event handler:
bridge?.showToast('Saved');
// QR scanning is also available: await bridge?.scanQR().
```

Startup already loads auth, launch parameters, and language, and calls `ready()`.
Reuse this state; keep `useSuperApp()` mounted only in the app root.

Expired access tokens recover through the native `refreshAuthToken` bridge method.
Refresh credentials stay inside the SuperApp. Deploy the updated SuperApp along
with the mini-app to enable this; failed refreshes still return the API's 401.

For UI text, add the same key to both translation files, then use it in a component:

```tsx
import { useTranslation } from '@/hooks/useTranslation';

const { t } = useTranslation();
// Render: <h1>{t('home.title')}</h1>
```

Language changes from the SuperApp update the UI automatically. English uses
Inter; Khmer (`km`) uses Kantumruy Pro. Both fonts work offline.

## 5. Check and deliver

```bash
npm run typecheck
npm test
npm run build
```

The build creates `dist/` and `miniapp.zip`. Packaging needs the system `zip`
command. Give `miniapp.zip` to the team managing mini-app deployment, and verify
your features inside the SuperApp, especially auth, QR scanning, and printing.

Use `npm run dev` for browser development. Built apps, including `npm run preview`,
require the SuperApp bridge and show a connection error in a regular browser.

For more detail, see the [README](README.md).
