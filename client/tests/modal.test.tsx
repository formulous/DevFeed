import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '@/components/common/Modal';

describe('Modal 형태 (039)', () => {
  it('기본은 가운데 작은 창: 모바일 최대 폭 320px, 손잡이 없음', () => {
    render(
      <Modal open onClose={() => {}} title="로그인 필요">
        본문
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: '로그인 필요' });
    expect(dialog).toHaveAttribute('data-variant', 'dialog');
    expect(dialog.className).toContain('max-w-[320px]');
    expect(dialog.parentElement!.className).toContain('p-6');
    expect(screen.queryByTestId('sheet-handle')).toBeNull();
  });

  it('시트는 아래에 붙고 85dvh, 손잡이·고정 하단 줄이 본문 스크롤 밖에 있음', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="관심 태그" variant="sheet" footer={<button type="button">저장</button>}>
        <p>본문</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: '관심 태그' });
    expect(dialog).toHaveAttribute('data-variant', 'sheet');
    expect(dialog.className).toContain('max-h-[85dvh]');
    expect(dialog.className).toContain('rounded-t-2xl');
    expect(dialog.parentElement!.className).toContain('items-end');
    expect(screen.getByTestId('sheet-handle')).toBeInTheDocument();
    const scroll = screen.getByText('본문').parentElement!;
    expect(scroll.className).toContain('overflow-y-auto');
    const footer = screen.getByRole('button', { name: '저장' }).parentElement!;
    expect(scroll.contains(footer)).toBe(false);
    expect(footer.className).toContain('safe-area-inset-bottom');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
