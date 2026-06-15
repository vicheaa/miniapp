/**
 * SuperApp Bridge SDK contract.
 *
 * When running inside the Flutter SuperApp, the native container injects
 * `window.superApp` which implements this interface.  During standalone
 * development a mock implementation is used instead (see services/bridge/).
 */
export interface SuperAppBridge {
  /** Retrieve the current user's authentication token. */
  getAuthToken(): Promise<string>;

  /** Get basic profile information about the logged-in user. */
  getUserInfo(): Promise<any>;

  /** Open the native QR-code scanner. */
  scanQR(): Promise<{ success: boolean; code?: string; error?: string }>;

  /** Show a native confirmation dialog. */
  showDialog(opts: { title?: string; message?: string }): Promise<{ confirmed: boolean }>;

  /** Display a short toast notification. */
  showToast(message: string, duration?: number): void;

  /** Request the SuperApp to close this mini-app. */
  close(): void;

  /** Update the native header title. */
  setTitle(title: string): void;

  /** Trigger haptic feedback on the device. */
  hapticFeedback(type?: string): void;

  /** Retrieve device platform & OS information. */
  getDeviceInfo(): Promise<any>;

  /** Retrieve current app localization/language. */
  getLocalization(): Promise<{ localization: string; language: string }>;

  /** Signal that the mini-app has finished initialising. */
  ready(): void;

  /** Check whether the bridge is available. */
  isAvailable(): boolean;

  /** Open a URL in the browser or native webview. */
  openUrl(url: string): void;

  /** Subscribe to events from the SuperApp. */
  on(event: string, cb: (data: any) => void): void;
}

/* ── Global augmentation ───────────────────────────────────────────────── */

declare global {
  interface Window {
    superApp?: SuperAppBridge;
  }
}

// Required so TS treats this as a module rather than a script.
export {};
