import { Markdown } from './Markdown.tsx';

interface AnswerOptionsProps {
  options: string[];
  correct: number[];
  selected: number[];
  revealed: boolean;
  multiple: boolean;
  onToggle: (index: number) => void;
}

/**
 * После ответа показываем не только выбранное, но и пропущенные правильные —
 * иначе на multi непонятно, чего именно не хватило.
 */
function stateOf(index: number, selected: number[], correct: number[], revealed: boolean): string {
  const picked = selected.includes(index);
  if (!revealed) return picked ? 'option picked' : 'option';
  if (correct.includes(index)) return picked ? 'option right' : 'option missed';
  return picked ? 'option wrong' : 'option';
}

export function AnswerOptions({
  options,
  correct,
  selected,
  revealed,
  multiple,
  onToggle,
}: AnswerOptionsProps) {
  return (
    <ul className="options">
      {options.map((option, index) => (
        <li key={index}>
          <button
            type="button"
            className={stateOf(index, selected, correct, revealed)}
            disabled={revealed}
            aria-pressed={selected.includes(index)}
            onClick={() => onToggle(index)}
          >
            {multiple && <span className="box" aria-hidden="true" />}
            <Markdown source={option} className="option-text" />
          </button>
        </li>
      ))}
    </ul>
  );
}
