import type { AccountClient } from './AccountClient';
import type { User, UserProgress } from '@/types/user';
import type { LoginRequest, AuthResult } from '@/types/api';

const STORAGE_KEY = 'yunhou:mockAccount';

interface StoredAccount {
  user: User | null;
  token: string | null;
  progress: UserProgress | null;
}

function load(): StoredAccount {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { user: null, token: null, progress: null };
}

function save(s: StoredAccount) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export const mockAccount: AccountClient = {
  async getCurrentUser() {
    return load().user;
  },

  async login(req: LoginRequest) {
    const user: User = { id: 'mock_' + req.username, username: req.username };
    const token = 'mock_token_' + Date.now();
    const cur = load();
    save({ ...cur, user, token });
    return { user, token };
  },

  async logout() {
    save({ user: null, token: null, progress: null });
  },

  async saveProgress(progress: UserProgress) {
    const cur = load();
    save({ ...cur, progress });
  },

  async loadProgress() {
    return load().progress;
  },

  async unlockAchievement(id: string) {
    const cur = load();
    if (cur.progress) {
      cur.progress.unlockedAchievements = Array.from(new Set([...cur.progress.unlockedAchievements, id]));
      save(cur);
    }
  },

  async getAchievements() {
    const p = load().progress;
    if (!p) return [];
    return p.unlockedAchievements.map(id => ({ id, unlockedAt: Date.now() }));
  }
};
