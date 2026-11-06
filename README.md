# Example Mini App (Vite + React + TypeScript)

A complete working example of a mini app that runs inside the OML Central super app.

## Development

```bash
npm ci
npm run dev
```

Standalone development uses a mock bridge after 500 ms. Production waits up to
15 seconds for the native bridge and shows a retry message if it is unavailable;
production never substitutes a mock authentication token.

## Older Android and iPhone compatibility

The build targets **iOS/Safari 14.5+** and **Android System WebView/Chrome 88+**.
These are engineering targets, not a claim that every phone has been tested.
Android's OS version alone does not determine its WebView version. The Super
App must also support the device and inject its native authentication bridge.
Devices below these targets may work partially but are not covered by this build.

- Tailwind 3 generates CSS without requiring cascade layers, `@property`, modern
  color functions, or native CSS nesting. Preserve this constraint when upgrading.
- Core-js loads before application dependencies to supply missing JavaScript APIs.
- PDF rendering loads only when opened; its worker uses the same syntax target,
  and canvas memory is bounded for older phones.
- PDF character maps, standard fonts, and image decoders ship inside the ZIP.
  Android draws PDF text as glyph outlines to avoid native WebView font-loading
  failures; this can cost more rendering time on text-heavy pages.
- The PDF worker loads its own `ArrayBuffer.transferToFixedLength` shim. The
  legacy PDF.js bundle uses this API for fonts but does not supply it; without
  the shim, older WebViews can display the logo and silently omit all text.
- Denied/full device storage falls back to session memory. Preferences might not
  survive closing the miniapp on those devices.
- Native sign-in and optional settings calls have timeouts and recoverable errors.
  A manual “Load more” button remains available without IntersectionObserver.

Run before releasing:

```bash
npx playwright install webkit
npm run test:compatibility
```

The tests use installed Google Chrome and Playwright WebKit with phone screen
sizes and newer APIs deliberately removed. They verify startup, blocked storage,
slow/missing native injection, missing/hung optional SDK methods, authentication
failure, menu styling, and visible PDF text/graphics with standard fonts,
embedded fonts, character maps, and both native and fallback workers. Android
PDF tests also simulate a native font renderer that paints no text and missing
buffer-transfer APIs in both the page and worker. They do **not** emulate an old OS engine or native
Super App. Also test the ZIP inside the actual Super App on an older iPhone and
an older/low-memory Android, including login, filters, scrolling, task actions,
PDFs, language changes and rotation. Safari/WebView-specific behavior and native
container support require those device checks.

Every build checks the generated JavaScript and CSS for known older-browser
incompatibilities and verifies that PDF code is excluded from startup imports.

## Build & Deploy

### 1. Build the production bundle

```bash
npm run build
```

This checks TypeScript and browser compatibility, creates `dist/`, and updates
`example-miniapp.zip`. Upload that generated package after device validation.

### 2. Zip it for deployment

**macOS/Linux:**
```bash
cd dist
zip -r ../example-miniapp.zip .
```

**Windows (PowerShell):**
```powershell
Compress-Archive -Path dist\* -DestinationPath example-miniapp.zip
```

### 3. Upload to the mini app registry

Upload `example-miniapp.zip` to your backend's `/v1/miniapps` endpoint.
The OML Central app will:
1. Download the zip
2. Extract it to the device filesystem
3. Serve it via a local HTTP server
4. Auto-inject the bridge SDK
5. Proxy `/api/*` requests to your backend

### 4. For local testing (sideloading)

You can also place the `dist/` contents directly into the Flutter project's
`assets/miniapps/<app-id>/` folder and reference it with `miniAppId`.

## What This Example Demonstrates

- ✅ Getting the JWT auth token (`superApp.getAuthToken()`)
- ✅ Getting user info (`superApp.getUserInfo()`)
- ✅ QR code scanning (`superApp.scanQR()`)
- ✅ Native dialogs (`superApp.showDialog()`)
- ✅ Native toasts (`superApp.showToast()`)
- ✅ Haptic feedback (`superApp.hapticFeedback()`)
- ✅ Device info (`superApp.getDeviceInfo()`)
- ✅ API proxy calls (`fetch('/api/...')`)
- ✅ Closing the mini app (`superApp.close()`)
