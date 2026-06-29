import type { HoleLayout } from './layout';

export interface SceneContext {
  level: number;
  rng: () => number;
  history: string[];
  sceneConfig: Record<string, unknown>;
}

export interface Scene {
  id: string;
  name: string;
  getKeysPerMole(): number;
  /** Optional: per-spawn key picker. Most keyboard-driven scenes get keys from
   *  their HoleLayout (positions[i].letter), so this is unused there. Scenes
   *  with non-keyboard spawning (e.g. random vocabulary) can override it. */
  generateKey?(ctx: SceneContext): string;
  renderKey(ctx: CanvasRenderingContext2D, key: string, x: number, y: number): void;
  matches(input: string[], target: string): boolean;
  getDifficultyMultiplier(): number;
  /** Scene-specific taunt text. Required so each scene owns its copy — the
   *  engine never falls back to a generic pool (avoids cross-scene bleed). */
  getTauntText(): string;
  /**
   * Layout describing where moles can emerge on the play field.
   * Required — implement by returning a layout that matches the scene's
   * character system (e.g. QWERTY for letters, pinyin keyboard for pinyin).
   */
  getHoleLayout(): HoleLayout;
}

export const scenes: Record<string, Scene> = {};

export function registerScene(scene: Scene) {
  scenes[scene.id] = scene;
}

export function getScene(id: string): Scene | undefined {
  return scenes[id];
}
