/** Only fixed indicators are retained. Never return server strings or token values. */
export function inspectSfaAuthError(value: unknown) {
  const fields = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const message = typeof fields.message === 'string' ? fields.message : '';
  const wrapper = message.match(
    /^\[401 Unauthorized\] during \[GET\] to \[https?:\/\/[^\]\r\n]+\] \[([^\]\r\n]+)\]:\s*\[([\s\S]*)\]$/,
  );
  let upstream: unknown;
  try { upstream = wrapper ? JSON.parse(wrapper[2]) : undefined; } catch { /* Record a false indicator. */ }
  const ex = upstream && typeof upstream === 'object' && 'ex' in upstream
    ? (upstream as { ex: unknown }).ex : undefined;
  const auth = ex && typeof ex === 'object' ? ex as Record<string, unknown> : {};
  return {
    dataFailure: fields.error === 'Data failure',
    upstreamUnauthorized: message.startsWith('[401 Unauthorized]'),
    wrappedGet: !!wrapper,
    sfaProxy: !!wrapper && /^SFAApiProxy#[^\]\r\n]+$/.test(wrapper[1]),
    authenticationFailed: auth.code === 'authentication_failed',
    expiredToken: auth.message === 'Token has expired.',
    internalMicroserviceExpired: auth.message === 'Internal microservice token has expired.',
  };
}

/** Read only the expiry hint. Unverified JWT claims are never used as identity. */
export function accessTokenLifetimeSeconds(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? Math.ceil(payload.exp - Date.now() / 1000) : null;
  } catch { return null; }
}

export interface AuthDiagnosticEvent {
  phase: 'response' | 'auth_preflight' | 'auth_rejection' | 'refresh_start' | 'refresh_join' | 'refresh_reuse' |
    'refresh_result' | 'replay_start' | 'request_end';
  requestId: number;
  method: string;
  path: string;
  attempt: number;
  status: number | null;
  elapsedMs: number;
  durationMs?: number;
  managedAuth?: boolean;
  refreshAvailable?: boolean;
  sessionCurrent?: boolean;
  accessTokenExpiresInSeconds?: number | null;
  reason?: 'http_401' | 'sfa_expired' | 'unrecognized';
  result?: 'success' | 'failed' | 'unchanged' | 'http_error' | 'aborted' | 'timeout' | 'network' | 'parse';
  indicators?: ReturnType<typeof inspectSfaAuthError>;
}

export type AuthDiagnosticListener = (event: AuthDiagnosticEvent) => void;

/** Explicit opt-in for staging packages only; production cannot enable this sink. */
export const stagingAuthDiagnostics: AuthDiagnosticListener | undefined =
  import.meta.env.MODE === 'staging' && import.meta.env.VITE_AUTH_DIAGNOSTICS === 'true'
    ? (event) => console.info(`[Miniapp Auth] ${JSON.stringify(event)}`)
    : undefined;
