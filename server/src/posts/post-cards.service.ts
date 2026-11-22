import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PopularIdsService } from './popular-ids.service';
import { assembleCards, PostRow, TagRow, UserFlags } from './post-cards';

@Injectable()
export class PostCardsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly popularIds: PopularIdsService,
  ) {}

  async load(ids: number[], userId?: number) {
    if (!ids.length) return [];
    const marks = ids.map(() => '?').join(', ');
    const [posts, tags, flags, popular] = await Promise.all([
      this.dataSource.query(
        `SELECT p.id, p.kind, p.title, p.summary, p.url, p.thumbnail_url, p.published_at, p.view_count, p.like_count, p.comment_count,
                s.id AS source_id, s.name AS source_name, s.logo_url AS source_logo_url, s.source_type,
                cp.category, cp.user_id AS author_id, cu.nickname AS author_nickname, cu.score AS author_score,
                cp.edited_at, cp.accepted_comment_id
           FROM posts p JOIN sources s ON s.id = p.source_id
           LEFT JOIN community_posts cp ON cp.post_id = p.id
           LEFT JOIN users cu ON cu.id = cp.user_id
          WHERE p.id IN (${marks})`,
        ids,
      ) as Promise<PostRow[]>,
      this.dataSource.query(
        `SELECT pt.post_id, t.id, t.name FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
          WHERE pt.post_id IN (${marks}) ORDER BY pt.post_id, pt.tag_rank`,
        ids,
      ) as Promise<TagRow[]>,
      userId === undefined ? Promise.resolve(undefined) : this.flags(userId, ids),
      this.popularIds.badgeSet(),
    ]);
    return assembleCards(ids, posts, tags, flags, popular);
  }

  async flags(userId: number, ids: number[]): Promise<UserFlags> {
    const marks = ids.map(() => '?').join(', ');
    const [bookmarked, read, liked] = await Promise.all([
      this.dataSource.query(`SELECT post_id FROM bookmarks WHERE user_id = ? AND post_id IN (${marks})`, [
        userId,
        ...ids,
      ]) as Promise<{ post_id: number | string }[]>,
      this.dataSource.query(`SELECT post_id FROM read_histories WHERE user_id = ? AND post_id IN (${marks})`, [
        userId,
        ...ids,
      ]) as Promise<{ post_id: number | string }[]>,
      this.dataSource.query(`SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (${marks})`, [
        userId,
        ...ids,
      ]) as Promise<{ post_id: number | string }[]>,
    ]);
    return {
      bookmarked: new Set(bookmarked.map((r) => Number(r.post_id))),
      read: new Set(read.map((r) => Number(r.post_id))),
      liked: new Set(liked.map((r) => Number(r.post_id))),
    };
  }
}
