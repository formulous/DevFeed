import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '@/api/http';
import type { SignupInput } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AuthButton, AuthError, AuthInput, AuthPanel } from '@/components/auth/AuthPanel';
import { errorMessage, fieldErrorMap } from '@/lib/errors';
import { passkeyOffer } from '@/lib/passkey';

type Field = keyof SignupInput;
type Values = Record<Field, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(v: Values): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!EMAIL_PATTERN.test(v.email.trim())) errors.email = '이메일 형식이 아니에요';
  if (v.password.length < 8 || v.password.length > 64) errors.password = '비밀번호는 8~64자로 입력해 주세요';
  else if (!/^[\x21-\x7E]+$/.test(v.password)) errors.password = '공백과 한글은 쓸 수 없어요';
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) errors.password = '영문과 숫자를 모두 넣어 주세요';
  const nickname = v.nickname.trim();
  if (nickname.length < 2 || nickname.length > 20) errors.nickname = '닉네임은 2~20자로 입력해 주세요';
  return errors;
}

export function SignupPage() {
  const { signup } = useAuth();
  const [params] = useSearchParams();
  const [values, setValues] = useState<Values>({ email: '', password: '', nickname: '' });
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const local = validateSignup(values);
  const server = fieldErrorMap(error);
  if (error instanceof ApiError && error.code === 'EMAIL_DUPLICATED') server.email = '이미 가입된 이메일이에요';
  const show = (f: Field) => (submitted ? local[f] : undefined) ?? server[f];
  const formError = error && Object.keys(server).length === 0 ? errorMessage(error) : null;

  const set = (f: Field) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [f]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(local).length > 0) return;
    setPending(true);
    setError(null);
    passkeyOffer.set(true);
    try {
      await signup({ email: values.email.trim(), password: values.password, nickname: values.nickname.trim() });
    } catch (err) {
      passkeyOffer.set(false);
      setError(err);
    } finally {
      setPending(false);
    }
  };

  const loginHref = params.get('redirect') ? `/login?redirect=${encodeURIComponent(params.get('redirect')!)}` : '/login';

  return (
    <AuthPanel
      title="DevFeed 계정 만들기"
      footer={
        <>
          이미 계정이 있으신가요?{' '}
          <Link to={loginHref} className="font-medium text-fg hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <div>
          <AuthInput
            label="이메일"
            type="email"
            placeholder="이메일 주소"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            invalid={!!show('email')}
            onChange={set('email')}
          />
          <AuthError>{show('email')}</AuthError>
        </div>
        <div>
          <AuthInput
            label="비밀번호"
            type="password"
            autoComplete="new-password"
            maxLength={64}
            value={values.password}
            invalid={!!show('password')}
            aria-describedby="password-rule"
            onChange={set('password')}
          />
          {show('password') ? (
            <AuthError>{show('password')}</AuthError>
          ) : (
            <p id="password-rule" className="mt-1.5 text-xs text-fg-muted">
              8~64자, 영문·숫자 포함 (공백·한글 불가)
            </p>
          )}
        </div>
        <div>
          <AuthInput
            label="닉네임"
            autoComplete="nickname"
            maxLength={20}
            value={values.nickname}
            invalid={!!show('nickname')}
            onChange={set('nickname')}
          />
          <AuthError>{show('nickname')}</AuthError>
        </div>
        <AuthButton type="submit" disabled={pending}>
          {pending ? '가입 중' : '가입하기'}
        </AuthButton>
        <AuthError>{formError}</AuthError>
        <p className="mt-1 text-center text-xs text-fg-muted">가입하면 이메일과 닉네임을 보관해요</p>
      </form>
    </AuthPanel>
  );
}
