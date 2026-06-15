import { useWorkflowStore } from '../store/workflowStore';

/**
 * A React hook for translating UI strings within the mini-app.
 * 
 * Supports nested dot-separated keys (e.g. 'global.setting').
 */
export function useTranslation() {
  const translations = useWorkflowStore((s) => s.translations);
  const language = useWorkflowStore((s) => s.language);

  const t = (key: string): string => {
    if (!translations) return key;

    const parts = key.split('.');
    let current = translations;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return key;
      }
    }

    return typeof current === 'string' ? current : key;
  };

  return { t, language };
}
