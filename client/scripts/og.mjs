import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const out = fileURLToPath(new URL('../public/og.png', import.meta.url));

const rows = [
  ['기술 뉴스', '카프카 컨슈머 리밸런싱 줄이기'],
  ['자유 게시판', '모노레포 vs 멀티레포, 5명 팀이면 뭐가 나을까요'],
  ['보안 뉴스', '공유기 펌웨어 원격 코드 실행 취약점 보안 권고'],
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#fbfbfc;color:#18181b;font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;padding:60px 88px 48px;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:center}
.logo{display:flex;align-items:center;gap:14px;font-size:32px;font-weight:700;letter-spacing:-0.02em}
.pill{border:1px solid #e8e8ec;border-radius:999px;padding:10px 22px;font-size:20px;color:#84848d}
h1{margin-top:40px;font-size:60px;font-weight:800;letter-spacing:-0.035em;line-height:1.05}
p.lead{margin-top:18px;font-size:28px;color:#55555e;letter-spacing:-0.01em}
.tabs{margin-top:22px;margin-bottom:28px;display:flex;gap:26px;font-size:22px;color:#55555e}
.tabs b{color:#18181b}
.list{margin-top:auto;border-top:1px solid #e8e8ec}
.row{display:flex;gap:18px;align-items:baseline;padding:14px 0;border-bottom:1px solid #e8e8ec;font-size:21px}
.row span{color:#84848d;width:180px;flex-shrink:0;font-size:18px}
.row em{font-style:normal;font-weight:600}
</style></head><body>
<div class="top"><div class="logo"><svg width="40" height="40" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#18181b"/><path d="M13.5 25V12.5a3.5 3.5 0 0 1 3.5-3.5h1.5M9.5 15.5h7.5" fill="none" stroke="#fafafa" stroke-width="3"/><circle cx="21.5" cy="23.5" r="2.3" fill="#8ea6d6"/></svg>formulous</div><div class="pill">formulous.org</div></div>
<h1>기술·보안 뉴스와<br>개발자 커뮤니티</h1>
<p class="lead">기술 블로그와 보안 뉴스를 한곳에서 읽고, 자유 게시판에서 묻고 나눠요</p>
<div class="tabs"><span>자유 게시판</span><b>기술 뉴스</b><span>보안 뉴스</span></div>
<div class="list">${rows.map(([s, t]) => `<div class="row"><span>${s}</span><em>${t}</em></div>`).join('')}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.screenshot({ path: out });
await browser.close();
console.log(`og image → ${out}`);
