import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Errors } from '../common/errors/app.exception';
import type { UserRole } from '../entities/user.entity';

export interface MeResponse {
  id: number;
  email: string;
  nickname: string;
  role: UserRole;
  hasInterestTags: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
}

@Injectable()
export class MeService {
  constructor(private readonly dataSource: DataSource) {}

  async get(userId: number): Promise<MeResponse> {
    const [row] = (await this.dataSource.query(
      `SELECT u.id, u.email, u.nickname, u.role, u.onboarding_completed_at, u.created_at,
              EXISTS (SELECT 1 FROM user_interest_tags t WHERE t.user_id = u.id) AS has_tags
         FROM users u WHERE u.id = ?`,
      [userId],
    )) as {
      id: number | string;
      email: string;
      nickname: string;
      role: UserRole;
      onboarding_completed_at: Date | null;
      created_at: Date;
      has_tags: number | string;
    }[];
    if (!row) throw Errors.unauthenticated();
    return {
      id: Number(row.id),
      email: row.email,
      nickname: row.nickname,
      role: row.role,
      hasInterestTags: Number(row.has_tags) === 1,
      onboardingCompleted: row.onboarding_completed_at !== null,
      createdAt: row.created_at,
    };
  }
}
