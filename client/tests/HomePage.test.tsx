import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { mockPosts } from '@/mocks/fixtures';
import { currentLocation, renderWithApp } from './render';

describe('HomePage', () => {
  it('최신 피드 첫 페이지 20건을 보여줌', async () => {
    renderWithApp(<App />);
    expect(await screen.findByText(mockPosts[0].title)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '최신 피드' })).getAllByRole('article')).toHaveLength(20);
  });

  it('소스 유형 필터를 URL에 반영하고 결과를 거름', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />);
    await screen.findByText(mockPosts[0].title);
    await user.click(screen.getByRole('radio', { name: '개인' }));
    await waitFor(() => expect(currentLocation).toBe('/tech?sourceType=PERSONAL'));
    expect(await screen.findByRole('button', { name: '개인 필터 제거' })).toBeInTheDocument();
    await waitFor(() => {
      const names = screen.getAllByRole('article').map((a) => a.textContent ?? '');
      expect(names.every((t) => t.includes('개발자 김씨 블로그') || t.includes('프론트엔드 일지'))).toBe(true);
    });
  });

  it('URL 필터로 진입하면 그대로 적용함', async () => {
    renderWithApp(<App />, '/?sourceIds=1');
    await waitFor(() => {
      const articles = screen.getAllByRole('article');
      expect(articles.every((a) => a.textContent?.includes('토스 기술블로그'))).toBe(true);
    });
  });

  it('게스트가 북마크를 누르면 로그인 유도 모달을 띄움', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />);
    await screen.findByText(mockPosts[0].title);
    await user.click(screen.getAllByRole('button', { name: '북마크' })[0]);
    expect(screen.getByRole('dialog', { name: '로그인 필요' })).toBeInTheDocument();
  });

  it('비로그인으로 회원 화면 접근 시 로그인으로 이동함', async () => {
    renderWithApp(<App />, '/me/bookmarks');
    await waitFor(() => expect(currentLocation).toBe('/login?redirect=%2Fme%2Fbookmarks'));
  });
});
