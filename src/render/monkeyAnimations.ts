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
    // Regression fix (review round 6): the previous version set
    // stateStartedAt to a FUTURE timestamp when remaining > STATE_DURATIONS.taunt,
    // causing tick() to never auto-transition out of taunt.
    //
    // New behavior: align stateStartedAt so tick() auto-transitions to idle
    // exactly at `until`. drawMonkey's animation uses stateAge % 200 (a
    // breathing cycle) and doesn't care about absolute age, so any past or
    // future stateStartedAt works as long as auto-transition timing is right.
    this.state = 'taunt';
    this.stateStartedAt = until - STATE_DURATIONS.taunt!;
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
