import { achievementsStore } from '@/store';
import { mockAccount } from '@/services/mockAccount';

export async function renderProfile(root: HTMLElement) {
  const s = achievementsStore.get().stats;
  const user = await mockAccount.getCurrentUser();

  root.innerHTML = `
    <main class="page-profile">
      <h2>个人成就</h2>
      ${user
        ? `<p class="profile-user">👤 ${user.username}</p>`
        : `<p class="profile-user profile-user--guest">游客模式 (账户系统接入中)</p>`
      }
      <ul class="profile-stats">
        <li><span>累计命中</span><strong>${s.totalHits}</strong></li>
        <li><span>累计失误</span><strong>${s.totalMisses}</strong></li>
        <li><span>累计得分</span><strong>${s.totalScore}</strong></li>
        <li><span>历史最佳连击</span><strong>${s.bestCombo}</strong></li>
        <li><span>历史最佳平均反应</span><strong>${s.bestAvgResponseMs ? Math.round(s.bestAvgResponseMs) + 'ms' : '—'}</strong></li>
      </ul>
      <p><a href="#/" class="back-link">← 返回</a></p>
    </main>
  `;
}
