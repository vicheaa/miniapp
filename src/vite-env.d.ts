/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  readonly VITE_DEV_AUTH_TOKEN?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_AUTH_DIAGNOSTICS?: string;
}
