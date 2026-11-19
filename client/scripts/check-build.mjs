import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'dist';
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

if (problems.length) {
  console.error(`[check-build] ${outDir} 실패\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`[check-build] ${outDir}: mock 코드·워커 없음`);
