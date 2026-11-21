import type { CommentStatus } from '../entities/comment.entity';

export interface CommentRow {
  id: number | string;
  post_id: number | string;
  parent_id: number | string | null;
  user_id: number | string | null;
  body: string | null;
  status: CommentStatus;
  reply_count: number;
  edited_at: Date | null;
  created_at: Date;
  nickname: string | null;
}

export interface Viewer {
  id: number;
  role: 'USER' | 'ADMIN';
}

export interface CommentView {
  id: number;
  postId: number;
  parentId: number | null;
  status: CommentStatus;
  content: string | null;
  author: { id: number; nickname: string } | null;
  createdAt: Date;
  editedAt: Date | null;
  mine: boolean;
  replyCount: number;
}

export function toCommentView(row: CommentRow, viewer?: Viewer): CommentView {
  const userId = row.user_id === null ? null : Number(row.user_id);
  const visible = row.status === 'VISIBLE' || (row.status === 'HIDDEN' && viewer?.role === 'ADMIN');
  return {
    id: Number(row.id),
    postId: Number(row.post_id),
    parentId: row.parent_id === null ? null : Number(row.parent_id),
    status: row.status,
    content: visible ? row.body : null,
    author: visible && userId !== null && row.nickname !== null ? { id: userId, nickname: row.nickname } : null,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    mine: viewer !== undefined && userId !== null && userId === viewer.id,
    replyCount: row.parent_id === null ? Number(row.reply_count) : 0,
  };
}
