import type { UserRole } from '../entities/user.entity';

export interface AccessTokenPayload {
  sub: number;
  role: UserRole;
}

export interface AuthUser {
  id: number;
  role: UserRole;
}
