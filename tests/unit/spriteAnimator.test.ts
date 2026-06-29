import { describe, it, expect } from 'vitest';
import { SpriteAnimator, type AtlasEntry } from '@/render/spriteAnimator';

function makeAtlas(): AtlasEntry {
  // 256x256 frame, 8x8 grid (image dimensions are for shape; tests use spec.row/count)
  const img = { width: 2048, height: 2048, complete: true, naturalWidth: 2048 } as unknown as HTMLImageElement;
  return {
    src: '/sprites/test.png',
    image: img,
    frameSize: [256, 256],
    anchor: [128, 200],
    states: {
      idle:  { row: 0, count: 4, fps: 6,  loop: true  },
      hit:   { row: 1, count: 4, fps: 14, loop: false },
      taunt: { row: 3, count: 2, fps: 5,  loop: true  }
    }
  };
}

describe('SpriteAnimator', () => {
  it('starts on the first frame of the initial state', () => {
    const a = new SpriteAnimator(makeAtlas(), 'idle');
    expect(a.getState()).toBe('idle');
    expect(a.getFrameIndex()).toBe(0);  // row 0 * 8 + 0
  });

  it('setState changes state and resets frame', () => {
    const a = new SpriteAnimator(makeAtlas(), 'idle');
    a.tick(500);
    a.setState('hit');
    expect(a.getState()).toBe('hit');
    expect(a.getFrameIndex()).toBe(8);  // row 1 * 8 + 0
  });

  it('throws on unknown state', () => {
    const a = new SpriteAnimator(makeAtlas(), 'idle');
    expect(() => a.setState('nope')).toThrow(/unknown state/);
  });

  it('tick advances frames at spec.fps', () => {
    const a = new SpriteAnimator(makeAtlas(), 'hit');  // 4 frames @ 14fps => 71.43ms/frame
    a.tick(72);
    expect(a.getFrameIndex()).toBe(8 + 1);
    a.tick(72);
    expect(a.getFrameIndex()).toBe(8 + 2);
  });

  it('loop states wrap to frame 0', () => {
    const a = new SpriteAnimator(makeAtlas(), 'idle');  // 4 frames @ 6fps => 166.67ms/frame
    a.tick(170);
    a.tick(170);
    a.tick(170);
    a.tick(170);  // 4 frames advanced, should wrap
    expect(a.getFrameIndex()).toBe(0);
  });

  it('one-shot state fires onComplete after count frames and stays on last frame', () => {
    const a = new SpriteAnimator(makeAtlas(), 'hit');  // 4 frames @ 14fps
    let fired = 0;
    a.onComplete(() => { fired++; });
    // 4 frames * (1000/14) ≈ 285.71ms; advance past that
    a.tick(300);
    expect(fired).toBe(1);
    expect(a.getFrameIndex()).toBe(8 + 3);  // last frame
    // further ticks don't re-fire
    a.tick(300);
    expect(fired).toBe(1);
  });

  it('re-setState clears any prior onComplete', () => {
    const a = new SpriteAnimator(makeAtlas(), 'hit');
    let fired = 0;
    a.onComplete(() => { fired++; });
    a.setState('taunt');  // interrupt before onComplete can fire
    a.tick(2000);
    expect(fired).toBe(0);
    expect(a.getState()).toBe('taunt');
  });

  it('getFrameIndex uses image width to derive columns', () => {
    const a = new SpriteAnimator(makeAtlas(), 'taunt');  // row 3
    expect(a.getFrameIndex()).toBe(3 * 8 + 0);
    a.tick(250);  // 2 frames @ 5fps = 400ms total → 1 frame advanced at 200ms
    expect(a.getFrameIndex()).toBe(3 * 8 + 1);
  });
});
