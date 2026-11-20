import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { currentLocation, renderWithApp } from './render';

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('이메일'), email);
  await user.type(screen.getByLabelText('비밀번호'), password);
  await user.click(screen.getByRole('button', { name: '로그인' }));
}

describe('LoginPage', () => {
  it('로그인 후 redirect 경로로 복귀함', async () => {
    renderWithApp(<App />, '/login?redirect=%2Fadmin');
    await fillAndSubmit('admin@devfeed.dev', 'pw');
    await waitFor(() => expect(currentLocation).toBe('/admin'));
  });

  it('온보딩 미완료 회원은 온보딩으로 보냄', async () => {
    renderWithApp(<App />, '/login?redirect=%2Fpopular');
    await fillAndSubmit('user@devfeed.dev', 'pw');
    await waitFor(() => expect(currentLocation).toBe('/onboarding/tags?redirect=%2Fpopular'));
  });

  it('잘못된 자격 증명이면 오류 문구를 보여줌', async () => {
    renderWithApp(<App />, '/login');
    await fillAndSubmit('user@devfeed.dev', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('이메일 또는 비밀번호가 맞지 않아요');
  });

  it('로그인 잠김이면 남은 시간과 함께 버튼을 막음', async () => {
    renderWithApp(<App />, '/login');
    await fillAndSubmit('user@devfeed.dev', 'locked');
    expect(await screen.findByRole('alert')).toHaveTextContent('10분 0초');
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled();
  });
});
