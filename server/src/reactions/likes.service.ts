import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withDeadlockRetry } from '../common/database/deadlock-retry';
import { Errors } from '../common/errors/app.exception';
import { setLikeEvent, setLikeReceived } from '../score/score-ledger';

type Affected = { affectedRows: number };

@Injectable()
export class LikesService {
  constructor(private readonly dataSource: DataSource) {}

  set(userId: number, postId: number, liked: boolean, now = new Date()): Promise<{ liked: boolean; likeCount: number }> {
    return withDeadlockRetry(async () => {
      const [info] = (await this.dataSource.query(
        'SELECT p.id, cp.user_id AS author_id FROM posts p LEFT JOIN community_posts cp ON cp.post_id = p.id WHERE p.id = ?',
        [postId],
      )) as { author_id: number | string | null }[];
      if (!info) throw Errors.notFound('글을 찾을 수 없어요');
      return this.dataSource.transaction(async (manager) => {
        const lockIds = [...new Set([userId, ...(info.author_id == null ? [] : [Number(info.author_id)])])].sort((a, b) => a - b);
        for (const id of lockIds) await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [id]);
        const [post] = (await manager.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [postId])) as unknown[];
        if (!post) throw Errors.notFound('글을 찾을 수 없어요');
        const [community] = (await manager.query(
          'SELECT status, user_id FROM community_posts WHERE post_id = ? FOR UPDATE',
          [postId],
        )) as { status: 'VISIBLE' | 'HIDDEN' | 'DELETED'; user_id: number | string | null }[];
        if (liked && community && community.status !== 'VISIBLE') throw Errors.communityPostClosed();
        const authorId = community?.user_id == null ? null : Number(community.user_id);
        const result = (await manager.query(
          liked
            ? 'INSERT IGNORE INTO post_likes (user_id, post_id) VALUES (?, ?)'
            : 'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
          [userId, postId],
        )) as Affected;
        if (result.affectedRows === 1) {
          await manager.query(`UPDATE posts SET like_count = like_count ${liked ? '+' : '-'} 1 WHERE id = ?`, [postId]);
          await setLikeEvent(manager, userId, postId, liked, now);
          if (authorId !== null && lockIds.includes(authorId)) await setLikeReceived(manager, authorId, postId, userId, liked, now);
        }
        const [{ like_count }] = (await manager.query('SELECT like_count FROM posts WHERE id = ?', [postId])) as {
          like_count: number;
        }[];
        return { liked, likeCount: Number(like_count) };
      });
    });
  }
}
