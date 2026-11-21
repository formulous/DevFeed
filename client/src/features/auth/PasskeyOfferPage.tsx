import { useState } from 'react';
import { FiKey } from 'react-icons/fi';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '@/api/http';
import { safeRedirect } from '@/auth/guards';
import { AuthButton, AuthError, AuthPanel } from '@/components/auth/AuthPanel';
import { useToast } from '@/components/common/Toast';
import { errorMessage } from '@/lib/errors';
import { createPasskey, isPasskeyCancel, passkeyAvailable, passkeyOffer } from '@/lib/passkey';

export function PasskeyOfferPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const raw = params.get('redirect');
  const next = raw ? `/onboarding/tags?redirect=${encodeURIComponent(safeRedirect(raw))}` : '/onboarding/tags';

  if (!passkeyAvailable()) return <Navigate to={next} replace />;

  const done = () => {
    passkeyOffer.set(false);
    navigate(next, { replace: true });
  };

  const create = async () => {
    setPending(true);
    setMessage(null);
    try {
      await createPasskey();
      toast('패스키를 만들었어요. 다음부터 바로 로그인할 수 있어요');
      done();
    } catch (err) {
      if (!isPasskeyCancel(err)) setMessage(err instanceof ApiError ? errorMessage(err) : '패스키를 만들지 못했어요. 다시 시도해 주세요');
      setPending(false);
    }
  };

  return (
    <AuthPanel title="다음부터 지문이나 얼굴로 바로 로그인할까요?">
      <p className="-mt-4 mb-6 text-center text-sm leading-relaxed text-fg-secondary">
        패스키를 만들면 비밀번호 없이 이 기기에서 바로 로그인할 수 있어요. 지문·얼굴 정보는 기기 밖으로 나가지 않아요.
      </p>
      <div className="flex flex-col gap-3">
        <AuthButton onClick={create} disabled={pending} icon={<FiKey size={16} aria-hidden />}>
          {pending ? '패스키 만드는 중' : '패스키 만들기'}
        </AuthButton>
        <AuthButton variant="secondary" onClick={done} disabled={pending}>
          나중에
        </AuthButton>
        <AuthError>{message}</AuthError>
      </div>
    </AuthPanel>
  );
}
