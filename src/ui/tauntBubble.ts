export class TauntBubble {
  private root: HTMLElement | null = null;

  mount(root: HTMLElement): void {
    this.root = root;
  }

  show(text: string, x: number, y: number, durationMs: number): void {
    if (!this.root) return;
    const bubble = document.createElement('div');
    bubble.className = 'taunt-bubble';
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    // Use textContent + DOM API instead of innerHTML to prevent XSS (CLAUDE.md §7)
    const textSpan = document.createElement('span');
    textSpan.className = 'taunt-text';
    textSpan.textContent = text;
    bubble.appendChild(textSpan);
    this.root.appendChild(bubble);

    // Caller-supplied lifetime — covers the taunt + retreating animation.
    // Game page passes TAUNT_MS + RETREATING_MS + 0ms buffer (550ms).
    setTimeout(() => bubble.remove(), durationMs);
  }

  destroy(): void {
    if (this.root) {
      this.root.querySelectorAll('.taunt-bubble').forEach(el => el.remove());
    }
  }
}