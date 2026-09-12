/**
 * Хранилище ключ-значение поверх Telegram CloudStorage с фолбэком на
 * localStorage: приложение должно открываться и в обычном браузере.
 * CloudStorage колбэчный — оборачиваем в промисы.
 */

export interface KeyValueStore {
  readonly kind: 'cloud' | 'local';
  getKeys(): Promise<string[]>;
  getItems(keys: string[]): Promise<Record<string, string>>;
  setItem(key: string, value: string): Promise<void>;
  removeItems(keys: string[]): Promise<void>;
}

function cloudStore(storage: TelegramCloudStorage): KeyValueStore {
  return {
    kind: 'cloud',
    getKeys: () =>
      new Promise((resolve, reject) => {
        storage.getKeys((error, keys) => (error ? reject(new Error(error)) : resolve(keys ?? [])));
      }),
    getItems: (keys) =>
      new Promise((resolve, reject) => {
        if (keys.length === 0) return resolve({});
        storage.getItems(keys, (error, values) =>
          error ? reject(new Error(error)) : resolve(values ?? {}),
        );
      }),
    setItem: (key, value) =>
      new Promise((resolve, reject) => {
        storage.setItem(key, value, (error) => (error ? reject(new Error(error)) : resolve()));
      }),
    removeItems: (keys) =>
      new Promise((resolve, reject) => {
        if (keys.length === 0) return resolve();
        storage.removeItems(keys, (error) => (error ? reject(new Error(error)) : resolve()));
      }),
  };
}

/**
 * localStorage может бросать в приватном режиме и при переполнении квоты,
 * поэтому каждое обращение защищено: потеря прогресса не должна ронять экран.
 */
function localStore(): KeyValueStore {
  return {
    kind: 'local',
    getKeys: async () => {
      try {
        return Object.keys(window.localStorage);
      } catch {
        return [];
      }
    },
    getItems: async (keys) => {
      const values: Record<string, string> = {};
      for (const key of keys) {
        try {
          const value = window.localStorage.getItem(key);
          if (value !== null) values[key] = value;
        } catch {
          // ключ недоступен — пропускаем
        }
      }
      return values;
    },
    setItem: async (key, value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // квота или приватный режим — прогресс просто не переживёт сессию
      }
    },
    removeItems: async (keys) => {
      for (const key of keys) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // нечего удалять
        }
      }
    },
  };
}

export function pickStore(): KeyValueStore {
  const storage = window.Telegram?.WebApp?.CloudStorage;
  return storage ? cloudStore(storage) : localStore();
}
