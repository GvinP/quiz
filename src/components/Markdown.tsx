import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';

// В контенте перенос строки значим: explanation у open-вопросов — это списки
// и пункты, разделённые одиночными \n.
marked.use({ breaks: true, gfm: true });

const hasCodeBlock = (source: string): boolean => source.includes('```');

/**
 * Подсветка грузится только когда в тексте реально есть блок кода: сейчас
 * таких вопросов нет ни одного, платить за Prism на каждом старте незачем.
 */
async function highlight(root: HTMLElement): Promise<void> {
  const { default: Prism } = await import('prismjs');
  await import('prismjs/components/prism-clike.js');
  await import('prismjs/components/prism-javascript.js');
  await import('prismjs/components/prism-typescript.js');
  await import('prismjs/components/prism-jsx.js');
  await import('prismjs/components/prism-tsx.js');
  Prism.highlightAllUnder(root);
}

interface MarkdownProps {
  source: string;
  className?: string;
}

/**
 * Контент свой, из репозитория, недоверенного ввода нет — поэтому html
 * вставляется как есть, без санитайзера.
 */
export function Markdown({ source, className }: MarkdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => marked.parse(source, { async: false }), [source]);

  useEffect(() => {
    if (ref.current && hasCodeBlock(source)) void highlight(ref.current);
  }, [source, html]);

  return (
    <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
