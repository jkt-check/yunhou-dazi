export type MonkeyState = 'idle' | 'hit' | 'combo' | 'taunt' | 'miss';

const STATE_DURATIONS: Record<MonkeyState, number | null> = {
  idle: null,
  hit: 300,
  combo: 600,
  taunt: 500,
  miss: 500
};

export class MonkeyAnimations {
  private state: MonkeyState = 'idle';
  private stateStartedAt: number;
  private now: () => number;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
    this.stateStartedAt = now();
  }

  setState(state: MonkeyState): void {
    this.state = state;
    this.stateStartedAt = this.now();
  }

  extendTaunt(until: number): void {
    if (this.state !== 'taunt') {
      this.state = 'taunt';
      this.stateStartedAt = this.now();
    }
    const remaining = until - this.now();
    if (remaining > STATE_DURATIONS.taunt!) {
      this.stateStartedAt = this.now() - (STATE_DURATIONS.taunt! - remaining);
    }
  }

  getCurrentState(): MonkeyState {
    return this.state;
  }

  getStateAge(): number {
    return this.now() - this.stateStartedAt;
  }

  /** Called by renderer each frame. Auto-transitions transient states back to idle. */
  tick(): void {
    const dur = STATE_DURATIONS[this.state];
    if (dur !== null && this.getStateAge() >= dur) {
      this.state = 'idle';
      this.stateStartedAt = this.now();
    }
  }
}
