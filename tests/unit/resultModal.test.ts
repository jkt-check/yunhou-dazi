import { describe, it, expect, beforeEach } from 'vitest';
import { renderResultModal } from '@/ui/resultModal';
import type { StarRating } from '@/core/rating';

describe('renderResultModal', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('renders 3 filled stars for 3-star rating', () => {
    renderResultModal(root, {
      outcome: 'won',
      title: '🎉 通关',
      stats: { levelId: 0, score: 500, hits: 30, misses: 0, maxCombo: 25, avgResponseMs: 800, durationMs: 60000 },
      stars: 3 as StarRating
    });
    const stars = root.querySelectorAll('.star');
    expect(stars).toHaveLength(3);
    expect(stars[0].classList.contains('star--filled')).toBe(true);
    expect(stars[1].classList.contains('star--filled')).toBe(true);
    expect(stars[2].classList.contains('star--filled')).toBe(true);
  });

  it('renders 1 filled and 2 empty stars for 1-star rating', () => {
    renderResultModal(root, {
      outcome: 'won',
      title: '🎉 通关',
      stats: { levelId: 0, score: 200, hits: 10, misses: 3, maxCombo: 5, avgResponseMs: 1500, durationMs: 60000 },
      stars: 1 as StarRating
    });
    const stars = root.querySelectorAll('.star');
    expect(stars[0].classList.contains('star--filled')).toBe(true);
    expect(stars[1].classList.contains('star--filled')).toBe(false);
    expect(stars[2].classList.contains('star--filled')).toBe(false);
  });

  it('shows encouragement text for failed outcome', () => {
    renderResultModal(root, {
      outcome: 'lost',
      title: '继续加油!',
      stats: { levelId: 0, score: 50, hits: 5, misses: 8, maxCombo: 0, avgResponseMs: 2000, durationMs: 60000 },
      stars: 0 as StarRating
    });
    expect(root.querySelector('.modal-encouragement')).not.toBeNull();
  });

  it('does not show stars for failed outcome', () => {
    renderResultModal(root, {
      outcome: 'lost',
      title: '继续加油!',
      stats: { levelId: 0, score: 50, hits: 5, misses: 8, maxCombo: 0, avgResponseMs: 2000, durationMs: 60000 },
      stars: 0 as StarRating
    });
    expect(root.querySelector('.star-rating')).toBeNull();
  });

  it('renders replay and home buttons', () => {
    renderResultModal(root, {
      outcome: 'won',
      title: '🎉 通关',
      stats: { levelId: 0, score: 500, hits: 30, misses: 0, maxCombo: 25, avgResponseMs: 800, durationMs: 60000 },
      stars: 3 as StarRating
    });
    expect(root.querySelector('[data-action="replay"]')).not.toBeNull();
    expect(root.querySelector('a[href="#/"]')).not.toBeNull();
  });
});
