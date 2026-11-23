import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { currentLocation, renderWithApp } from './render';

describe('검색창 커맨드 바 (041)', () => {
  it('문구는 "<범위>에서 찾기", 말줄임표 없음', async () => {
    renderWithApp(<App />, '/security');
    const input = await screen.findByRole('searchbox', { name: '검색어' });
    expect(input).toHaveAttribute('placeholder', '보안 뉴스에서 찾기');
    expect(input.getAttribute('placeholder')).not.toContain('…');
  });

  it('입력창 밖에서 / 를 누르면 검색창 포커스, 입력 중에는 동작 안 함', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech');
    const input = await screen.findByRole('searchbox', { name: '검색어' });
    expect(input).not.toHaveFocus();
    expect(screen.getByText('/', { selector: 'kbd' })).toBeInTheDocument();
    await user.keyboard('/');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
    await user.type(input, 'a/b');
    expect(input).toHaveValue('a/b');
  });

  it('Esc는 입력을 비우고, 한 번 더 누르면 포커스 해제', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech');
    const input = await screen.findByRole('searchbox', { name: '검색어' });
    await user.click(input);
    await user.type(input, 'kafka');
    expect(screen.getByText('↵ Enter')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).not.toHaveFocus();
  });

  it('입력 중에는 ✕로 비우고, 검색 동작은 그대로', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech');
    const input = await screen.findByRole('searchbox', { name: '검색어' });
    await user.type(input, 'redis');
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).toBeNull();
    await user.type(input, 'kafka{Enter}');
    expect(currentLocation).toBe('/search?q=kafka');
  });
});
