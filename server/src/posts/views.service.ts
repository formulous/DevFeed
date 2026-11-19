import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withDeadlockRetry } from '../common/database/deadlock-retry';
import { isMissingReference } from '../common/database/mysql-errors';
import { Errors } from '../common/errors/app.exception';
import { viewerKey } from '../common/visitor/visitor';
import { uuidToBuffer } from '../recommendations/snapshot';

export const VIEW_DEDUP_HOURS = 24;

@Injectable()
export class ViewsService {
  private readonly logger = new Logger(ViewsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async record(
    postId: number,
    viewer: { userId?: number; visitorId?: string },
    recommendationId?: string,
    now = new Date(),
  ): Promise<void> {
    const [exists] = (await this.dataSource.query('SELECT id FROM posts WHERE id = ?', [postId])) as unknown[];
    if (!exists) throw Errors.notFound('글을 찾을 수 없음');

    const threshold = new Date(now.getTime() - VIEW_DEDUP_HOURS * 60 * 60 * 1000);
    await withDeadlockRetry(async () => {
      const guard = (await this.dataSource.query(
        `INSERT INTO post_view_guards (post_id, viewer_key, counted_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE counted_at = IF(counted_at < ?, VALUES(counted_at), counted_at)`,
        [postId, viewerKey(viewer), now, threshold],
      )) as { affectedRows: number };
      if (guard.affectedRows > 0) {
        await this.dataSource.query('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [postId]);
      }
    });

    if (viewer.userId !== undefined) {
      await this.dataSource
        .query(
          `INSERT INTO read_histories (user_id, post_id, first_read_at, last_read_at) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE last_read_at = VALUES(last_read_at)`,
          [viewer.userId, postId, now, now],
        )
        .catch((error: unknown) => {
          if (!isMissingReference(error)) throw error;
        });
    }

    if (recommendationId && viewer.userId !== undefined) {
      await this.dataSource
        .query(
          `UPDATE recommendation_impressions SET clicked_at = COALESCE(clicked_at, ?)
            WHERE request_id = ? AND post_id = ? AND user_id = ?`,
          [now, uuidToBuffer(recommendationId), postId, viewer.userId],
        )
        .catch((error: Error) => this.logger.error(`추천 클릭 기록 실패: ${error.message}`));
    }
  }
}
