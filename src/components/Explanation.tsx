import { Markdown } from './Markdown.tsx';
import { useStrings } from '../i18n/context.tsx';

interface ExplanationProps {
  explanation: string;
  followUp?: string[];
}

export function Explanation({ explanation, followUp }: ExplanationProps) {
  const t = useStrings();

  return (
    <section className="explanation">
      <Markdown source={explanation} />
      {followUp && followUp.length > 0 && (
        <>
          <h3>{t.followUp}</h3>
          <ul className="follow-up">
            {followUp.map((item) => (
              <li key={item}>
                <Markdown source={item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
