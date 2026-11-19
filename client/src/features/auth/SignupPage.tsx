import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@onyx/components/button/button';
import { TextField } from '@onyx/components/input/text-field';
import { ApiError } from '@/api/http';
import type { SignupInput } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { FieldError } from '@/components/common/FieldError';
import { errorMessage, fieldErrorMap } from '@/lib/errors';

type Field = keyof SignupInput | 'passwordConfirm';
type Values = Record<Field, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(v: Values): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!EMAIL_PATTERN.test(v.email.trim())) errors.email = '이메일 형식이 아님';
  if (v.password.length < 8 || v.password.length > 64) errors.password = '8~64자여야 함';
  else if (!/^[\x21-\x7E]+$/.test(v.password)) errors.password = '공백·한글은 쓸 수 없음';
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) errors.password = '영문과 숫자를 모두 포함해야 함';
  if (v.passwordConfirm !== v.password) errors.passwordConfirm = '비밀번호가 일치하지 않음';
  const nickname = v.nickname.trim();
  if (nickname.length < 2 || nickname.length > 20) errors.nickname = '2~20자여야 함';
  return errors;
}

export function SignupPage() {
  const { signup } = useAuth();
  const [params] = useSearchParams();
  const [values, setValues] = useState<Values>({ email: '', password: '', passwordConfirm: '', nickname: '' });
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const local = validateSignup(values);
  const server = fieldErrorMap(error);
  if (error instanceof ApiError && error.code === 'EMAIL_DUPLICATED') server.email = '이미 가입된 이메일임';
  const show = (f: Field) => (submitted ? local[f] : undefined) ?? server[f];
  const formError = error && Object.keys(server).length === 0 ? errorMessage(error) : null;

  const set = (f: Field) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [f]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(local).length > 0) return;
    setPending(true);
    setError(null);
    try {
      await signup({ email: values.email.trim(), password: values.password, nickname: values.nickname.trim() });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  const loginHref = params.get('redirect') ? `/login?redirect=${encodeURIComponent(params.get('redirect')!)}` : '/login';

  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <h1 className="mb-6 text-xl font-bold">회원가입</h1>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <TextField label="이메일" autoComplete="email" inputMode="email" value={values.email} onChange={set('email')} className="h-10" />
          <FieldError message={show('email')} />
        </div>
        <div>
          <TextField
            label="비밀번호"
            type="password"
            autoComplete="new-password"
            maxLength={64}
            value={values.password}
            onChange={set('password')}
            className="h-10"
          />
          <FieldError message={show('password')} />
          {!show('password') && <p className="mt-1 text-xs text-fg-muted">8~64자, 영문·숫자 포함 (공백·한글 불가)</p>}
        </div>
        <div>
          <TextField
            label="비밀번호 확인"
            type="password"
            autoComplete="new-password"
            maxLength={64}
            value={values.passwordConfirm}
            onChange={set('passwordConfirm')}
            className="h-10"
          />
          <FieldError message={show('passwordConfirm')} />
        </div>
        <div>
          <TextField label="닉네임" autoComplete="nickname" maxLength={20} value={values.nickname} onChange={set('nickname')} className="h-10" />
          <FieldError message={show('nickname')} />
        </div>
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          height={40}
          disabled={pending}
          className="bg-brand text-sm text-white"
          content={pending ? '가입 중' : '가입하기'}
        />
      </form>
      <p className="mt-4 text-center text-sm text-fg-secondary">
        이미 계정이 있음?{' '}
        <Link to={loginHref} className="font-medium text-brand">
          로그인
        </Link>
      </p>
    </section>
  );
}
