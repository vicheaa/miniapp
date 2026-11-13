/** Shared across routes so a second tap cannot activate the next page's back/exit button. */
export function createNavigationGuard(now = () => performance.now()) {
  let blockedUntil = -Infinity;
  let closing = false;

  return {
    run(action: () => void, close = false): boolean {
      if (closing || now() < blockedUntil) return false;
      blockedUntil = now() + 500;
      closing = close;
      try {
        action();
        return true;
      } catch (error) {
        blockedUntil = -Infinity;
        closing = false;
        throw error;
      }
    },
  };
}
