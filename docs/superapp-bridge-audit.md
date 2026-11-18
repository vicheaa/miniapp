# SuperApp bridge audit

Reviewed on 18 November 2026 against the local `miniapp` and `oml-central` source trees. This is a source audit, not verification of the version installed on a device. No bridge behavior was changed during this audit.

## Why native updates have been needed

A miniapp can change screens, business rules, pagination, and backend requests without adding a native bridge action. A host update is needed when the miniapp needs a native capability that the installed SuperApp does not implement, or an existing implementation needs a fix.

The phone feature exposed an incomplete existing capability: `openUrl` was declared and dispatched, but its native handler only logged the URL. The earlier fix launches the system handler and makes the SDK await its result. That implementation supports `http`, `https`, `tel`, `mailto`, and `sms`; supported links still depend on apps installed on the device.

There are several copies of the bridge contract: injected JavaScript in Dart, standalone JavaScript, the npm TypeScript SDK, and the miniapp's local TypeScript interface. They do not fully agree. SDK version strings remain `1.0.0` despite behavior changes, and miniapps cannot query native supported actions.

## Existing contract gaps

| Priority | Capability | Evidence in current source | Required work |
| --- | --- | --- | --- |
| High | Capability discovery | `BridgeRegistry.registeredActions` exists internally, but there is no `getCapabilities` or `supportsAction` bridge method. `isAvailable` only checks that the transport channel exists. | Expose the actual registered actions, capability versions, host app version, and platform; use them to decide which miniapp features to enable. |
| High | Printing | `miniapp/src/types/bridge.ts` declares `openPrinterSettings` and `printText`, and the browser mock implements previews. The host SDK and native registry have no matching implementations. | Implement a printer plugin if printing is required; otherwise make these unsupported methods optional in the miniapp contract. |
| High | QR scanning | `_handleScanQRCode` opens `CustomCameraScreen` through `Navigator.push<String>`. That screen takes photographs and returns `XFile`; it does not decode QR codes. | Connect `scanQR` to a QR/barcode scanner and return decoded text, cancellation, or a structured error. |
| High | Native location API | Native `getLocation` exists, but typed SDKs have no `getLocation` method. Dispatch invokes the async handler without awaiting it; its errors can escape the registry's error response. The handler has no explicit permission request flow. | Expose a typed method, await the handler, define options/results, and handle permission, timeout, and cancellation. Browser geolocation is separately supported by the WebView. |
| Medium | Dialog cancellation | `showDialog` resolves only from its explicit buttons. The returned Flutter dialog future is ignored, so dismissing by tapping outside or using Back can leave the SDK promise pending until timeout. | Resolve every dismissal path consistently, including cancellation. |
| Medium | Title updates | `setTitle` sends `__set_title__` to JavaScript. The injected SDK ignores that event, and the WebView renders no native AppBar. | Implement a visible title behavior if required, or document/remove this advertised behavior. |
| Medium | Native navigation | `navigate` calls `Navigator.pushNamed`, while the application uses `MaterialApp.router` and GoRouter. | Align the handler with the actual router and define route parameters and result semantics. This mismatch needs runtime verification. |
| Medium | Contract and event consistency | The SDK exposes `off`, `invoke`, `navigate`, and `version`, while the miniapp interface omits them. The miniapp interface allows an unsubscribe return from `on`, but native SDK `on` returns void; `off` must be called separately. | Generate all SDK variants and local types from a shared definition. Define event cleanup consistently. |
| Medium | Errors and pending requests | Native failures use message strings. Some parsing failures only log; generic invocations of fire-and-forget actions have no reply. SDK timeouts are fixed at 30 seconds except auth. | Use error codes such as `UNSUPPORTED`, `CANCELLED`, and `PERMISSION_DENIED`; validate input and specify which actions are request/response versus notifications. |

## Additional reusable capabilities to consider

These capabilities are absent from the reviewed bridge. Their absence is not automatically a bug or a requirement to implement all of them. Some can use browser APIs where those work reliably.

| Capability | Proposed API shape | Example use |
| --- | --- | --- |
| Photos and attachments | `takePhoto`, `pickImages`, `pickFile` | Delivery proof, order attachments, receipts. Native widgets elsewhere in the host do not make these available to miniapps. |
| Sharing and exported files | `shareText`, `shareFile`, `saveFile`, `openFile` | Share an order, export a PDF, save a document. |
| Durable miniapp storage | Scoped `storage.get/set/remove`, or a stable WebView origin | Preserve drafts across full host relaunches. The current local server binds port `0`, producing a new origin when its port changes; browser localStorage is tied to that origin. |
| Permission status and recovery | `permissions.getStatus/request`, `openAppSettings` | Camera or location permission was denied. Existing individual permission flows do not expose a general miniapp API. |
| App lifecycle events | `appResumed`, `appPaused` | Refresh order data after returning from the phone app. The host observes lifecycle internally and refreshes auth, but does not emit general lifecycle events to miniapps. |
| Connectivity status/events | `network.getStatus`, `networkChanged` | Retry pending reads when a connection returns. Evaluate browser events before adding native support. |
| Native clipboard fallback | `clipboard.writeText` | Copy order references when WebView clipboard APIs fail. The miniapp already has browser Clipboard API and execCommand fallbacks. |
| Additional app links | Capability-controlled support for approved custom URL schemes | Open another installed business app. Current `openUrl` accepts only the five schemes listed above. |

## Suggested implementation order

1. Add capability discovery and release/version information so miniapps can handle older installed hosts.
2. Consolidate SDK/type generation and fix QR, location, dialog cancellation, title behavior, and navigation.
3. Add printing, attachments, sharing, and durable storage according to actual product requirements.
4. Add native integration tests for each advertised method, including success, cancellation, unsupported devices, and errors.

Existing `invoke(action, data)` is a transport convenience: it can call registered native handlers, but cannot create a missing native implementation.

## Source locations

- Native methods: `../oml-central/lib/features/webview/bridge/plugins/core_bridge_plugin.dart`
- Native action registry: `../oml-central/lib/features/webview/bridge/bridge_registry.dart`
- Injected SDK: `../oml-central/lib/features/webview/bridge/sdk/bridge_sdk_source.dart`
- Standalone SDK: `../oml-central/lib/features/webview/bridge/sdk/superapp_bridge.js`
- npm SDK: `../oml-central/miniapp-sdk/src/index.ts` and `types.ts`
- Miniapp contract and mock: `src/types/bridge.ts`, `src/services/bridge/mock-bridge.ts`
- WebView events and dispatch: `../oml-central/lib/features/webview/presentation/super_app_webview.dart`
- Photo screen used by QR handler: `../oml-central/lib/core/widgets/custom_camera_screen.dart`
- Router: `../oml-central/lib/core/router/app_router.dart`
- Local origin allocation: `../oml-central/lib/core/services/local_server_service.dart`
