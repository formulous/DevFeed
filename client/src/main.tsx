import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, matchPath } from 'react-router';
import { App } from './App';
import { communityPostPage } from './lazyPages';
import { createQueryClient, Providers } from './Providers';
import { seedSeoPost } from './lib/seoData';
import './index.css';

const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_API_MOCK === 'false') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}

const ROUTE_PATH = window.location.pathname.slice(ROUTER_BASENAME === '/' ? 0 : ROUTER_BASENAME.length) || '/';

function preloadRoute() {
  if (matchPath('/community/posts/:id', ROUTE_PATH)) return communityPostPage.preload().catch(() => undefined);
  return undefined;
}

Promise.all([enableMocking(), preloadRoute()]).then(() => {
  const queryClient = createQueryClient();
  seedSeoPost(queryClient, ROUTE_PATH);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <Providers client={queryClient}>
          <App />
        </Providers>
      </BrowserRouter>
    </StrictMode>,
  );
});
