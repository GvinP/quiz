import { Markdown } from './Markdown.tsx';

interface ExplanationProps {
  explanation: string;
  followUp?: string[];
}

export function Explanation({ explanation, followUp }: ExplanationProps) {
  return (
    <section className="explanation">
      <Markdown source={explanation} />
      {followUp && followUp.length > 0 && (
        <>
          <h3>Куда копнут дальше</h3>
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
