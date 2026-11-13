/** Customize these settings when starting a new mini-app. */
export const appConfig = {
  title: 'Mini App',
  defaultLanguage: 'en' as const,
  bridgeTimeoutMs: 5_000,
  developmentBridgeTimeoutMs: 0,
  requestTimeoutMs: 20_000,
  // Native HTTP can take 30 seconds per phase; allow the SDK's full auth wait.
  authRefreshTimeoutMs: 120_000,
  pullToRefreshEnabled: false,
};
