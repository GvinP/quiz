import type { Language } from '../i18n/language.ts';
import { haptic } from '../telegram/webapp.ts';

interface LanguageSwitchProps {
  languages: Language[];
  current: Language;
  onChange: (language: Language) => void;
}

const LABELS: Record<Language, string> = { ru: 'RU', en: 'EN' };

/** Переключатель показывается только если переводов правда больше одного. */
export function LanguageSwitch({ languages, current, onChange }: LanguageSwitchProps) {
  if (languages.length < 2) return null;

  return (
    <div className="lang" role="group">
      {languages.map((language) => (
        <button
          key={language}
          type="button"
          className={language === current ? 'lang-option current' : 'lang-option'}
          aria-pressed={language === current}
          onClick={() => {
            if (language === current) return;
            haptic('tap');
            onChange(language);
          }}
        >
          {LABELS[language]}
        </button>
      ))}
    </div>
  );
}
