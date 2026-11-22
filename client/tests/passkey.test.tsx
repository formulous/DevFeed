import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/node';
import { App } from '@/App';
import { deviceName } from '@/lib/passkey';
import { mockPasskeys, seedPasskey } from '@/mocks/passkeys';
import { currentLocation, renderWithApp, seedLogin } from './render';

const webauthn = vi.hoisted(() => ({
  supported: true,
  autofill: false,
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
  cancelCeremony: vi.fn(),
}));

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => webauthn.supported,
  browserSupportsWebAuthnAutofill: async () => webauthn.autofill,
  startAuthentication: webauthn.startAuthentication,
  startRegistration: webauthn.startRegistration,
  WebAuthnAbortService: { cancelCeremony: webauthn.cancelCeremony },
}));

const assertion = (id: string) => ({ id, rawId: id, type: 'public-key', response: {}, clientExtensionResults: {} });
const admin = {
  id: 1,
  email: 'admin@devfeed.dev',
  nickname: 'admin',
  role: 'ADMIN' as const,
  hasInterestTags: false,
  onboardingCompleted: true,
  createdAt: '2026-11-01T00:00:00.000Z',
};

beforeEach(() => {
  webauthn.supported = true;
  webauthn.autofill = false;
  webauthn.startAuthentication.mockReset();
  webauthn.startRegistration.mockReset();
});

describe('S-05 로그인 개편·F-034 패스키 (027)', () => {
  it('패스키를 지원하면 방법 선택부터, 이메일로 계속하면 입력칸으로 바뀌고 돌아올 수 있음', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/login');
    expect(await screen.findByRole('heading', { name: 'formulous에 로그인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '패스키로 로그인' })).toBeInTheDocument();
    expect(screen.queryByLabelText('이메일')).toBeNull();
    expect(screen.queryByRole('navigation', { name: '피드' })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: '이메일로 계속하기' }));
    expect(screen.getByLabelText('이메일')).toHaveAttribute('autocomplete', 'username webauthn');
    await user.click(screen.getByRole('button', { name: '다른 방법으로 로그인' }));
    expect(screen.getByRole('button', { name: '패스키로 로그인' })).toBeInTheDocument();
  });

  it('패스키 미지원이면 버튼 없이 이메일 입력부터 보여 줌', async () => {
    webauthn.supported = false;
    renderWithApp(<App />, '/login');
    expect(await screen.findByLabelText('이메일')).toHaveAttribute('autocomplete', 'username');
    expect(screen.queryByRole('button', { name: '패스키로 로그인' })).toBeNull();
    expect(screen.queryByRole('button', { name: '다른 방법으로 로그인' })).toBeNull();
  });

  it('패스키로 로그인하면 원래 보던 화면으로 돌아감', async () => {
    seedPasskey(admin, 'cred-admin');
    webauthn.startAuthentication.mockResolvedValue(assertion('cred-admin'));
    const user = userEvent.setup();
    renderWithApp(<App />, '/login?redirect=%2Fpopular');
    await user.click(await screen.findByRole('button', { name: '패스키로 로그인' }));
    await waitFor(() => expect(currentLocation).toBe('/popular'));
    expect(webauthn.startAuthentication.mock.calls[0][0].optionsJSON).toMatchObject({ userVerification: 'required', allowCredentials: [] });
    expect(mockPasskeys.items[0].lastUsedAt).not.toBeNull();
  });

  it('등록 안 된 패스키는 안내하고, 취소는 오류로 보이지 않음', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/login');
    webauthn.startAuthentication.mockResolvedValueOnce(assertion('unknown'));
    await user.click(await screen.findByRole('button', { name: '패스키로 로그인' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이 패스키로 가입된 계정을 찾을 수 없어요');
    webauthn.startAuthentication.mockRejectedValueOnce(Object.assign(new Error('cancel'), { name: 'NotAllowedError' }));
    await user.click(screen.getByRole('button', { name: '패스키로 로그인' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '패스키로 로그인' })).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('이메일 입력 상태에서 자동완성으로 고른 패스키로도 로그인함', async () => {
    webauthn.autofill = true;
    seedPasskey(admin, 'cred-admin');
    let pick: (v: unknown) => void = () => undefined;
    webauthn.startAuthentication.mockImplementation(() => new Promise((resolve) => (pick = resolve)));
    const user = userEvent.setup();
    renderWithApp(<App />, '/login?redirect=%2Fsecurity');
    await user.click(await screen.findByRole('button', { name: '이메일로 계속하기' }));
    await waitFor(() => expect(webauthn.startAuthentication).toHaveBeenCalledWith(expect.objectContaining({ useBrowserAutofill: true })));
    pick(assertion('cred-admin'));
    await waitFor(() => expect(currentLocation).toBe('/security'));
  });

  it.each([
    ['AbortError'],
    ['NotSupportedError'],
    ['InvalidStateError'],
    ['SecurityError'],
    ['Error'],
  ])('자동완성 요청이 %s로 끝나도 오류를 보이지 않음', async (name) => {
    webauthn.autofill = true;
    webauthn.startAuthentication.mockRejectedValue(Object.assign(new Error('x'), { name }));
    const user = userEvent.setup();
    renderWithApp(<App />, '/login');
    await user.click(await screen.findByRole('button', { name: '이메일로 계속하기' }));
    await waitFor(() => expect(webauthn.startAuthentication).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('자동완성 옵션 요청이 실패해도 조용함, 고른 패스키가 서버에서 거부되면 안내함', async () => {
    webauthn.autofill = true;
    server.use(http.post('*/api/auth/passkeys/login/options', () => HttpResponse.json({ code: 'INTERNAL', message: 'x' }, { status: 500 }), { once: true }));
    const user = userEvent.setup();
    const view = renderWithApp(<App />, '/login');
    await user.click(await screen.findByRole('button', { name: '이메일로 계속하기' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(webauthn.startAuthentication).not.toHaveBeenCalled();
    view.unmount();

    webauthn.startAuthentication.mockResolvedValue(assertion('unknown'));
    renderWithApp(<App />, '/login');
    await user.click(await screen.findByRole('button', { name: '이메일로 계속하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이 패스키로 가입된 계정을 찾을 수 없어요');
  });

  it('자동완성 미지원이면 요청하지 않음', async () => {
    webauthn.autofill = false;
    const user = userEvent.setup();
    renderWithApp(<App />, '/login');
    await user.click(await screen.findByRole('button', { name: '이메일로 계속하기' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(webauthn.startAuthentication).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('가입 → 패스키 만들기 → 로그아웃 → 패스키 로그인', async () => {
    webauthn.startRegistration.mockResolvedValue(assertion('cred-new'));
    const user = userEvent.setup();
    const view = renderWithApp(<App />, '/signup?redirect=%2Fpopular');
    expect(await screen.findByRole('heading', { name: 'formulous 계정 만들기' })).toBeInTheDocument();
    expect(screen.queryByLabelText('비밀번호 확인')).toBeNull();
    await user.type(screen.getByLabelText('이메일'), 'new@devfeed.dev');
    await user.type(screen.getByLabelText('비밀번호'), 'abcd1234');
    await user.click(screen.getByRole('button', { name: '비밀번호 보기' }));
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'text');
    await user.type(screen.getByLabelText('닉네임'), '지훈');
    await user.click(screen.getByRole('button', { name: '가입하기' }));

    await waitFor(() => expect(currentLocation).toBe('/onboarding/passkey?redirect=%2Fpopular'));
    await user.click(await screen.findByRole('button', { name: '패스키 만들기' }));
    await waitFor(() => expect(currentLocation).toBe('/onboarding/tags?redirect=%2Fpopular'));
    expect(webauthn.startRegistration.mock.calls[0][0].optionsJSON.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required',
    });
    expect(mockPasskeys.items).toHaveLength(1);
    expect(mockPasskeys.items[0].credentialId).toBe('cred-new');
    view.unmount();

    const { logout } = await import('@/api/auth');
    await logout();
    webauthn.startAuthentication.mockResolvedValue(assertion('cred-new'));
    renderWithApp(<App />, '/login?redirect=%2Fsecurity');
    await user.click(await screen.findByRole('button', { name: '패스키로 로그인' }));
    await waitFor(() => expect(currentLocation).toBe('/onboarding/tags?redirect=%2Fsecurity'));
  });

  it('가입 후 "나중에"는 관심 태그로, 일반 로그인에는 패스키 단계가 없음', async () => {
    const user = userEvent.setup();
    const view = renderWithApp(<App />, '/signup');
    await user.type(await screen.findByLabelText('이메일'), 'later@devfeed.dev');
    await user.type(screen.getByLabelText('비밀번호'), 'abcd1234');
    await user.type(screen.getByLabelText('닉네임'), '나중');
    await user.click(screen.getByRole('button', { name: '가입하기' }));
    await user.click(await screen.findByRole('button', { name: '나중에' }));
    await waitFor(() => expect(currentLocation).toBe('/onboarding/tags'));
    view.unmount();
    const { logout } = await import('@/api/auth');
    await logout();

    renderWithApp(<App />, '/login');
    await user.click(await screen.findByRole('button', { name: '이메일로 계속하기' }));
    await user.type(screen.getByLabelText('이메일'), 'user@devfeed.dev');
    await user.type(screen.getByLabelText('비밀번호'), 'pw');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(currentLocation).toBe('/onboarding/tags'));
  });

  it('패스키 미지원이면 가입 후 바로 관심 태그로 감', async () => {
    webauthn.supported = false;
    const user = userEvent.setup();
    renderWithApp(<App />, '/signup');
    await user.type(await screen.findByLabelText('이메일'), 'nopk@devfeed.dev');
    await user.type(screen.getByLabelText('비밀번호'), 'abcd1234');
    await user.type(screen.getByLabelText('닉네임'), '없음이');
    await user.click(screen.getByRole('button', { name: '가입하기' }));
    await waitFor(() => expect(currentLocation).toBe('/onboarding/tags'));
  });
});

describe('S-10 패스키 설정 (027)', () => {
  it('추가·이름 바꾸기·삭제', async () => {
    await seedLogin('user@devfeed.dev');
    webauthn.startRegistration.mockResolvedValue(assertion('cred-a'));
    const user = userEvent.setup();
    renderWithApp(<App />, '/me/settings');
    const section = within((await screen.findByRole('heading', { name: '패스키' })).closest('section')!);
    expect(await section.findByText('아직 패스키가 없어요')).toBeInTheDocument();

    await user.click(section.getByRole('button', { name: '패스키 추가' }));
    const list = within(await section.findByRole('list', { name: '패스키 목록' }));
    expect(list.getByText(/사용 전/)).toBeInTheDocument();
    const name = mockPasskeys.items[0].name;

    await user.click(list.getByRole('button', { name: `${name} 이름 바꾸기` }));
    const input = list.getByRole('textbox', { name: '패스키 이름' });
    await user.clear(input);
    expect(list.getByText('이름은 1~40자로 입력해 주세요')).toBeInTheDocument();
    await user.type(input, '회사 노트북');
    await user.click(list.getByRole('button', { name: '저장' }));
    expect(await list.findByText('회사 노트북')).toBeInTheDocument();

    await user.click(list.getByRole('button', { name: '회사 노트북 삭제' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '삭제' }));
    expect(await section.findByText('아직 패스키가 없어요')).toBeInTheDocument();
    expect(mockPasskeys.items).toHaveLength(0);
  });

  it('10개면 추가 버튼을 막고, 이미 등록된 패스키는 안내함', async () => {
    await seedLogin('user@devfeed.dev');
    const owner = { ...admin, email: 'user@devfeed.dev', nickname: 'user', role: 'USER' as const, onboardingCompleted: false };
    for (let i = 0; i < 9; i++) seedPasskey(owner, `cred-${i}`, `기기 ${i}`);
    webauthn.startRegistration.mockResolvedValueOnce(assertion('cred-0'));
    const user = userEvent.setup();
    renderWithApp(<App />, '/me/settings');
    const section = within((await screen.findByRole('heading', { name: '패스키' })).closest('section')!);
    await section.findByText('기기 0');
    await user.click(section.getByRole('button', { name: '패스키 추가' }));
    expect(await section.findByRole('alert')).toHaveTextContent('이미 등록된 패스키예요');
    webauthn.startRegistration.mockResolvedValueOnce(assertion('cred-9'));
    await user.click(section.getByRole('button', { name: '패스키 추가' }));
    await waitFor(() => expect(section.getAllByRole('listitem')).toHaveLength(10));
    expect(section.getByRole('button', { name: '패스키 추가' })).toBeDisabled();
  });

  it('패스키 미지원이면 설정에 섹션이 없음', async () => {
    webauthn.supported = false;
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/me/settings');
    await screen.findByRole('heading', { name: '프로필' });
    expect(screen.queryByRole('heading', { name: '패스키' })).toBeNull();
  });

  it('기기 이름은 기기·브라우저로 만듦', () => {
    expect(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36')).toBe('Mac Chrome');
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1')).toBe(
      'iPhone Safari',
    );
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0')).toBe('Windows Edge');
  });
});
