import { ApiError } from './request';

/** User-facing copy uses fixed translations; server details stay on the original error. */
export function requestErrorPresentation(error: unknown, context: 'read' | 'submit' = 'read') {
  const apiError = error instanceof ApiError ? error : null;
  const reason = apiError?.status === 401 ? 'session' :
    apiError?.status === 403 ? 'permission' :
    apiError?.status === 404 ? 'missing' :
    apiError?.status === 429 ? 'busy' :
    apiError?.status === 400 || apiError?.status === 422 ? 'validation' :
    apiError?.kind === 'network' ? 'network' :
    apiError?.kind === 'timeout' ? 'timeout' : 'server';
  // A transport failure or server error doesn't establish whether a write saved.
  const checkOrders = context === 'submit' && ['network', 'timeout', 'server'].includes(reason);
  return {
    titleKey: `errors.${checkOrders ? 'orderUnconfirmed' : reason}Title`,
    messageKey: `errors.${checkOrders ? 'orderUnconfirmed' : reason}Message`,
    checkOrders,
  };
}
