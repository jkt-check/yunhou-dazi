import { describe, it, expect } from 'vitest';
import { qwertyLayout } from './qwertyLayout';

describe('qwertyLayout', () => {
  it('has exactly 36 positions (10 digits + 26 letters)', () => {
    expect(qwertyLayout.positions).toHaveLength(36);
  });

  it('covers digits 0-9 and letters A-Z with no duplicates', () => {
    const chars = qwertyLayout.positions.map(p => p.letter).sort();
    const expected = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').sort();
    expect(chars).toEqual(expected);
  });

  it('indices are dense 0..35', () => {
    const indices = qwertyLayout.positions.map(p => p.index);
    expect(indices).toEqual(Array.from({ length: 36 }, (_, i) => i));
  });

  it('row 0 is the Mac number row 1-0 (10 keys)', () => {
    const row0 = qwertyLayout.positions.filter(p => p.row === 0);
    expect(row0).toHaveLength(10);
    expect(row0[0].letter).toBe('1');
    expect(row0[row0.length - 1].letter).toBe('0');
  });

  it('row 1 starts at Q and ends at P', () => {
    const row1 = qwertyLayout.positions.filter(p => p.row === 1);
    expect(row1[0].letter).toBe('Q');
    expect(row1[row1.length - 1].letter).toBe('P');
    expect(row1).toHaveLength(10);
  });

  it('row 2 starts at A and ends at L (9 letters)', () => {
    const row2 = qwertyLayout.positions.filter(p => p.row === 2);
    expect(row2[0].letter).toBe('A');
    expect(row2[row2.length - 1].letter).toBe('L');
    expect(row2).toHaveLength(9);
  });

  it('row 3 starts at Z and ends at M (7 letters)', () => {
    const row3 = qwertyLayout.positions.filter(p => p.row === 3);
    expect(row3[0].letter).toBe('Z');
    expect(row3[row3.length - 1].letter).toBe('M');
    expect(row3).toHaveLength(7);
  });

  it('rows are vertically ordered (yRatio increases row by row)', () => {
    const ys = [0, 1, 2, 3].map(r => {
      const p = qwertyLayout.positions.find(x => x.row === r)!;
      return p.yRatio;
    });
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    expect(ys[2]).toBeLessThan(ys[3]);
  });

  it('number row (row 0) sits leftmost; letter rows stagger right by 0.5u', () => {
    const r0First = qwertyLayout.positions.find(p => p.row === 0 && p.col === 0)!;
    const r1First = qwertyLayout.positions.find(p => p.row === 1 && p.col === 0)!;
    const r2First = qwertyLayout.positions.find(p => p.row === 2 && p.col === 0)!;
    const r3First = qwertyLayout.positions.find(p => p.row === 3 && p.col === 0)!;

    const d01 = r1First.xRatio - r0First.xRatio;
    const d12 = r2First.xRatio - r1First.xRatio;
    const d23 = r3First.xRatio - r2First.xRatio;

    expect(d01).toBeCloseTo(0.0425, 4); // 0.5 * KEY_UNIT
    expect(d12).toBeCloseTo(0.0425, 4);
    expect(d23).toBeCloseTo(0.0425, 4);
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
