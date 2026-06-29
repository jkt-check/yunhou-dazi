import { describe, it, expect } from 'vitest';
import { qwertyLayout } from './qwertyLayout';

describe('qwertyLayout', () => {
  it('has exactly 26 positions', () => {
    expect(qwertyLayout.positions).toHaveLength(26);
  });

  it('letters cover the full alphabet A-Z with no duplicates', () => {
    const letters = qwertyLayout.positions.map(p => p.letter).sort();
    expect(letters).toEqual('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  });

  it('indices are dense 0..25', () => {
    const indices = qwertyLayout.positions.map(p => p.index);
    expect(indices).toEqual(Array.from({ length: 26 }, (_, i) => i));
  });

  it('row 0 starts at Q and ends at P', () => {
    const row0 = qwertyLayout.positions.filter(p => p.row === 0);
    expect(row0[0].letter).toBe('Q');
    expect(row0[row0.length - 1].letter).toBe('P');
    expect(row0).toHaveLength(10);
  });

  it('row 1 starts at A and ends at L (9 letters)', () => {
    const row1 = qwertyLayout.positions.filter(p => p.row === 1);
    expect(row1[0].letter).toBe('A');
    expect(row1[row1.length - 1].letter).toBe('L');
    expect(row1).toHaveLength(9);
  });

  it('row 2 starts at Z and ends at M (7 letters)', () => {
    const row2 = qwertyLayout.positions.filter(p => p.row === 2);
    expect(row2[0].letter).toBe('Z');
    expect(row2[row2.length - 1].letter).toBe('M');
    expect(row2).toHaveLength(7);
  });

  it('rows are vertically ordered (yRatio increases row by row)', () => {
    const ys = [0, 1, 2].map(r => {
      const p = qwertyLayout.positions.find(x => x.row === r)!;
      return p.yRatio;
    });
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it('row 1 first key is offset right of row 0 first key by 0.5 unit', () => {
    const r0First = qwertyLayout.positions.find(p => p.row === 0 && p.col === 0)!;
    const r1First = qwertyLayout.positions.find(p => p.row === 1 && p.col === 0)!;
    expect(r1First.xRatio).toBeGreaterThan(r0First.xRatio);
    const offset = r1First.xRatio - r0First.xRatio;
    expect(offset).toBeCloseTo(0.0425, 4);
  });

  it('row 2 first key is offset right of row 1 first key by 0.5 unit', () => {
    const r1First = qwertyLayout.positions.find(p => p.row === 1 && p.col === 0)!;
    const r2First = qwertyLayout.positions.find(p => p.row === 2 && p.col === 0)!;
    const offset = r2First.xRatio - r1First.xRatio;
    expect(offset).toBeCloseTo(0.0425, 4);
  });

  it('every position fits within the [0, 1] canvas-bound ratio box', () => {
    for (const p of qwertyLayout.positions) {
      expect(p.xRatio).toBeGreaterThanOrEqual(0);
      expect(p.xRatio).toBeLessThanOrEqual(1);
      expect(p.yRatio).toBeGreaterThanOrEqual(0);
      expect(p.yRatio).toBeLessThanOrEqual(1);
    }
  });
});
