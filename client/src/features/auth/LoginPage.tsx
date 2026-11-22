import { useEffect, useState, type FormEvent } from 'react';
import { FiArrowLeft, FiKey, FiMail } from 'react-icons/fi';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '@/api/http';
import { useAuth } from '@/auth/AuthProvider';
import { AuthButton, AuthError, AuthInput, AuthPanel } from '@/components/auth/AuthPanel';
import { errorMessage, fieldErrorMap } from '@/lib/errors';
import { cancelPasskeyCeremony, getPasskeyAssertion, isPasskeyCancel, passkeyAvailable } from '@/lib/passkey';

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

function passkeyError(error: unknown) {
  if (error instanceof ApiError && error.code === 'PASSKEY_NOT_FOUND') return '이 패스키로 가입된 계정을 찾을 수 없어요';
  if (error instanceof ApiError) return errorMessage(error);
  return '패스키로 로그인하지 못했어요. 다시 시도해 주세요';
}

export function LoginPage() {
  const { login, loginWithPasskey } = useAuth();
  const [params] = useSearchParams();
  const [passkey] = useState(passkeyAvailable);
  const [mode, setMode] = useState<'choose' | 'email'>(passkey ? 'choose' : 'email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<'email' | 'passkey' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  const [lockSec, setLockSec] = useState(0);
  const lockLeft = useCountdown(lockSec);

  const fields = fieldErrorMap(error);
  const locked = lockLeft > 0;

  useEffect(() => {
    if (!passkey || mode !== 'email') return;
    let active = true;
    getPasskeyAssertion(true)
      .then(async (credential) => {
        if (!active || !credential) return;
        setPending('passkey');
        try {
          await loginWithPasskey(credential);
        } catch (err) {
          if (active) setPasskeyMessage(passkeyError(err));
        } finally {
          if (active) setPending(null);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      cancelPasskeyCeremony();
    };
  }, [passkey, mode, loginWithPasskey]);

  const usePasskey = async () => {
    setPasskeyMessage(null);
    setPending('passkey');
    try {
      const credential = await getPasskeyAssertion();
      if (credential) await loginWithPasskey(credential);
    } catch (err) {
      if (!isPasskeyCancel(err)) setPasskeyMessage(passkeyError(err));
    } finally {
      setPending(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending('email');
    setError(null);
    setPasskeyMessage(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err);
      if (err instanceof ApiError && err.code === 'LOGIN_LOCKED') setLockSec(err.body.retryAfterSec ?? 600);
    } finally {
      setPending(null);
    }
  };

  const formError = locked
    ? `로그인 시도가 많아 잠겼어요. ${Math.floor(lockLeft / 60)}분 ${lockLeft % 60}초 후 다시 시도해 주세요`
    : error && Object.keys(fields).length === 0
      ? errorMessage(error)
      : null;
  const signupHref = params.get('redirect') ? `/signup?redirect=${encodeURIComponent(params.get('redirect')!)}` : '/signup';

  return (
    <AuthPanel
      title="formulous에 로그인"
      footer={
        <>
          계정이 없으신가요?{' '}
          <Link to={signupHref} className="font-medium text-fg hover:underline">
            회원가입
          </Link>
        </>
      }
    >
      {mode === 'choose' ? (
        <div key="choose" className="auth-enter flex flex-col gap-3">
          <AuthButton onClick={usePasskey} disabled={pending !== null} icon={<FiKey size={16} aria-hidden />}>
            {pending === 'passkey' ? '패스키 확인 중' : '패스키로 로그인'}
          </AuthButton>
          <AuthButton
            variant="secondary"
            onClick={() => {
              setPasskeyMessage(null);
              setMode('email');
            }}
            icon={<FiMail size={16} aria-hidden />}
          >
            이메일로 계속하기
          </AuthButton>
          <AuthError>{passkeyMessage}</AuthError>
        </div>
      ) : (
        <form key="email" onSubmit={submit} noValidate className="auth-enter flex flex-col gap-3">
          <div>
            <AuthInput
              label="이메일"
              name="email"
              type="email"
              placeholder="이메일 주소"
              autoComplete={passkey ? 'username webauthn' : 'username'}
              inputMode="email"
              autoFocus={passkey}
              value={email}
              invalid={!!fields.email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <AuthError>{fields.email}</AuthError>
          </div>
          <div>
            <AuthInput
              label="비밀번호"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              invalid={!!fields.password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <AuthError>{fields.password}</AuthError>
          </div>
          <AuthButton type="submit" disabled={pending !== null || locked || !email.trim() || !password}>
            {pending === 'email' ? '로그인 중' : '로그인'}
          </AuthButton>
          <AuthError>{formError ?? passkeyMessage}</AuthError>
          {passkey && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPasskeyMessage(null);
                setMode('choose');
              }}
              className="mx-auto mt-2 flex items-center gap-1.5 rounded text-sm text-fg-secondary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <FiArrowLeft size={14} aria-hidden />
              다른 방법으로 로그인
            </button>
          )}
        </form>
      )}
    </AuthPanel>
  );
}
