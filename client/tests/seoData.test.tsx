import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { App } from '@/App';
import { request } from '@/api/http';
import type { CommunityPost } from '@/api/types';
import { resetSeoPost, seedSeoPost } from '@/lib/seoData';
import { SOLVED_POST_ID } from '@/mocks/communityStore';
import { createQueryClient, Providers } from '@/Providers';

const FAKE_ID = 7_777_777;

async function putSeoData(text: string) {
  const el = document.createElement('script');
  el.type = 'application/json';
  el.id = 'seo-data';
  el.dataset.seo = 'seo-data';
  el.textContent = text;
  document.head.appendChild(el);
}

function renderAt(path: string) {
  const client = createQueryClient();
  seedSeoPost(client, path);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Providers client={client}>
        <App />
      </Providers>
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.getElementById('seo-data')?.remove();
  resetSeoPost();
});

describe('seo-data 첫 값', () => {
  it('server가 넣은 글 JSON으로 바로 그리고 다시 받지 않음', async () => {
    const real = await request<CommunityPost>(`/community/posts/${SOLVED_POST_ID}`);
    await putSeoData(JSON.stringify({ ...real, id: FAKE_ID, title: 'server가 넣은 글' }));
    renderAt(`/community/posts/${FAKE_ID}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'server가 넣은 글' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText('글을 찾을 수 없어요')).toBeNull();
  });

  it('주소의 글 id와 다르거나 깨진 JSON이면 쓰지 않음', async () => {
    const real = await request<CommunityPost>(`/community/posts/${SOLVED_POST_ID}`);
    await putSeoData(JSON.stringify({ ...real, id: FAKE_ID + 1 }));
    renderAt(`/community/posts/${FAKE_ID}`);
    expect(await screen.findByText('글을 찾을 수 없어요')).toBeInTheDocument();
    document.getElementById('seo-data')!.textContent = '{broken';
    resetSeoPost();
    expect(() => seedSeoPost(createQueryClient(), `/community/posts/${FAKE_ID}`)).not.toThrow();
  });
});
