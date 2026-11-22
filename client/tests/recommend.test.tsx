import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { reasonText } from '@/features/recommend/reasons';
import { mockPosts } from '@/mocks/fixtures';
import { mockState } from '@/mocks/handlers';
import { server } from '@/mocks/node';
import { renderWithApp, seedLogin } from './render';
import { triggerIntersect } from './setup';

const feed = () => within(screen.getByRole('region', { name: '추천 피드' }));

describe('추천 이유 문구', () => {
  it('유형별 문구를 만들고 중복을 없앰', () => {
    expect(
      reasonText([
        { type: 'INTEREST_TAG', tagName: 'Kafka' },
        { type: 'READ_HISTORY', tagName: 'Redis' },
        { type: 'BOOKMARK' },
        { type: 'POPULAR' },
        { type: 'POPULAR' },
      ]),
    ).toBe('관심 태그 Kafka 관련 글이에요, 최근 읽은 Redis 글과 비슷해요, 북마크한 글과 비슷해요, 요즘 많이 읽혀요');
  });
});

describe('S-02 추천 피드', () => {
  it('비로그인은 로그인으로 보냄', async () => {
    renderWithApp(<App />, '/for-you');
    expect(await screen.findByRole('heading', { name: 'formulous에 로그인' })).toBeInTheDocument();
  });

  it('선호 데이터가 없으면 안내 배너와 온보딩 링크를 보여줌', async () => {
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/for-you');
    expect(await screen.findByText(/아직 취향 정보가 없어서/)).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: '관심 태그 고르기' });
    expect(links[0]).toHaveAttribute('href', '/onboarding/tags?redirect=%2Ffor-you');
    expect(feed().getAllByText(/추천 이유: 요즘 많이 읽혀요/).length).toBeGreaterThan(0);
  });

  it('관심 태그 기준 추천 이유와 편집 링크를 보여주고, 클릭 시 recommendationId를 보냄', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    mockState.interestTags = [1, 5, 7];
    renderWithApp(<App />, '/for-you');
    expect(await screen.findByRole('link', { name: '[편집]' })).toHaveAttribute('href', '/me/settings');
    expect(screen.queryByText(/아직 취향 정보가 없어서/)).not.toBeInTheDocument();
    const first = (await feed().findAllByRole('article'))[0];
    expect(first.parentElement).toHaveTextContent(/추천 이유: .*관심 태그/);
    await user.click(within(first).getByRole('link'));
    await waitFor(() => expect(mockState.recClicks).toHaveLength(1));
    expect(mockState.recClicks[0].recommendationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('INVALID_CURSOR면 첫 페이지부터 다시 받음', async () => {
    await seedLogin('user@devfeed.dev');
    const cursors: (string | null)[] = [];
    server.use(
      http.get('*/api/recommendations', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        if (cursor === 'expired') return HttpResponse.json({ code: 'INVALID_CURSOR', message: '만료' }, { status: 400 });
        const first = cursors.length === 1;
        return HttpResponse.json({
          items: mockPosts.slice(0, 2).map((p) => ({ ...p, reasons: [{ type: 'POPULAR' }] })),
          nextCursor: first ? 'expired' : null,
          recommendationId: crypto.randomUUID(),
          fallback: false,
        });
      }),
    );
    renderWithApp(<App />, '/for-you');
    await within(await screen.findByRole('region', { name: '추천 피드' })).findAllByRole('article');
    await act(async () => triggerIntersect());
    expect(await screen.findByText('추천 목록이 오래돼서 새로 불러왔어요')).toBeInTheDocument();
    await waitFor(() => expect(cursors).toEqual([null, 'expired', null]));
    expect(await feed().findAllByRole('article')).toHaveLength(2);
  });
});
