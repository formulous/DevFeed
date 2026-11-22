import { useState, type ReactNode } from 'react';
import './markdown.css';
import { FiCheck, FiCopy } from 'react-icons/fi';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Element } from 'hast';
import { cn } from '@/lib/cn';
import rehypeSafe, { safeUrl, textOf } from './rehypeSafe';

export const ALLOWED_ELEMENTS = [
  'p', 'h2', 'h3', 'h4', 'strong', 'em', 'del', 'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'code', 'pre', 'span', 'hr', 'br',
];

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      setDone(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={done ? '복사했어요' : '코드 복사'}
      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-fg-muted shadow-sm hover:text-fg"
    >
      {done ? <FiCheck size={14} aria-hidden /> : <FiCopy size={14} aria-hidden />}
    </button>
  );
}

function Pre({ node, children }: { node?: Element; children?: ReactNode }) {
  const text = node ? node.children.map(textOf).join('').replace(/\n$/, '') : '';
  return (
    <div className="relative">
      <pre>{children}</pre>
      <CopyButton text={text} />
    </div>
  );
}

const components: Components = {
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  pre: Pre,
  table: ({ children }) => (
    <div className="scrollbar-thin overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

export default function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn('md-body', className)} data-testid="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSafe]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        urlTransform={safeUrl}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
