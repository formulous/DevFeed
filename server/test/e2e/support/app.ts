import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';
import { viewerKey } from '../../../src/common/visitor/visitor';
import { removeReactions } from '../../../src/reactions/withdraw-reactions';

export interface TestApp {
  app: INestApplication;
  db: DataSource;
  base: string;
  runId: string;
  close(): Promise<void>;
}

export async function startApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource);
  const [{ name }] = (await db.query('SELECT DATABASE() AS name')) as { name: string }[];
  if (name !== 'devfeed_test') {
    await app.close();
    throw new Error(`연결된 DB가 devfeed_test가 아님: ${name}`);
  }
  const { port } = app.getHttpServer().address() as { port: number };
  return {
    app,
    db,
    base: `http://127.0.0.1:${port}/api`,
    runId: randomUUID().slice(0, 8),
    close: () => app.close(),
  };
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  cookies: string[];
}

export async function api<T = any>(
  t: TestApp,
  method: string,
  path: string,
  options: { token?: string; body?: unknown; cookie?: string } = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${t.base}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined, cookies: res.headers.getSetCookie() };
}

export function refreshCookieFrom(cookies: string[]): string {
  const raw = cookies.find((c) => c.startsWith('df_rt='));
  if (!raw) throw new Error('df_rt 쿠키 없음');
  return raw.split(';')[0];
}

export function uniqueEmail(t: TestApp, label: string): string {
  return `e2e-${t.runId}-${label}@devfeed.test`;
}

export async function signup(t: TestApp, label: string, password = 'pass1234') {
  const email = uniqueEmail(t, label);
  const res = await api(t, 'POST', '/auth/signup', { body: { email, password, nickname: `테스터${label}`.slice(0, 20) } });
  if (res.status !== 201) throw new Error(`signup ${res.status} ${JSON.stringify(res.body)}`);
  return { email, password, token: res.body.accessToken as string, userId: res.body.user.id as number, cookie: refreshCookieFrom(res.cookies) };
}

export async function createFixtures(t: TestApp, postCount = 3) {
  const source = (await t.db.query(
    `INSERT INTO sources (name, site_url, feed_url, source_type) VALUES (?, ?, ?, 'COMPANY')`,
    [`e2e ${t.runId}`, `https://e2e-${t.runId}.test`, `https://e2e-${t.runId}.test/feed.xml`],
  )) as { insertId: number };
  const sourceId = Number(source.insertId);
  const tagIds: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = (await t.db.query('INSERT INTO tags (name, slug) VALUES (?, ?)', [
      `E2E${t.runId}태그${i}`,
      `e2e-${t.runId}-${i}`,
    ])) as { insertId: number };
    tagIds.push(Number(r.insertId));
  }
  const postIds: number[] = [];
  for (let i = 0; i < postCount; i++) {
    const publishedAt = new Date(Date.UTC(2026, 10, 1, 0, i));
    const r = (await t.db.query(
      `INSERT INTO posts (source_id, source_type, url, title, summary, published_at) VALUES (?, 'COMPANY', ?, ?, ?, ?)`,
      [sourceId, `https://e2e-${t.runId}.test/p/${i}`, `e2e 글 ${i}`, '요약', publishedAt],
    )) as { insertId: number };
    const postId = Number(r.insertId);
    postIds.push(postId);
    await t.db.query('INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at) VALUES (?, ?, 1, ?)', [
      postId,
      tagIds[i % tagIds.length],
      publishedAt,
    ]);
  }
  return { sourceId, tagIds, postIds };
}

export async function cleanup(t: TestApp): Promise<void> {
  const like = `e2e-${t.runId}-%`;
  const users = (await t.db.query('SELECT id FROM users WHERE email LIKE ?', [like])) as { id: number | string }[];
  for (const { id } of users) await t.db.transaction((manager) => removeReactions(manager, Number(id)));
  await t.db.query('DELETE FROM users WHERE email LIKE ?', [like]);
  const sources = (await t.db.query('SELECT id FROM sources WHERE feed_url LIKE ?', [
    `https://e2e-${t.runId}.test/%`,
  ])) as { id: number }[];
  for (const { id } of sources) {
    await t.db.query(
      'DELETE FROM recommendation_impressions WHERE post_id IN (SELECT id FROM posts WHERE source_id = ?)',
      [id],
    );
    await t.db.query('DELETE FROM post_view_guards WHERE post_id IN (SELECT id FROM posts WHERE source_id = ?)', [id]);
    await t.db.query('DELETE FROM posts WHERE source_id = ?', [id]);
    await t.db.query('DELETE FROM crawl_runs WHERE source_id = ?', [id]);
    await t.db.query('DELETE FROM sources WHERE id = ?', [id]);
  }
  await t.db.query('DELETE FROM tags WHERE slug LIKE ?', [like]);
}

const WITHDRAWAL_CHECK = readFileSync(join(__dirname, '..', '..', '..', '..', 'db', 'queries', 'withdrawal-check.sql'), 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .trim()
  .replace(/;$/, '');

export async function residualPersonalData(t: TestApp, userId: number): Promise<Record<string, number>> {
  const runner = t.db.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('SET @uid = ?, @vkey = ?', [userId, viewerKey({ userId })]);
    const rows = (await runner.query(WITHDRAWAL_CHECK)) as { tbl: string; remaining: number | string }[];
    return Object.fromEntries(rows.map((r) => [r.tbl, Number(r.remaining)]));
  } finally {
    await runner.release();
  }
}

const REACTIONS_CHECK = (() => {
  const sql = readFileSync(join(__dirname, '..', '..', '..', '..', 'db', 'queries', 'reactions.sql'), 'utf8');
  return sql.slice(sql.indexOf('-- 026 consistency check')).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim().replace(/;$/, '');
})();

export async function reactionMismatches(t: TestApp): Promise<Record<string, number>> {
  const [row] = (await t.db.query(REACTIONS_CHECK)) as Record<string, number | string>[];
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
}
