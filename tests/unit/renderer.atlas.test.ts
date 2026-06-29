import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadSpriteManifest } from '@/render/spriteManifest';
import { SpriteAnimator } from '@/render/spriteAnimator';

// happy-dom's fetch rejects relative URLs; mock it so we can exercise the boot
// path without standing up a real HTTP server. We do NOT exercise loadImage /
// loadAtlases here — happy-dom can't decode PNGs and the real atlas path is
// covered by the dev-server smoke test (T9).
const manifestJSON = JSON.stringify({
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
});

function mockImage() {
  // Stub global Image to return a fake element with a fixed size
  const fakeImage = {
    width: 2048,
    height: 2048,
    complete: true,
    naturalWidth: 2048,
    onload: null as null | (() => void),
    onerror: null as null | (() => void),
    src: ''
  } as unknown as HTMLImageElement;
  vi.stubGlobal('Image', function () { return fakeImage; } as any);
  return fakeImage;
}

describe('renderer atlas boot', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, statusText: 'OK',
      json: async () => JSON.parse(manifestJSON)
    })));
    mockImage();
  });

  it('loads sprite manifest and validates', async () => {
    const manifest = await loadSpriteManifest('/sprites/sprite-manifest.json');
    expect(manifest.monkey.states.idle.fps).toBe(6);
    expect(manifest.mole.states.active.loop).toBe(true);
  });

  it('constructs a SpriteAnimator directly from manifest spec (boot path)', async () => {
    const manifest = await loadSpriteManifest('/sprites/sprite-manifest.json');
    // Simulate the renderer's boot: build an AtlasEntry from the manifest
    // and construct an animator. The Image is faked above so the atlas'
    // dimensions are present.
    const atlas = {
      src: manifest.monkey.atlas,
      image: { width: 2048, height: 2048, complete: true, naturalWidth: 2048 } as unknown as HTMLImageElement,
      frameSize: manifest.monkey.frameSize,
      anchor: manifest.monkey.anchor,
      states: manifest.monkey.states
    };
    const anim = new SpriteAnimator(atlas, 'idle');
    expect(anim.getState()).toBe('idle');
    expect(anim.getFrameIndex()).toBe(0);

    // monkeyAnim.setState('hit') would be called by the renderer on hit:visual
    anim.setState('hit');
    expect(anim.getState()).toBe('hit');
    expect(anim.getFrameIndex()).toBe(8);  // row 1 * 8 + 0
  });
});
