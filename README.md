# Example Mini App (Vite + React + TypeScript)

A complete working example of a mini app that runs inside the OML Central super app.

## Development

```bash
npm install
npm run dev
```

> When running locally in the browser, the bridge will not be available.
> The app shows a "Waiting for SuperApp Bridge..." message until
> it detects `window.superApp`.

## Build & Deploy

### 1. Build the production bundle

```bash
npm run build
```

This creates a `dist/` folder with all static files.

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
