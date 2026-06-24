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
  generateKey(ctx: SceneContext): string;
  renderKey(ctx: CanvasRenderingContext2D, key: string, x: number, y: number): void;
  matches(input: string[], target: string): boolean;
  getDifficultyMultiplier(): number;
}
