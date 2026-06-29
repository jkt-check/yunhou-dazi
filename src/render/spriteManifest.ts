import type { AnimStateSpec, AtlasEntry } from './spriteAnimator';

export interface ManifestRole {
  atlas: string;
  frameSize: [number, number];
  anchor: [number, number];
  states: Record<string, AnimStateSpec>;
}

export interface SpriteManifest {
  monkey: ManifestRole;
  mole: ManifestRole;
}

const REQUIRED_MONKEY_STATES = ['idle', 'hit', 'combo', 'taunt', 'miss'] as const;
const REQUIRED_MOLE_STATES   = ['rising', 'active', 'retreating', 'hit', 'taunting'] as const;
const ATLAS_COLS = 8;  // 2048 / 256

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function assertRole(
  raw: unknown,
  path: string,
  requiredStates: readonly string[]
): asserts raw is ManifestRole {
  if (!isObject(raw)) throw new Error(`manifest.${path}: not an object`);
  if (typeof raw.atlas !== 'string') throw new Error(`manifest.${path}.atlas: not a string`);
  if (!Array.isArray(raw.frameSize) || raw.frameSize.length !== 2) {
    throw new Error(`manifest.${path}.frameSize: must be [w, h]`);
  }
  const [fw, fh] = raw.frameSize as [number, number];
  if (fw !== 256 || fh !== 256) {
    throw new Error(`manifest.${path}.frameSize: must be 256x256, got ${fw}x${fh}`);
  }
  if (!Array.isArray(raw.anchor) || raw.anchor.length !== 2) {
    throw new Error(`manifest.${path}.anchor: must be [x, y]`);
  }
  if (!isObject(raw.states)) throw new Error(`manifest.${path}.states: not an object`);

  for (const name of requiredStates) {
    if (!isObject(raw.states[name])) {
      throw new Error(`manifest.${path}.states.${name}: missing`);
    }
    const s = raw.states[name] as Record<string, unknown>;
    if (typeof s.row !== 'number' || s.row < 0 || s.row + (s.count as number) > ATLAS_COLS) {
      throw new Error(`manifest.${path}.states.${name}.row+count out of bounds (row=${s.row}, count=${s.count})`);
    }
    if (typeof s.count !== 'number' || s.count < 1) {
      throw new Error(`manifest.${path}.states.${name}.count: must be >= 1`);
    }
    if (typeof s.fps !== 'number' || s.fps <= 0) {
      throw new Error(`manifest.${path}.states.${name}.fps: must be > 0`);
    }
    if (typeof s.loop !== 'boolean') {
      throw new Error(`manifest.${path}.states.${name}.loop: must be boolean`);
    }
  }
}

export function validateManifest(m: unknown): asserts m is SpriteManifest {
  if (!isObject(m)) throw new Error('manifest: not an object');
  assertRole(m.monkey, 'monkey', REQUIRED_MONKEY_STATES);
  assertRole(m.mole,   'mole',   REQUIRED_MOLE_STATES);
}

export async function loadSpriteManifest(url: string): Promise<SpriteManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`loadSpriteManifest: ${res.status} ${res.statusText} for ${url}`);
  const raw: unknown = await res.json();
  validateManifest(raw);
  return raw;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`loadImage: failed to load ${src}`));
    img.src = src;
  });
}

export async function loadAtlases(manifest: SpriteManifest): Promise<{ monkey: AtlasEntry; mole: AtlasEntry }> {
  const [monkeyImg, moleImg] = await Promise.all([
    loadImage(manifest.monkey.atlas),
    loadImage(manifest.mole.atlas)
  ]);
  return {
    monkey: {
      src: manifest.monkey.atlas,
      image: monkeyImg,
      frameSize: manifest.monkey.frameSize,
      anchor: manifest.monkey.anchor,
      states: manifest.monkey.states
    },
    mole: {
      src: manifest.mole.atlas,
      image: moleImg,
      frameSize: manifest.mole.frameSize,
      anchor: manifest.mole.anchor,
      states: manifest.mole.states
    }
  };
}
