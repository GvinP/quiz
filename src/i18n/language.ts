export const LANGUAGES = ['ru', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'ru';

const STORAGE_KEY = 'lang';

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/**
 * Язык интерфейса — предпочтение устройства, а не часть прогресса, поэтому
 * живёт в localStorage, а не в CloudStorage: чтение синхронное и экран сразу
 * рисуется на нужном языке, без мигания русским у англоязычной сессии.
 */
export function readLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // приватный режим — останется язык по умолчанию
  }
  return DEFAULT_LANGUAGE;
}

export function writeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // не сохранилось — выбор продержится до конца сессии
  }
}

/**
 * Пространство имён для ключей хранилища — приставка перед именем ключа.
 * У языка по умолчанию её нет: эти ключи уже лежат у пользователей с первых
 * версий, и переименовывать их ради симметрии значило бы потерять прогресс.
 *
 * Разделитель — подчёркивание, и это важно: в именах тем его не бывает
 * (`rn-architecture`, `js-core`), поэтому `progress_…` и `en_progress_…`
 * различаются однозначно, без догадок по первым символам.
 */
export const namespaceOf = (language: Language): string =>
  language === DEFAULT_LANGUAGE ? '' : `${language}_`;
