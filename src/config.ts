/** Customize these settings when starting a new mini-app. */
export const appConfig = {
  title: 'Mini App',
  defaultLanguage: 'en' as const,
  bridgeTimeoutMs: 5_000,
  developmentBridgeTimeoutMs: 5_000,
  requestTimeoutMs: 20_000,
  authRefreshTimeoutMs: 10_000,
  pullToRefreshEnabled: false,
};
