import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audio } from '@/audio/audioEngine';

/**
 * Regression: bgmGain was created in ensure() but never .connect()-ed,
 * so BGM signal path was: osc → envelope → bgmGain → DEAD END.
 * Even when startBgm() is called, no sound reaches destination.
 */
describe('AudioEngine BGM audio graph (regression: bgmGain must connect)', () => {
  let connectCalls: Array<{ from: string; to: string }>;

  beforeEach(() => {
    // Reset singleton state so ensure() runs fresh
    (audio as any).ctx = null;
    (audio as any).masterGain = null;
    (audio as any).bgmGain = null;
    (audio as any).bgmPlaying = false;
    (audio as any).bgmTimer = null;

    connectCalls = [];

    // Build two distinct GainNodes we can identify by id
    let gainCounter = 0;
    const makeGain = () => {
      const id = `gain-${++gainCounter}`;
      const node: any = {
        __id: id,
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn()
        },
        connect(target: any) {
          connectCalls.push({ from: id, to: target?.__id ?? 'destination-or-other' });
          return target;
        }
      };
      return node;
    };

    const fakeCtx = {
      __id: 'ctx',
      state: 'running',
      currentTime: 0,
      destination: { __id: 'destination' },
      createGain: makeGain,
      createOscillator: () => ({
        __id: 'osc',
        type: '',
        frequency: {
          value: 0,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn()
      }),
      resume: vi.fn()
    };
    (window as any).AudioContext = function () { return fakeCtx; };
  });

  afterEach(() => {
    (window as any).AudioContext = undefined;
    audio.stopBgm();
  });

  it('ensure() creates a connection from bgmGain to masterGain so BGM reaches destination', () => {
    // ensure() is private; trigger via public startBgm → play → ensure
    audio.startBgm();

    // We expect at least one connection whose source is a bgm-related gain
    // and whose target is the masterGain (so signal flows: osc → env → bgmGain → masterGain → destination)
    const bgmToMaster = connectCalls.find(
      c => c.from !== 'gain-1' && c.to === 'gain-1'  // gain-1 is the first createGain = masterGain
    );
    expect(bgmToMaster, `connect calls: ${JSON.stringify(connectCalls)}`).toBeDefined();
  });

  it('bgm signal path reaches destination via bgmGain → masterGain → destination chain', () => {
    audio.startBgm();

    // Verify the chain: bgmGain connects to masterGain, masterGain connects to destination
    const masterToDest = connectCalls.find(c => c.to === 'destination');
    const anyBgmGainToMaster = connectCalls.some(c => c.to === 'gain-1' && c.from !== 'gain-1');

    expect(anyBgmGainToMaster, `no bgmGain→masterGain connect. All calls: ${JSON.stringify(connectCalls)}`).toBe(true);
    expect(masterToDest, `masterGain should connect to destination. Calls: ${JSON.stringify(connectCalls)}`).toBeDefined();
  });
});