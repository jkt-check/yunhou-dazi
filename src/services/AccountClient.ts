import type { User, UserProgress } from '@/types/user';
import type { LoginRequest, AuthResult } from '@/types/api';

export interface AccountClient {
  getCurrentUser(): Promise<User | null>;
  login(req: LoginRequest): Promise<AuthResult>;
  logout(): Promise<void>;
  saveProgress(progress: UserProgress): Promise<void>;
  loadProgress(): Promise<UserProgress | null>;
  getAchievements(): Promise<Array<{ id: string; unlockedAt: number }>>;
  unlockAchievement(id: string): Promise<void>;
}
