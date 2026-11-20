import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const out = fileURLToPath(new URL('../public/og.png', import.meta.url));

const rows = [
  ['기업 블로그', '카프카 컨슈머 리밸런싱 줄이기'],
  ['개인 블로그', '대규모 트래픽에서 Redis 캐시 전략'],
  ['보안 뉴스', '공유기 펌웨어 원격 코드 실행 취약점 보안 권고'],
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#fbfbfc;color:#18181b;font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;padding:72px 88px;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:center}
.logo{font-size:30px;font-weight:700;letter-spacing:-0.02em}
.pill{border:1px solid #e8e8ec;border-radius:999px;padding:10px 22px;font-size:20px;color:#84848d}
h1{margin-top:64px;font-size:76px;font-weight:800;letter-spacing:-0.035em;line-height:1.05}
p.lead{margin-top:18px;font-size:28px;color:#55555e;letter-spacing:-0.01em}
.tabs{margin-top:34px;display:flex;gap:26px;font-size:22px;color:#55555e}
.tabs b{color:#18181b}
.list{margin-top:auto;border-top:1px solid #e8e8ec}
.row{display:flex;gap:18px;align-items:baseline;padding:14px 0;border-bottom:1px solid #e8e8ec;font-size:21px}
.row span{color:#84848d;width:180px;flex-shrink:0;font-size:18px}
.row em{font-style:normal;font-weight:600}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3d5a8f;margin-left:10px;vertical-align:middle}
</style></head><body>
<div class="top"><div class="logo">DevFeed</div><div class="pill">기술 글 검색…</div></div>
<h1>기술 블로그 통합 피드</h1>
<p class="lead">국내 기술 블로그와 보안 뉴스를 한곳에서 읽고, 검색하고, 추천받음</p>
<div class="tabs"><b>최신</b><span>추천</span><span>인기</span><span>기업 블로그</span><span>개인 블로그</span><span>보안 뉴스</span></div>
<div class="list">${rows.map(([s, t], i) => `<div class="row"><span>${s}</span><em>${t}</em>${i === 0 ? '<i class="dot"></i>' : ''}</div>`).join('')}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.screenshot({ path: out });
await browser.close();
console.log(`og image → ${out}`);
