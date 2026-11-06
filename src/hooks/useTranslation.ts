import { useMiniAppStore } from '../store/miniAppStore';
import en from '../../assets/lang/en.json';
import km from '../../assets/lang/km.json';

const dictionaries = { en, km };

export function useTranslation() {
  const language = useMiniAppStore((state) => state.language);

  const t = (key: string): string => {
    let value: unknown = dictionaries[language];
    for (const part of key.split('.')) {
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return key;
      value = (value as Record<string, unknown>)[part];
    }
    return typeof value === 'string' ? value : key;
  };

  return { t, language };
}
