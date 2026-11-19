import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${root}screenshots`;
const README_OUT = `${root}docs/screens`;
const WIDTHS = [360, 768, 1280];
const README_SET = ['S-01', 'S-02', 'S-04', 'A-01'];

const SCREENS = [
  { id: 'S-01', path: '/', auth: false, ready: 'article' },
  { id: 'S-03', path: '/popular', auth: false, ready: 'article' },
  { id: 'S-04', path: '/search?q=%EC%A0%95%EB%A6%AC', auth: false, ready: 'article' },
  { id: 'S-05', path: '/login', auth: false, ready: 'form' },
  { id: 'S-06', path: '/signup', auth: false, ready: 'form' },
  { id: 'S-07', path: '/onboarding/tags', auth: true, ready: '[aria-label="태그 목록"]' },
  { id: 'S-02', path: '/for-you', auth: true, ready: 'article' },
  { id: 'S-08', path: '/me/bookmarks', auth: true, ready: 'article' },
  { id: 'S-09', path: '/me/history', auth: true, ready: 'article' },
  { id: 'S-10', path: '/me/settings', auth: true, ready: '[aria-label="관심 태그"]' },
  { id: 'A-01', path: '/admin', auth: true, ready: 'table, ul a[href^="/admin/sources/"]' },
  { id: 'A-02', path: '/admin/sources/1', auth: true, ready: 'h1' },
  { id: 'A-03', path: '/admin/sources/new', auth: true, ready: 'form' },
  { id: 'A-04', path: '/admin/tags', auth: true, ready: 'table' },
];

async function spaNavigate(page, path) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function login(page, base) {
  await page.goto(`${base}/login`);
  await page.getByLabel('이메일').fill('admin@devfeed.dev');
  await page.getByLabel('비밀번호', { exact: true }).fill('pw1234');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(`${base}/`);
  await page.evaluate(() => {
    const s = window.__devfeedMock;
    const now = Date.now();
    s.interestTags = [1, 5, 7];
    [65, 60, 52, 47].forEach((id, i) => s.bookmarks.set(id, new Date(now - i * 3_600_000).toISOString()));
    [64, 58, 41, 33, 20].forEach((id, i) => s.reads.set(id, new Date(now - i * 20 * 3_600_000).toISOString()));
  });
}

async function main() {
  const server = await createServer({ root, server: { port: 5199, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const base = 'http://localhost:5199';
  const browser = await chromium.launch();
  const overflow = [];
  try {
    for (const width of WIDTHS) {
      await mkdir(`${OUT}/${width}`, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, locale: 'ko-KR' });
      await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
      const page = await context.newPage();
      await page.goto(base);
      let loggedIn = false;
      for (const screen of SCREENS) {
        if (screen.auth && !loggedIn) {
          await login(page, base);
          loggedIn = true;
        }
        await spaNavigate(page, screen.path);
        await page.locator(screen.ready).filter({ visible: true }).first().waitFor({ timeout: 10_000 });
        await page.mouse.move(0, 899);
        await page.waitForTimeout(300);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (wide > 0) overflow.push(`${screen.id} @${width}px: +${wide}px`);
        await page.screenshot({ path: `${OUT}/${width}/${screen.id}.png`, fullPage: true });
        await page.screenshot({ path: `${OUT}/${width}/${screen.id}.top.png` });
      }
      await context.close();
    }
    for (const width of WIDTHS) {
      const cols = width === 360 ? 7 : width === 768 ? 5 : 4;
      const imgs = await Promise.all(
        SCREENS.map(async (s) => {
          const b64 = (await readFile(`${OUT}/${width}/${s.id}.top.png`)).toString('base64');
          return `<figure><figcaption>${s.id}</figcaption><img src="data:image/png;base64,${b64}"></figure>`;
        }),
      );
      const page = await browser.newPage({ viewport: { width: cols * (width + 16), height: 600 } });
      await page.setContent(
        `<style>body{margin:0;display:grid;grid-template-columns:repeat(${cols},${width}px);gap:16px;background:#888;font:bold 20px sans-serif}figure{margin:0}img{width:${width}px;display:block}</style>${imgs.join('')}`,
      );
      await page.screenshot({ path: `${OUT}/overview-${width}.png`, fullPage: true });
      await page.close();
    }
    await mkdir(README_OUT, { recursive: true });
    for (const id of README_SET) await copyFile(`${OUT}/1280/${id}.top.png`, `${README_OUT}/${id}.png`);
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(`screens: ${SCREENS.length} x ${WIDTHS.length} → ${OUT}`);
  console.log(overflow.length ? `horizontal overflow:\n${overflow.join('\n')}` : 'horizontal overflow: none');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
