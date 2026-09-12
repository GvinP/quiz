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

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  viewportStableHeight?: number;
  BackButton: TelegramBackButton;
  HapticFeedback: TelegramHapticFeedback;
  onEvent(event: 'themeChanged' | 'viewportChanged', handler: () => void): void;
  offEvent(event: 'themeChanged' | 'viewportChanged', handler: () => void): void;
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
