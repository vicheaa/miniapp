// Some embedded/private WebViews deny storage or run out of quota. Keep the
// session usable even when preferences cannot be persisted to the device.
const memory = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    if (memory.has(key)) return memory.get(key)!;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The in-memory value remains available for this session.
    }
  },
  removeItem(key: string): void {
    memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage may be unavailable for the lifetime of this WebView.
    }
  },
};
