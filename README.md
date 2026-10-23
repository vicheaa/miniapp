# POS Apps Mini App

A React + TypeScript + Vite mini app that lists POS Apps from `/api/admin/pos-apps`.
Includes the native bridge, standalone mock bridge, authentication state, English/Khmer
localization, hash routing, React Query, Zustand, and shared Tailwind/shadcn UI components.

## Start a project

Create a new branch from this boilerplate branch, then:

```bash
nvm use
npm ci
cp .env.example .env.dev
npm run dev
```

Use Node 24 as specified in `.nvmrc`. Update the package name, the title in
`index.html` and `src/App.tsx`, and the starter translations for each new project.

## Project structure

- `src/pages/HomePage.tsx`: POS Apps table, current-page search, pagination, and record details.
- `src/services/api/pos-apps.ts`: authenticated, cancellable API client with a 20-second timeout.
- `src/router/index.tsx`: hash routes, suitable for native WebViews and static hosting.
- `src/services/bridge/`: native bridge detection and browser mock implementation.
- `src/types/bridge.ts`: the contract for the injected `window.superApp` SDK.
- `src/store/miniAppStore.ts`: bridge, auth token, generic launch parameters, and language.
- `src/services/api-header.ts`: JSON and bearer-token headers for future API calls.
- `src/hooks/`: bridge resolution, translation lookup, and debounce helpers.
- `src/components/ui/`: shared components and a local development bridge console.
- `assets/lang/`: English and Khmer translations; use `useTranslation().t('home.title')`.
- `src/styles/index.css`: shared theme, typography, and animation styles.

## Bridge behavior

The app uses `window.superApp` when injected by the native container. If no bridge
appears within 500 ms, it uses a browser mock. Startup loads the auth token, launch
parameters, and language, then signals `ready()`. Language events update the store.
The starter page can render without an auth token; add authentication requirements
where your future app needs them.

The browser mock returns URL query parameters as generic launch parameters.
For example, `/?example=value#/` makes `initParams.example` available in the store.

During `npm run dev`, the **Dev Mode** console lets you save a local fallback token,
toggle English/Khmer, and try QR scanning, dialogs, toasts, and closing the app.
The console and local token overrides are disabled in production builds. Mock actions
use browser dialogs or console output; native actions require the SuperApp container.

## Backend configuration

Set `VITE_API_BASE_URL=https://demo-pos.vietips.com` in `.env.dev` to proxy
`/api`, `/services`, and `/files` during development. Existing environment files
must be updated separately; restart Vite after changing them. Authentication comes
from the native bridge or the local **Dev Mode** token field.

In the native container, configure backend routing in the host application.
For standalone deployments without a host proxy, set `VITE_POS_API_BASE_URL` to
the backend origin at build time; that backend must allow browser CORS requests.
The API client appends `/api/admin/pos-apps?page=…` to this origin.

Search filters names and app keys on the current page because only the paginated
GET contract is supplied. The eye button opens details from that response.
Add, edit, and delete actions are disabled until their contracts are available.
The cart icon opens the POS terminal at `#/pos-apps/<id>/pos`.

`VITE_*` values are embedded in client bundles. Use `VITE_DEV_AUTH_TOKEN` only for
local testing; keep real tokens and environment files out of Git.

## Check and build

```bash
npm run typecheck
npm run build
```

The build checks TypeScript, emits static files to `dist/`, and creates `miniapp.zip`.
Both outputs are ignored by Git. Build modes are also available:

```bash
npm run build:dev
npm run build:staging
npm run build:prod
npm run preview
```

Set mode-specific configuration in `.env.dev`, `.env.staging`, or `.env.prod`.
`npm run zip` repackages an existing `dist/` using the system `tar` command.
Upload `miniapp.zip` to your mini app registry, or copy `dist/` into the native
container's mini app assets for sideload testing.

## Local API verification

The Postman fixture uses the supplied sample response. It is separate from the
application; the page never substitutes fixture data when the real API fails.
No owner-workspace mock lookup was performed; this local fixture follows the
response supplied in the task and assumes only GET with a `page` query parameter.

With Postman CLI 1.70+ installed, run these in separate terminals:

```bash
postman simulation run postman/simulations/pos-apps.sim.yaml --port 4900 --output ndjson
npm run check:pos
```

The check runs the actual API client over HTTP for successful, empty, unauthorized,
forbidden, server-error, and malformed responses, then renders the page with the
sample records using React's server renderer. It also verifies request cancellation.
It does not verify live credentials, browser interactions, or the native container.
To preview the page with fixture data locally:

```bash
VITE_API_BASE_URL=http://127.0.0.1:4900/pos npm run dev
```

## POS terminal

The terminal requests the selected app from `GET /api/admin/pos-apps/{id}`
(the detail endpoint inferred from the supplied app response), alongside:

- `GET /api/admin/products?paginate=false`
- `GET /api/admin/categories?paginate=false&is_active=true`
- `GET /api/admin/exchange-rates`

It displays active products, category counts, and available variants. Product
prices use their own currency and the selected app's primary/secondary currencies;
active exchange rates apply their declared multiply/divide operation. Order totals
are converted before rounding. Missing rates prevent adding/reviewing affected items.

Product images use their absolute URL or `/storage/<image>` for relative paths.
The Vite proxy includes `/storage`; set `VITE_POS_ASSET_BASE_URL` if your asset origin
differs. Missing images show a coffee placeholder.

Draft tabs, variant choices, quantities, notes, and order-source selection work
locally in memory. Drafts reset on refresh, leaving the terminal, or changing registers.
Review opens the checkout form; **Complete cash sale** submits to
`POST /api/admin/orders`. Discounts and order history still need their API contracts.

The local Postman catalog fixture contains the eight complete products recovered
from the supplied truncated attachment, its three categories, the supplied rates,
and the app's twelve order sources. The second register detail fixture is an
explicit test assumption based on its list record, with no sources.
It is never used as fallback production data. With the simulation running:

```bash
npm run check:terminal
```

This checks terminal HTTP calls, currency conversion, missing rates, order totals,
product image paths, and rendering from the fixture. For a preview with live product
images and fixture catalog data:

```bash
VITE_API_BASE_URL=http://127.0.0.1:4900/pos VITE_POS_ASSET_BASE_URL=https://demo-pos.vietips.com npm run dev
```

## Create an order

Add products, open **Review Order**, enter customer details and optional item notes,
then select **Complete cash sale**. The request uses the selected register's merchant
and app IDs, uppercase currencies, the active exchange rate, the secondary total,
and selected product/variant IDs. Unit prices retain full conversion precision;
display rounding is not sent as the item price. It sends `completed`, `paid`, and
`cash`, matching the supplied contract.

Customer ID is entered manually until a customer lookup API is supplied. Blank
optional customer fields and notes are sent as `null`. The order note is retained;
a selected order source is included as `Order source: <name>` in `notes` because
no order-source field was supplied in the create-order contract.

Submission disables repeat clicks and modal dismissal. Errors preserve the cart
and checkout fields. Requests are not automatically retried; a timeout or server
failure asks the cashier to check their orders before trying again, since the
server may already have saved the sale. After a successful HTTP response, the
submitted draft is removed and a fresh empty order opens; other drafts remain.
The response body is optional, with an order ID shown if returned at `data.id`
or `id`. Live order creation has not been exercised by the local verification.

With the local simulation running:

```bash
npm run check:orders
```

This compares the payload to the supplied example and tests successful POSTs and
401/422/500 responses. The mock's success body (`201` with `data.id`) is a local
assumption because no create-order response was provided. No real sales are made.

## Receipt printing

After a successful order POST, the terminal sends a plain-text receipt through
`superApp.printText(text, true)`; `true` requests a paper cut. It includes the
merchant/register, saved order ID when available, customer, quantities, variants,
item/order notes, cash/paid status, and totals in both configured currencies.
Receipt text uses a 48-column layout for Rongta 80 mm paper (72 mm printable width), formats riel amounts as KHR before aligning totals, and removes printer control characters from
user-entered text. Native printer encoding/font support determines Khmer output.

The printer button in the terminal header and **Printer settings** in the saved
order dialog call `superApp.openPrinterSettings()`. A failed print leaves the sale
saved and offers **Retry printing**; it never sends another order POST. The receipt
can be viewed in the dialog. **Done** dismisses this receipt; receipt history and
cross-session reprinting are not implemented. An older host without these methods
shows an unavailable message rather than treating the sale as failed.

The browser mock logs the receipt and explicitly reports preview-only printing.
`npm run check:receipts` checks receipt formatting and bridge calls without native
hardware. Local browser checks also cover print-after-success, no printing for API
failures, one automatic job under React StrictMode, and retrying printing without
reposting the order. Physical printer output still requires testing in the mobile app.
