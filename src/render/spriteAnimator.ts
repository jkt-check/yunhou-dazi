export interface AnimStateSpec {
  row: number;
  count: number;
  fps: number;
  loop: boolean;
  easing?: (t: number) => number; // reserved
}

export interface AtlasEntry {
  src: string;
  image: HTMLImageElement;
  frameSize: readonly [number, number];
  anchor: readonly [number, number];
  states: Record<string, AnimStateSpec>;
}

export class SpriteAnimator {
  private atlas: AtlasEntry;
  private currentState: string;
  private currentFrame: number = 0;
  private frameAccum: number = 0;
  private completed: boolean = false;
  private completeCb: (() => void) | null = null;

  constructor(atlas: AtlasEntry, initialState: string = 'idle') {
    if (!atlas.states[initialState]) {
      throw new Error(`SpriteAnimator: initial state "${initialState}" not in atlas.states`);
    }
    this.atlas = atlas;
    this.currentState = initialState;
  }

  setState(name: string): void {
    if (!this.atlas.states[name]) {
      throw new Error(`SpriteAnimator: unknown state "${name}"`);
    }
    this.currentState = name;
    this.currentFrame = 0;
    this.frameAccum = 0;
    this.completed = false;
    this.completeCb = null;
  }

  tick(dt: number): void {
    if (this.completed) return;
    const spec = this.atlas.states[this.currentState];
    if (!spec || spec.count === 0) return;

    const frameDur = 1000 / spec.fps;
    this.frameAccum += dt;

    if (this.frameAccum >= frameDur) {
      const advanced = Math.floor(this.frameAccum / frameDur);
      this.frameAccum -= advanced * frameDur;

      if (spec.loop) {
        this.currentFrame = (this.currentFrame + advanced) % spec.count;
      } else {
        const next = this.currentFrame + advanced;
        if (next >= spec.count - 1) {
          this.currentFrame = spec.count - 1;
          this.completed = true;
          if (this.completeCb) {
            const cb = this.completeCb;
            this.completeCb = null;
            cb();
          }
        } else {
          this.currentFrame = next;
        }
      }
    }
  }

  getFrameIndex(): number {
    const spec = this.atlas.states[this.currentState];
    if (!spec) return 0;
    const cols = this.atlas.image.width > 0
      ? this.atlas.image.width / this.atlas.frameSize[0]
      : 8;
    return spec.row * cols + this.currentFrame;
  }

  getState(): string {
    return this.currentState;
  }

  onComplete(cb: () => void): void {
    this.completeCb = cb;
  }

  isLoaded(): boolean {
    return this.atlas.image.complete && this.atlas.image.naturalWidth > 0;
  }
}
