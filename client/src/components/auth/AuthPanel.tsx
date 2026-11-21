import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { cn } from '@/lib/cn';
import { LogoMark } from './LogoMark';

export function AuthPanel({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="flex w-full max-w-[340px] flex-col items-center">
      <LogoMark size={40} />
      <h1 className="mb-8 mt-5 text-center text-xl font-semibold tracking-tight text-fg">{title}</h1>
      <div className="w-full">{children}</div>
      {footer && <div className="mt-8 text-center text-sm text-fg-secondary">{footer}</div>}
    </section>
  );
}

type Variant = 'primary' | 'secondary';

export function AuthButton({
  variant = 'primary',
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-app',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary'
          ? 'bg-inverse text-on-inverse hover:opacity-90'
          : 'border border-line bg-surface text-fg hover:border-line-strong hover:bg-hover',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

interface AuthInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  type?: 'text' | 'email' | 'password';
  invalid?: boolean;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput(
  { label, type = 'text', invalid, className, ...props },
  ref,
) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="relative">
      <input
        ref={ref}
        {...props}
        type={isPassword && show ? 'text' : type}
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder={props.placeholder ?? label}
        className={cn(
          'h-11 w-full rounded-lg border bg-input px-3.5 text-sm text-fg placeholder:text-fg-muted transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
          invalid ? 'border-danger' : 'border-line hover:border-line-strong focus:border-line-strong',
          isPassword && 'pr-11',
          className,
        )}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
      )}
    </div>
  );
});

export function AuthError({ id, children }: { id?: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[13px] text-danger">
      {children}
    </p>
  );
}
