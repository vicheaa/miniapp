/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  readonly VITE_DEV_AUTH_TOKEN?: string;
}
