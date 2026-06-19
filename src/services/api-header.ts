
import { useMiniAppStore } from '../store/miniAppStore';

export function getHeaders() {
  const token = useMiniAppStore.getState().authToken;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}