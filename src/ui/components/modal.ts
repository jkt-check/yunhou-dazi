export function showToast(message: string, icon: string = '✨'): void {
  const toast = document.createElement('div');
  toast.className = 'toast anim-pop';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-out'), 2000);
  setTimeout(() => toast.remove(), 2500);
}
