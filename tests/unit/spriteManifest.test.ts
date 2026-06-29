import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateManifest, loadSpriteManifest } from '@/render/spriteManifest';

const validManifest = {
  monkey: {
    atlas: '/sprites/monkey.png',
    frameSize: [256, 256],
    anchor: [128, 200],
    states: {
      idle:  { row: 0, count: 4, fps: 6,  loop: true  },
      hit:   { row: 1, count: 4, fps: 14, loop: false },
      combo: { row: 2, count: 6, fps: 10, loop: false },
      taunt: { row: 3, count: 4, fps: 5,  loop: true  },
      miss:  { row: 4, count: 4, fps: 8,  loop: false }
    }
  },
  mole: {
    atlas: '/sprites/mole.png',
    frameSize: [256, 256],
    anchor: [128, 220],
    states: {
      rising:     { row: 0, count: 3, fps: 8,  loop: false },
      active:     { row: 1, count: 3, fps: 4,  loop: true  },
      retreating: { row: 2, count: 2, fps: 10, loop: false },
      hit:        { row: 3, count: 3, fps: 12, loop: false },
      taunting:   { row: 4, count: 3, fps: 5,  loop: true  }
    }
  }
};

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    expect(() => validateManifest(validManifest)).not.toThrow();
  });

  it('rejects manifest missing required monkey state', () => {
    const m = JSON.parse(JSON.stringify(validManifest));
    delete m.monkey.states.taunt;
    expect(() => validateManifest(m)).toThrow(/taunt/);
  });

  it('rejects manifest with out-of-bounds row', () => {
    const m = JSON.parse(JSON.stringify(validManifest));
    m.monkey.states.idle.row = 9;
    expect(() => validateManifest(m)).toThrow(/row|out of bounds/);
  });

  it('rejects manifest with non-square frameSize', () => {
    const m = JSON.parse(JSON.stringify(validManifest));
    m.monkey.frameSize = [256, 128];
    expect(() => validateManifest(m)).toThrow(/frameSize/);
  });
});

describe('loadSpriteManifest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and validates', async () => {
    const fakeResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => validManifest
    };
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse));
    const m = await loadSpriteManifest('/sprites/sprite-manifest.json');
    expect(m.monkey.states.idle.fps).toBe(6);
  });

  it('throws on non-2xx fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 404, statusText: 'Not Found', json: async () => ({})
    })));
    await expect(loadSpriteManifest('/missing.json')).rejects.toThrow(/404/);
  });
});
