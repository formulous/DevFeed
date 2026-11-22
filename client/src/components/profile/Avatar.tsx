import { avatarInitial, avatarTone } from '@/lib/avatar';
import { cn } from '@/lib/cn';

export function Avatar({ nickname, size = 40, className }: { nickname: string; size?: number; className?: string }) {
  const tone = avatarTone(nickname);
  return (
    <span
      aria-hidden
      data-testid="avatar"
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: tone.bg, color: tone.fg }}
    >
      {avatarInitial(nickname)}
    </span>
  );
}
