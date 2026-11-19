import { render } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { Providers } from '@/Providers';

export let currentLocation = '';

function LocationSpy() {
  const loc = useLocation();
  currentLocation = loc.pathname + loc.search;
  return null;
}

export function renderWithApp(ui: ReactElement, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Providers client={client}>
        {ui}
        <LocationSpy />
      </Providers>
    </MemoryRouter>,
  );
}

export async function seedLogin(email: string) {
  const { request } = await import('@/api/http');
  await request('/auth/login', { method: 'POST', json: { email, password: 'pw' } });
  const { setAccessToken } = await import('@/api/http');
  setAccessToken(null);
}
