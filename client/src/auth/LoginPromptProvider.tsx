import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@onyx/components/button/button';
import { Modal } from '@/components/common/Modal';

interface LoginPromptValue {
  openLoginPrompt: (message?: string) => void;
}

const LoginPromptContext = createContext<LoginPromptValue | null>(null);

export function LoginPromptProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const openLoginPrompt = useCallback((msg?: string) => setMessage(msg ?? '로그인이 필요한 기능이에요'), []);
  const close = () => setMessage(null);
  const goTo = (path: string) => {
    const redirect = encodeURIComponent(location.pathname + location.search);
    close();
    navigate(`${path}?redirect=${redirect}`);
  };

  const value = useMemo(() => ({ openLoginPrompt }), [openLoginPrompt]);

  return (
    <LoginPromptContext.Provider value={value}>
      {children}
      <Modal open={message !== null} onClose={close} title="로그인 필요">
        <p className="text-sm text-fg-secondary">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outlined" width={88} height={36} content="회원가입" onClick={() => goTo('/signup')} />
          <Button
            width={88}
            height={36}
            className="rounded-full bg-inverse text-on-inverse"
            content="로그인"
            onClick={() => goTo('/login')}
          />
        </div>
      </Modal>
    </LoginPromptContext.Provider>
  );
}

export function useLoginPrompt() {
  const ctx = useContext(LoginPromptContext);
  if (!ctx) throw new Error('LoginPromptProvider 밖에서 useLoginPrompt 호출');
  return ctx;
}
