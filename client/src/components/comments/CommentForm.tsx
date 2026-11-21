import { useId, useState } from 'react';
import { COMMENT_MAX } from '@/api/reactions';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

interface CommentFormProps {
  initial?: string;
  placeholder: string;
  submitLabel: string;
  label: string;
  autoFocus?: boolean;
  onSubmit: (content: string) => Promise<boolean>;
  onCancel?: () => void;
}

export function CommentForm({ initial = '', placeholder, submitLabel, label, autoFocus, onSubmit, onCancel }: CommentFormProps) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const counterId = useId();
  const trimmed = value.trim();
  const disabled = pending || trimmed.length === 0 || trimmed.length > COMMENT_MAX || (initial !== '' && trimmed === initial);

  const submit = async () => {
    if (disabled) return;
    setPending(true);
    const ok = await onSubmit(trimmed);
    setPending(false);
    if (ok && !initial) setValue('');
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        aria-label={label}
        aria-describedby={counterId}
        placeholder={placeholder}
        maxLength={COMMENT_MAX}
        rows={2}
        autoFocus={autoFocus}
        className="min-h-[64px] w-full resize-y rounded-[var(--radius-sm)] border border-line bg-input px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      />
      <div className="flex items-center justify-end gap-2">
        <span id={counterId} className={cn('mr-auto text-xs tabular-nums', value.length >= COMMENT_MAX ? 'text-danger' : 'text-fg-muted')}>
          {formatNumber(value.length)}/{formatNumber(COMMENT_MAX)}
        </span>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-full px-3 py-1.5 text-sm text-fg-secondary hover:bg-subtle">
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={disabled}
          className="rounded-full bg-inverse px-3.5 py-1.5 text-sm font-medium text-on-inverse hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
