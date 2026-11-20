import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { currentLocation, renderWithApp, seedLogin } from './render';

const SLOW = 10_000;

describe('관리자 접근', () => {
  it('일반 회원은 권한 없음 화면을 봄', async () => {
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/admin');
    expect(await screen.findByText('접근 권한이 없음')).toBeInTheDocument();
  });
});

describe('A-01 수집 현황', () => {
  it('요약과 소스 목록, 상태 필터를 보여줌', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(15);
    await user.click(screen.getByRole('radio', { name: '오류' }));
    await waitFor(() => expect(currentLocation).toBe('/admin?status=ERROR'));
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2));
    expect(within(screen.getByRole('table')).getByText('개발자 김씨 블로그')).toBeInTheDocument();
  });
});

describe('A-02 소스 상세', () => {
  it(
    '지금 수집 후 진행 중 표시, 완료되면 성공으로 갱신함',
    async () => {
      const user = userEvent.setup();
      await seedLogin('admin@devfeed.dev');
      renderWithApp(<App />, '/admin/sources/1');
      await user.click(await screen.findByRole('button', { name: '지금 수집' }));
      expect(await screen.findByRole('button', { name: '수집 중' })).toBeDisabled();
      expect(screen.getAllByText('진행 중').length).toBeGreaterThan(0);
      await screen.findByRole('button', { name: '지금 수집' }, { timeout: SLOW });
      expect(screen.queryByText('진행 중')).not.toBeInTheDocument();
    },
    SLOW + 2000,
  );

  it('비활성화는 확인 후 반영함', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin/sources/2');
    await user.click(await screen.findByRole('button', { name: '비활성화' }));
    const dialog = screen.getByRole('dialog', { name: '소스 비활성화' });
    await user.click(within(dialog).getByRole('button', { name: '비활성화' }));
    expect(await screen.findByRole('button', { name: '활성화' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지금 수집' })).toBeDisabled();
  });

  it('오류 상태 소스는 재개할 수 있음', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin/sources/7');
    await user.click(await screen.findByRole('button', { name: '재개' }));
    expect(await screen.findByText('수집을 재개했음')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: '재개' })).not.toBeInTheDocument());
  });
});

describe('A-03 소스 등록', () => {
  async function fillBase(user: ReturnType<typeof userEvent.setup>, feedUrl: string) {
    await user.type(await screen.findByLabelText('이름'), '새 블로그');
    await user.type(screen.getByLabelText('블로그 URL'), 'https://new.example.com');
    await user.type(screen.getByLabelText('피드 URL (RSS/Atom)'), feedUrl);
  }

  it('검증 통과 전에는 저장할 수 없고, 통과 후 저장하면 상세로 이동함', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin/sources/new');
    await fillBase(user, 'https://new.example.com/invalid');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '검증' }));
    expect(await screen.findByText(/유효하지 않은 피드임/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('피드 URL (RSS/Atom)'));
    await user.type(screen.getByLabelText('피드 URL (RSS/Atom)'), 'https://new.example.com/rss');
    await user.click(screen.getByRole('button', { name: '검증' }));
    expect(await screen.findByText(/유효한 RSS임/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(currentLocation).toBe('/admin/sources/100'));
    expect(await screen.findByRole('heading', { name: '새 블로그' })).toBeInTheDocument();
  });

  it('이미 등록된 피드 URL이면 중복 안내 후 저장을 막음', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin/sources/new');
    await fillBase(user, 'https://blog1.example.com/rss');
    await user.click(screen.getByRole('button', { name: '검증' }));
    expect(await screen.findByText(/이미 있음/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('수정 화면은 피드 URL을 안 바꾸면 검증 없이 저장함', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin/sources/3/edit');
    const interval = await screen.findByLabelText('수집 주기');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    await user.clear(interval);
    await user.type(interval, '10');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('30~1440분 사이 정수여야 함')).toBeInTheDocument();
    await user.clear(interval);
    await user.type(interval, '120');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(currentLocation).toBe('/admin/sources/3'));
    expect(await screen.findByText(/120분/)).toBeInTheDocument();
  });
});

describe('A-04 태그 사전', () => {
  it('중복 태그 추가 시 서버 오류를 보여줌', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin/tags');
    await user.click(await screen.findByRole('button', { name: '+ 태그 추가' }));
    const dialog = screen.getByRole('dialog', { name: '태그 추가' });
    await user.type(within(dialog).getByLabelText('태그 이름'), 'Kafka');
    expect(within(dialog).getByLabelText('slug')).toHaveValue('kafka');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('같은 이름 또는 slug의 태그가 있음');
  });

  it('태그를 추가하면 목록에 나타남', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin/tags');
    await user.click(await screen.findByRole('button', { name: '+ 태그 추가' }));
    const dialog = screen.getByRole('dialog', { name: '태그 추가' });
    await user.type(within(dialog).getByLabelText('태그 이름'), 'Spring Boot');
    await user.type(within(dialog).getByLabelText('동의어 (쉼표로 구분)'), '스프링부트, , 스프링부트');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('spring-boot')).toBeInTheDocument();
  });

  it(
    '재태깅 진행률을 폴링해 완료까지 보여줌',
    async () => {
      const user = userEvent.setup();
      await seedLogin('admin@devfeed.dev');
      renderWithApp(<App />, '/admin/tags');
      await user.click(await screen.findByRole('button', { name: '전체 재태깅 실행' }));
      await user.click(within(screen.getByRole('dialog', { name: '전체 재태깅' })).getByRole('button', { name: '실행' }));
      expect(await screen.findByRole('progressbar', { name: '재태깅 진행률' })).toBeInTheDocument();
      expect(await screen.findByText('재태깅 완료', {}, { timeout: SLOW })).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    },
    SLOW + 2000,
  );
});

describe('021 소스 종류·지역', () => {
  it('A-01 종류 필터로 보안 뉴스만 보고, 종류·지역을 표시함', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin');
    await screen.findByRole('table');
    await user.click(screen.getByRole('radio', { name: '보안 뉴스' }));
    await waitFor(() => expect(currentLocation).toBe('/admin?kind=SECURITY_NEWS'));
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(7));
    expect(within(screen.getByRole('table')).getAllByText('보안 뉴스 · 국내')).toHaveLength(3);
  });

  it('A-03 보안 뉴스 등록: 유형 대신 지역을 고르고, 수정 화면에서는 종류를 바꿀 수 없음', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/admin/sources/new');
    await user.click(await screen.findByRole('radio', { name: '보안 뉴스' }));
    expect(screen.queryByRole('group', { name: '유형' })).toBeNull();
    await user.click(screen.getByRole('radio', { name: '해외' }));
    await user.type(screen.getByLabelText('이름'), '새 보안 매체');
    await user.type(screen.getByLabelText('사이트 URL'), 'https://news.example.com');
    await user.type(screen.getByLabelText('피드 URL (RSS/Atom)'), 'https://news.example.com/rss');
    await user.click(screen.getByRole('button', { name: '검증' }));
    await screen.findByText(/유효한 RSS임/);
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(currentLocation).toBe('/admin/sources/100'));
    expect(await screen.findByText(/보안 뉴스 · 해외/)).toBeInTheDocument();

    renderWithApp(<App />, '/admin/sources/100/edit');
    expect(await screen.findByText('(등록 후 바꿀 수 없음)')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '기술 블로그' })).toBeNull();
  });
});
