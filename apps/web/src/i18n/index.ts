import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

export const resources = { en: { translation: en } } as const;

declare module 'i18next' {
  // Typed keys: a missing key is a type error (docs/engineering.md §2.1).
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: (typeof resources)['en'];
  }
}

type LevelNameKey = `levels.${keyof typeof en.levels}.name`;

/** Level files carry their name as a plain string key (spec §3.2); narrow it to a typed key. */
export function isLevelNameKey(key: string): key is LevelNameKey {
  const match = /^levels\.(.+)\.name$/.exec(key);
  return match?.[1] !== undefined && Object.hasOwn(en.levels, match[1]);
}

export async function initI18n(): Promise<void> {
  await i18next.use(initReactI18next).init({
    resources,
    lng: navigator.language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
  });
}
