/**
 * Единственная точка входа в Telegram SDK. Приложение обязано работать и в
 * обычном браузере, поэтому всё здесь — best effort: если WebApp недоступен,
 * функции молча ничего не делают.
 */

export const webApp = (): TelegramWebApp | undefined => window.Telegram?.WebApp;

export const isTelegram = (): boolean => webApp() !== undefined;

/** Цвета клиента в CSS-переменные, чтобы приложение совпадало с оформлением. */
function applyTheme(app: TelegramWebApp): void {
  const { style } = document.documentElement;
  const params = app.themeParams;

  const set = (name: string, value: string | undefined) => {
    if (value) style.setProperty(name, value);
  };

  set('--bg', params.bg_color);
  set('--bg-secondary', params.secondary_bg_color);
  set('--text', params.text_color);
  set('--hint', params.hint_color);
  set('--link', params.link_color);
  set('--accent', params.button_color);
  set('--accent-text', params.button_text_color);
  set('--danger', params.destructive_text_color);

  // Во встроенном браузере Telegram WebApp есть, а themeParams пустой. Если в
  // этом случае всё равно проставить data-theme, мы навяжем светлую тему в
  // тёмном клиенте — поэтому стемпим её, только когда цвета реально пришли,
  // а иначе отдаём решение системной prefers-color-scheme.
  if (Object.values(params).some(Boolean)) {
    document.documentElement.dataset.theme = app.colorScheme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/** Высота видимой области клиента: 100vh в Mini App врёт из-за панелей. */
function applyViewport(app: TelegramWebApp): void {
  if (app.viewportStableHeight) {
    document.documentElement.style.setProperty('--viewport', `${app.viewportStableHeight}px`);
  }
}

export function initTelegram(): void {
  const app = webApp();
  if (!app) return;

  app.ready();
  app.expand();

  // Вертикальный свайп закрывает Mini App — на экране с длинным разбором это
  // срабатывает вместо прокрутки. Метода нет в клиентах до Bot API 7.7.
  app.disableVerticalSwipes?.();
  applyTheme(app);
  applyViewport(app);

  app.onEvent('themeChanged', () => applyTheme(app));
  app.onEvent('viewportChanged', () => applyViewport(app));
}

export function haptic(kind: 'correct' | 'wrong' | 'tap'): void {
  const feedback = webApp()?.HapticFeedback;
  if (!feedback) return;
  if (kind === 'tap') feedback.impactOccurred('light');
  else feedback.notificationOccurred(kind === 'correct' ? 'success' : 'error');
}
