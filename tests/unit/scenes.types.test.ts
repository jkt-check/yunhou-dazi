import { describe, it, expect, beforeEach } from 'vitest';
import { registerScene, getScene, scenes } from '@/scenes/types';

const fakeScene = {
  id: 'fake',
  name: 'Fake Scene',
  getKeysPerMole: () => 1,
  generateKey: () => 'x',
  renderKey: () => {},
  matches: () => true,
  getDifficultyMultiplier: () => 1.0
};

describe('scene registry', () => {
  beforeEach(() => {
    delete scenes['fake'];
  });

  it('registerScene adds a scene to the registry', () => {
    registerScene(fakeScene);
    expect(scenes['fake']).toBe(fakeScene);
  });

  it('getScene returns registered scene by id', () => {
    registerScene(fakeScene);
    expect(getScene('fake')).toBe(fakeScene);
  });

  it('getScene returns undefined for unknown id', () => {
    expect(getScene('nonexistent-' + Date.now())).toBeUndefined();
  });
});