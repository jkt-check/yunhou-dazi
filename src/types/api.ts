import type { User } from './user';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface Achievement {
  id: string;
  unlockedAt: number;
}