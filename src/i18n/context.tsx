import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Language } from './language.ts';
import { DEFAULT_LANGUAGE } from './language.ts';
import { STRINGS } from './strings.ts';
import type { Strings } from './strings.ts';

const Context = createContext<{ language: Language; t: Strings }>({
  language: DEFAULT_LANGUAGE,
  t: STRINGS[DEFAULT_LANGUAGE],
});

export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return <Context.Provider value={{ language, t: STRINGS[language] }}>{children}</Context.Provider>;
}

/** Тексты интерфейса текущего языка. */
export const useStrings = (): Strings => useContext(Context).t;

export const useLanguage = (): Language => useContext(Context).language;
