import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { DataSource } from 'typeorm';
import { CommunityService } from '../community/community.service';
import { markdownExcerpt } from '../community/markdown-excerpt';
import type { CommunityCategory } from '../posts/post-cards';
import { escapeHtml } from './html';
import { HeadInput, inject, renderHead } from './inject';
import { markdownToSafeHtml } from './markdown-html';
import { fillPattern, matchRoute, normalizePath, SeoRoute, SeoRoutes } from './seo-routes';
import { WebTemplateService } from './web-template.service';

export const PAGE_TTL_MS = 5 * 60 * 1000;
export const PAGE_CACHE_MAX = 500;
export const DESCRIPTION_MAX = 120;
export const LD_TEXT_MAX = 2000;
export const PAGE_COMMENTS = 20;
export const LIST_POSTS = 20;

const CATEGORY_LABEL: Record<CommunityCategory, string> = { QUESTION: '질문', DISCUSSION: '토론', SHARE: '공유' };
const WITHDRAWN = '탈퇴한 사용자';
const POST_NOT_FOUND_TITLE = '글을 찾을 수 없어요';

export interface WebPage {
  status: number;
  html: string;
}

interface PageParts {
  status: number;
  head: HeadInput;
  body: string;
}

interface PostDetail {
  id: number;
  title: string;
  summary: string | null;
  body: string;
  status: string;
  publishedAt: string;
  acceptedCommentId: number | null;
  likeCount: number;
  commentCount: number;
  url: string;
  tags: { id: number; name: string }[];
  community: { category: CommunityCategory; author: { nickname: string } | null; editedAt: string | null };
}

interface CommentRow {
  id: number | string;
  body: string;
  created_at: Date;
  nickname: string | null;
}

@Injectable()
export class WebPagesService {
  private readonly cache = new Map<string, { at: number; parts: Promise<PageParts> }>();

  constructor(
    private readonly templates: WebTemplateService,
    private readonly community: CommunityService,
    private readonly dataSource: DataSource,
  ) {}

  async render(rawPath: string, now = Date.now()): Promise<WebPage | null> {
    const { template, routes } = await this.templates.assets(now);
    if (!template) return null;
    if (!routes) return { status: 200, html: template };
    const path = normalizePath(rawPath);
    const parts = await this.cached(path, now, () => this.parts(routes, path));
    return { status: parts.status, html: inject(template, renderHead(parts.head), parts.body) };
  }

  private cached(path: string, now: number, load: () => Promise<PageParts>): Promise<PageParts> {
    const hit = this.cache.get(path);
    if (hit && now - hit.at <= PAGE_TTL_MS) return hit.parts;
    const parts = load().catch((error) => {
      if (this.cache.get(path)?.parts === parts) this.cache.delete(path);
      throw error;
    });
    this.cache.delete(path);
    this.cache.set(path, { at: now, parts });
    while (this.cache.size > PAGE_CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    return parts;
  }

  private async parts(routes: SeoRoutes, path: string): Promise<PageParts> {
    const match = matchRoute(routes.routes, path);
    if (!match) return this.notFound(routes, routes.notFound.title);
    const { route, params } = match;
    if (route.dynamic && route.pattern === '/community/posts/:id') return this.postPage(routes, route, params);
    const head = this.staticHead(routes, route, params);
    if (route.pattern === '/community') return { status: 200, head, body: await this.communityList(route) };
    return { status: 200, head, body: '' };
  }

  private staticHead(routes: SeoRoutes, route: SeoRoute, params: Record<string, string>): HeadInput {
    return {
      title: route.title,
      description: route.description,
      robots: route.robots,
      canonicalUrl: route.canonical ? `${routes.origin}${fillPattern(route.canonical, params)}` : null,
      ogType: 'website',
    };
  }

  private notFound(routes: SeoRoutes, title: string): PageParts {
    return {
      status: 404,
      head: { ...this.staticHead(routes, routes.notFound, {}), title, canonicalUrl: null },
      body: '',
    };
  }

  private async postPage(routes: SeoRoutes, route: SeoRoute, params: Record<string, string>): Promise<PageParts> {
    const missing = () => this.notFound(routes, `${POST_NOT_FOUND_TITLE} · ${routes.siteName}`);
    if (!/^[1-9][0-9]{0,18}$/.test(params.id)) return missing();
    let post: PostDetail;
    try {
      post = (await this.community.detail(Number(params.id))) as unknown as PostDetail;
    } catch (error) {
      if (error instanceof AppException && error.status === 404) return missing();
      throw error;
    }
    if (post.status !== 'VISIBLE') return missing();
    post = JSON.parse(JSON.stringify(post)) as PostDetail;
    const comments = await this.comments(post);
    const author = post.community.author?.nickname ?? WITHDRAWN;
    const plain = markdownExcerpt(post.body, LD_TEXT_MAX);
    const description = (post.summary || plain).slice(0, DESCRIPTION_MAX);
    const canonical = `${routes.origin}${fillPattern(route.canonical, params)}`;
    return {
      status: 200,
      head: {
        title: `${post.title} · ${routes.siteName}`,
        description,
        robots: route.robots,
        canonicalUrl: canonical,
        ogType: 'article',
        article: { publishedTime: post.publishedAt, modifiedTime: post.community.editedAt, author },
        jsonLd: this.jsonLd(post, comments, canonical, author, plain),
        seoData: post,
      },
      body: this.postBody(post, comments, author),
    };
  }

  private async comments(post: PostDetail): Promise<CommentRow[]> {
    const rows = (await this.dataSource.query(
      `SELECT c.id, c.body, c.created_at, u.nickname FROM comments c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ? AND c.parent_id IS NULL AND c.status = 'VISIBLE'
        ORDER BY c.id LIMIT ?`,
      [post.id, PAGE_COMMENTS],
    )) as CommentRow[];
    if (post.acceptedCommentId === null || rows.some((r) => Number(r.id) === post.acceptedCommentId)) return rows;
    const accepted = (await this.dataSource.query(
      `SELECT c.id, c.body, c.created_at, u.nickname FROM comments c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.id = ? AND c.post_id = ? AND c.status = 'VISIBLE'`,
      [post.acceptedCommentId, post.id],
    )) as CommentRow[];
    return [...accepted, ...rows];
  }

  private postBody(post: PostDetail, comments: CommentRow[], author: string): string {
    const tags = post.tags.length ? `<ul>${post.tags.map((t) => `<li>${escapeHtml(t.name)}</li>`).join('')}</ul>` : '';
    const items = comments
      .map((c) => {
        const accepted = Number(c.id) === post.acceptedCommentId ? '<strong>채택된 답변</strong> ' : '';
        return `<li>${accepted}<span>${escapeHtml(c.nickname ?? WITHDRAWN)}</span> <time datetime="${c.created_at.toISOString()}">${c.created_at.toISOString().slice(0, 10)}</time><p>${escapeHtml(c.body)}</p></li>`;
      })
      .join('');
    return [
      '<article>',
      `<p>${escapeHtml(CATEGORY_LABEL[post.community.category])}</p>`,
      `<h1>${escapeHtml(post.title)}</h1>`,
      `<p><span>${escapeHtml(author)}</span> <time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(post.publishedAt.slice(0, 10))}</time></p>`,
      `<div>${markdownToSafeHtml(post.body)}</div>`,
      tags,
      '</article>',
      comments.length ? `<section><h2>댓글 ${post.commentCount}개</h2><ol>${items}</ol></section>` : '',
    ].join('');
  }

  private jsonLd(post: PostDetail, comments: CommentRow[], url: string, author: string, text: string): unknown {
    const person = (name: string | null) => ({ '@type': 'Person', name: name ?? WITHDRAWN });
    const comment = (c: CommentRow, type: 'Comment' | 'Answer') => ({
      '@type': type,
      text: c.body,
      dateCreated: c.created_at.toISOString(),
      author: person(c.nickname),
      ...(type === 'Answer' ? { url: `${url}#comment-${c.id}` } : {}),
    });
    const accepted = comments.find((c) => Number(c.id) === post.acceptedCommentId);
    if (post.community.category === 'QUESTION' && accepted) {
      return {
        '@context': 'https://schema.org',
        '@type': 'QAPage',
        mainEntity: {
          '@type': 'Question',
          name: post.title,
          text,
          answerCount: post.commentCount,
          dateCreated: post.publishedAt,
          author: person(author),
          acceptedAnswer: comment(accepted, 'Answer'),
          suggestedAnswer: comments.filter((c) => c !== accepted).map((c) => comment(c, 'Answer')),
        },
      };
    }
    return {
      '@context': 'https://schema.org',
      '@type': 'DiscussionForumPosting',
      headline: post.title,
      text,
      url,
      datePublished: post.publishedAt,
      ...(post.community.editedAt ? { dateModified: post.community.editedAt } : {}),
      author: person(author),
      commentCount: post.commentCount,
      interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: post.likeCount },
      comment: comments.map((c) => comment(c, 'Comment')),
    };
  }

  private async communityList(route: SeoRoute): Promise<string> {
    const rows = (await this.dataSource.query(
      `SELECT p.id, p.title, p.summary FROM community_posts cp JOIN posts p ON p.id = cp.post_id
        WHERE cp.status = 'VISIBLE' ORDER BY cp.published_at DESC, cp.post_id DESC LIMIT ?`,
      [LIST_POSTS],
    )) as { id: number | string; title: string; summary: string | null }[];
    const items = rows
      .map((r) => `<li><a href="/community/posts/${Number(r.id)}">${escapeHtml(r.title)}</a>${r.summary ? `<p>${escapeHtml(r.summary)}</p>` : ''}</li>`)
      .join('');
    return `<main><h1>${escapeHtml(route.title)}</h1><ul>${items}</ul></main>`;
  }
}
