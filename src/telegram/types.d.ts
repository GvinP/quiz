// Минимальные типы Telegram WebApp — только те поля, которые используем.
// Отдельный пакет типов не берём: зависимость ради восьми полей не окупается.

interface TelegramThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  destructive_text_color?: string;
}

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(handler: () => void): void;
  offClick(handler: () => void): void;
}

interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
}

/** Колбэки CloudStorage идут в стиле Node: (error, result). */
interface TelegramCloudStorage {
  setItem(key: string, value: string, callback?: (error: string | null, saved: boolean) => void): void;
  getItem(key: string, callback: (error: string | null, value: string) => void): void;
  getItems(keys: string[], callback: (error: string | null, values: Record<string, string>) => void): void;
  removeItems(keys: string[], callback?: (error: string | null, removed: boolean) => void): void;
  getKeys(callback: (error: string | null, keys: string[]) => void): void;
}

interface TelegramWebApp {
  CloudStorage: TelegramCloudStorage;
  ready(): void;
  expand(): void;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  viewportStableHeight?: number;
  BackButton: TelegramBackButton;
  HapticFeedback: TelegramHapticFeedback;
  onEvent(event: 'themeChanged' | 'viewportChanged', handler: () => void): void;
  offEvent(event: 'themeChanged' | 'viewportChanged', handler: () => void): void;
  /** Появился в Bot API 7.7 — в старых клиентах отсутствует. */
  disableVerticalSwipes?(): void;
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
