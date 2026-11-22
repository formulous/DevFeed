import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'dist';
const release = process.argv.includes('--release');
const problems = [];

try {
  await stat(join(outDir, 'mockServiceWorker.js'));
  problems.push('mockServiceWorker.js가 빌드 결과에 있음');
} catch {
  /* expected */
}

for (const file of await readdir(join(outDir, 'assets'))) {
  if (!file.endsWith('.js')) continue;
  const code = await readFile(join(outDir, 'assets', file), 'utf8');
  for (const marker of ['setupWorker', 'mockServiceWorker', '__devfeedMock']) {
    if (code.includes(marker)) problems.push(`${file}에 mock 코드(${marker})가 포함됨`);
  }
}

const STALE = ['/portfolio/', '/dev-feed/', 'DevFeed'];
const textFiles = [
  join(outDir, 'index.html'),
  ...['robots.txt', 'sitemap.xml'].map((f) => join(outDir, f)),
  ...(await readdir(join(outDir, 'assets'))).filter((f) => /\.(js|css)$/.test(f)).map((f) => join(outDir, 'assets', f)),
];
for (const file of textFiles) {
  const text = await readFile(file, 'utf8');
  for (const stale of STALE) if (text.includes(stale)) problems.push(`${file}에 옛 이름·주소(${stale})가 남음`);
}

if (release) {
  const ADS = 'google.com, pub-1750461537555326, DIRECT, f08c47fec0942fa0';
  const ads = await readFile(join(outDir, 'ads.txt'), 'utf8').catch(() => '');
  if (ads.trim() !== ADS) problems.push('ads.txt가 없거나 내용이 다름');
  const html = await readFile(join(outDir, 'index.html'), 'utf8');
  if (!html.includes('src="/assets/')) problems.push('index.html 자산 경로가 루트(/assets/) 기준이 아님');
}

if (problems.length) {
  console.error(`[check-build] ${outDir} 실패\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`[check-build] ${outDir}: mock 코드·워커·옛 이름·주소 없음${release ? ', ads.txt·루트 경로 확인' : ''}`);
