export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="7" fill="var(--color-inverse)" />
      <path d="M9 8h6.5a8 8 0 0 1 0 16H9z" fill="none" stroke="var(--color-on-inverse)" strokeWidth="3" />
      <circle cx="22.5" cy="23" r="2.2" fill="var(--color-on-inverse)" />
    </svg>
  );
}
