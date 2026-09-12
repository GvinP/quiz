import { useEffect, useRef } from 'react';
import { webApp, isTelegram } from './webapp.ts';

/**
 * Нативная кнопка «Назад» клиента. Возвращает true, если она реально
 * показана — тогда экран прячет свою ссылку, чтобы не было двух «назад».
 */
export function useBackButton(handler?: () => void): boolean {
  const latest = useRef(handler);
  latest.current = handler;

  const enabled = handler !== undefined && isTelegram();

  useEffect(() => {
    const app = webApp();
    if (!enabled || !app) return;

    const onClick = () => latest.current?.();
    app.BackButton.onClick(onClick);
    app.BackButton.show();

    return () => {
      app.BackButton.offClick(onClick);
      app.BackButton.hide();
    };
  }, [enabled]);

  return enabled;
}
