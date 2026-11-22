import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withDeadlockRetry } from '../common/database/deadlock-retry';
import { Errors } from '../common/errors/app.exception';
import { setLikeEvent } from '../score/score-ledger';

type Affected = { affectedRows: number };

@Injectable()
export class LikesService {
  constructor(private readonly dataSource: DataSource) {}

  set(userId: number, postId: number, liked: boolean, now = new Date()): Promise<{ liked: boolean; likeCount: number }> {
    return withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
        const [post] = (await manager.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [postId])) as unknown[];
        if (!post) throw Errors.notFound('글을 찾을 수 없어요');
        const result = (await manager.query(
          liked
            ? 'INSERT IGNORE INTO post_likes (user_id, post_id) VALUES (?, ?)'
            : 'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
          [userId, postId],
        )) as Affected;
        if (result.affectedRows === 1) {
          await manager.query(`UPDATE posts SET like_count = like_count ${liked ? '+' : '-'} 1 WHERE id = ?`, [postId]);
          await setLikeEvent(manager, userId, postId, liked, now);
        }
        const [{ like_count }] = (await manager.query('SELECT like_count FROM posts WHERE id = ?', [postId])) as {
          like_count: number;
        }[];
        return { liked, likeCount: Number(like_count) };
      }),
    );
  }
}
