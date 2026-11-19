import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { ErrorBoundary, isChunkLoadError } from '@/components/common/ErrorBoundary';
import { titleFor } from '@/components/layout/RouteTitle';
import { renderWithApp } from './render';

function Boom({ error }: { error: Error }): never {
  throw error;
}

describe('화면별 title', () => {
  it('경로별 제목을 만듦', () => {
    expect(titleFor('/', '')).toBe('최신 기술 글 · DevFeed');
    expect(titleFor('/search', '?q=%EC%B9%B4%ED%94%84%EC%B9%B4')).toBe('검색: 카프카 · DevFeed');
    expect(titleFor('/admin/sources/3/edit', '')).toBe('소스 수정 · DevFeed');
    expect(titleFor('/admin/sources/3', '')).toBe('소스 상세 · DevFeed');
    expect(titleFor('/nope', '')).toBe('페이지를 찾을 수 없음 · DevFeed');
  });

  it('라우트가 바뀌면 document.title을 갱신함', async () => {
    renderWithApp(<App />, '/popular');
    await waitFor(() => expect(document.title).toBe('인기 글 · DevFeed'));
  });
});

describe('ErrorBoundary', () => {
  it('청크 로드 오류를 구분함', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/A.js'))).toBe(true);
    expect(isChunkLoadError(new Error('x is undefined'))).toBe(false);
  });

  it('렌더링 오류면 안내와 새로고침 버튼을 보여줌', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary resetKey="/">
        <Boom error={new Error('boom')} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('화면을 그리다 문제가 생겼음');
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('청크 오류는 한 번만 자동 새로고침함', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    sessionStorage.clear();
    const chunk = new TypeError('Failed to fetch dynamically imported module: /assets/A.js');
    const { unmount } = render(
      <ErrorBoundary resetKey="/">
        <Boom error={chunk} />
      </ErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('새 버전이 배포됐음');
    unmount();
    render(
      <ErrorBoundary resetKey="/">
        <Boom error={chunk} />
      </ErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    sessionStorage.clear();
    spy.mockRestore();
  });
});
