import { FiMoon, FiSun } from 'react-icons/fi';
import { useColorScheme } from '@/lib/colorScheme';

export function ThemeToggle() {
  const { scheme, toggle } = useColorScheme();
  const dark = scheme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? '라이트 테마로 전환' : '다크 테마로 전환'}
      title={dark ? '라이트 테마' : '다크 테마'}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      {dark ? <FiSun size={16} aria-hidden /> : <FiMoon size={16} aria-hidden />}
    </button>
  );
}
