/** Bound native promises without relying on WebView AbortSignal.timeout/any support. */
export function withTimeout<T>(
  operation: () => T | PromiseLike<T>,
  timeoutMs: number,
  signal: AbortSignal,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    };
    const finish = (error: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error !== undefined) reject(error);
      else resolve(value as T);
    };
    const onAbort = () => finish(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(new Error(`${label} timed out. Please try again.`)), timeoutMs);
    Promise.resolve().then(() => {
      if (signal.aborted) throw signal.reason;
      return operation();
    }).then((value) => finish(undefined, value), (error) => finish(error ?? new Error(`${label} failed.`)));
  });
}
