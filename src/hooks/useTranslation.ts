import { useMiniAppStore } from '../store/miniAppStore';

export function useTranslation() {
  const translations = useMiniAppStore((s) => s.translations);
  const language = useMiniAppStore((s) => s.language);

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
