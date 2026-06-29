import { describe, it, expect } from 'vitest';
import { layoutToPixels } from './grid';
import type { HoleLayout } from '@/scenes/layout';

const sample: HoleLayout = {
  positions: [
    { index: 0, letter: 'A', row: 0, col: 0, xRatio: 0.5, yRatio: 0.5 },
    { index: 1, letter: 'B', row: 0, col: 1, xRatio: 0.25, yRatio: 0.75 }
  ]
};

describe('layoutToPixels', () => {
  it('converts each ratio to pixel coordinates (xRatio * w, yRatio * h)', () => {
    const out = layoutToPixels(sample, 1000, 800);
    expect(out).toEqual([
      { x: 500, y: 400 },
      { x: 250, y: 600 }
    ]);
  });

  it('returns one position per layout entry', () => {
    const out = layoutToPixels(sample, 1280, 720);
    expect(out).toHaveLength(sample.positions.length);
  });

  it('returns empty array for empty layout', () => {
    expect(layoutToPixels({ positions: [] }, 800, 600)).toEqual([]);
  });
});
