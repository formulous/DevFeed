import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@onyx/components/button/button';
import { TextField } from '@onyx/components/input/text-field';
import { ApiError } from '@/api/http';
import { useAuth } from '@/auth/AuthProvider';
import { FieldError } from '@/components/common/FieldError';
import { errorMessage, fieldErrorMap } from '@/lib/errors';

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return left;
}

export function LoginPage() {
  const { login } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [lockSec, setLockSec] = useState(0);
  const lockLeft = useCountdown(lockSec);

  const fields = fieldErrorMap(error);
  const locked = lockLeft > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err);
      if (err instanceof ApiError && err.code === 'LOGIN_LOCKED') setLockSec(err.body.retryAfterSec ?? 600);
    } finally {
      setPending(false);
    }
  };

  const formError = error && Object.keys(fields).length === 0 ? errorMessage(error) : null;
  const signupHref = params.get('redirect') ? `/signup?redirect=${encodeURIComponent(params.get('redirect')!)}` : '/signup';

  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <h1 className="mb-6 text-xl font-bold">로그인</h1>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <TextField
            label="이메일"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10"
          />
          <FieldError message={fields.email} />
        </div>
        <div>
          <TextField
            label="비밀번호"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10"
          />
          <FieldError message={fields.password} />
        </div>
        {locked ? (
          <p role="alert" className="text-sm text-red-600">
            로그인 시도가 많아 잠겼음. {Math.floor(lockLeft / 60)}분 {lockLeft % 60}초 후 다시 시도
          </p>
        ) : (
          formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )
        )}
        <Button
          type="submit"
          height={40}
          disabled={pending || locked || !email.trim() || !password}
          className="bg-brand text-sm text-white"
          content={pending ? '로그인 중' : '로그인'}
        />
      </form>
      <p className="mt-4 text-center text-sm text-fg-secondary">
        계정이 없음?{' '}
        <Link to={signupHref} className="font-medium text-brand">
          회원가입
        </Link>
      </p>
    </section>
  );
}
