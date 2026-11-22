export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="7" fill="var(--color-inverse)" />
      <path d="M13.5 25V12.5a3.5 3.5 0 0 1 3.5-3.5h1.5M9.5 15.5h7.5" fill="none" stroke="var(--color-on-inverse)" strokeWidth="3" />
      <circle cx="21.5" cy="23.5" r="2.3" fill="var(--color-logo-dot)" />
    </svg>
  );
}

export function Wordmark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={className ?? 'flex items-center gap-2'}>
      <LogoMark size={size} />
      <span>formulous</span>
    </span>
  );
}
