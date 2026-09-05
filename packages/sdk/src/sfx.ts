// Zero-asset sound effects: every voice is synthesized with WebAudio oscillators/noise, never an
// mp3/ogg, because local LAN mode has no internet and the repo bans CDN-loaded assets. The TV
// is the only speaker (packages/sandbox forwards mute state into game frames); phones stay silent
// and use navigator.vibrate instead.

export const SFX_STORAGE_KEY = "hubbub:sound";

export type SfxName =
  | "pop"
  | "tick"
  | "lock"
  | "whoosh"
  | "flip"
  | "reveal"
  | "correct"
  | "wrong"
  | "score"
  | "join"
  | "leave"
  | "fanfare"
  | "drumroll";

export interface SfxOptions {
  /** Stagger index for "pop"/"join" pitch stepping. Clamped 0..11 (the platform's player cap). */
  index?: number;
  /** Schedules the voice at ctx.currentTime + delayMs/1000 so a stagger needs no setTimeout chain. */
  delayMs?: number;
  /** 0..1 multiplier on top of the per-voice envelope peak. */
  gain?: number;
}

export interface SfxEngine {
  play(name: SfxName, opts?: SfxOptions): void;
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  readonly unlocked: boolean;
  unlock(): Promise<boolean>;
  installAutoUnlock(): () => void;
  subscribe(listener: () => void): () => void;
}

type AudioCtor = typeof AudioContext;

// Sounds that stack on purpose (a 12-player "pop pop pop" stagger, or overlapping join/leave
// chimes) skip the same-name dedupe below; everything else collapses repeats fired in one frame.
const STACKABLE = new Set<SfxName>(["pop", "join", "leave", "flip"]);
const DEDUPE_WINDOW_S = 0.025;

const MASTER_GAIN = 0.5;
const VOICE_PEAK_CEILING = 0.6;
const ENV_FLOOR = 0.0001;

function clampIndex(index: number | undefined): number {
  return Math.min(11, Math.max(0, index ?? 0));
}

function loadPersistedMute(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(SFX_STORAGE_KEY) === "muted";
  } catch {
    return false;
  }
}

function persistMute(muted: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(SFX_STORAGE_KEY, muted ? "muted" : "on");
  } catch {
    // Sandbox frames have an opaque origin, whose storage access throws rather than no-ops.
  }
}

function pageHidden(): boolean {
  return typeof document !== "undefined" && document.hidden === true;
}

class SfxEngineImpl implements SfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private _muted = loadPersistedMute();
  private lastStart = new Map<SfxName, number>();
  private listeners = new Set<() => void>();
  private autoUnlockDisposer: (() => void) | null = null;

  get muted(): boolean {
    return this._muted;
  }

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  setMuted(muted: boolean): void {
    if (this._muted === muted) return;
    this._muted = muted;
    persistMute(muted);
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private ctor(): AudioCtor | undefined {
    if (typeof window === "undefined") return undefined;
    return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  }

  async unlock(): Promise<boolean> {
    const Ctor = this.ctor();
    if (!Ctor) return false;
    try {
      if (!this.ctx) {
        this.ctx = new Ctor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = MASTER_GAIN;
        this.masterGain.connect(this.ctx.destination);
      }
      await this.ctx.resume().catch(() => {});
      const running = this.ctx.state === "running";
      this.notify();
      return running;
    } catch {
      return false;
    }
  }

  installAutoUnlock(): () => void {
    if (this.autoUnlockDisposer) return this.autoUnlockDisposer;
    if (typeof document === "undefined") return () => {};
    const handler = () => {
      void this.unlock();
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    for (const type of events) document.addEventListener(type, handler, { once: true, capture: true });
    this.autoUnlockDisposer = () => {
      for (const type of events) document.removeEventListener(type, handler, { capture: true } as EventListenerOptions);
      this.autoUnlockDisposer = null;
    };
    return this.autoUnlockDisposer;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  play(name: SfxName, opts: SfxOptions = {}): void {
    try {
      if (this._muted || pageHidden()) return;
      const ctx = this.ctx;
      if (!ctx || ctx.state !== "running" || !this.masterGain) return;

      const delayS = Math.max(0, (opts.delayMs ?? 0) / 1000);
      const startAt = ctx.currentTime + delayS;

      if (!STACKABLE.has(name)) {
        const last = this.lastStart.get(name);
        if (last !== undefined && Math.abs(startAt - last) < DEDUPE_WINDOW_S) return;
      }
      this.lastStart.set(name, startAt);

      const gain = Math.min(1, Math.max(0, opts.gain ?? 1));
      const index = clampIndex(opts.index);
      buildVoice(ctx, this.masterGain, this.getNoiseBuffer(ctx), name, startAt, index, gain);
    } catch {
      // play() never throws: a game or the shell may call it from anywhere.
    }
  }
}

/** One voice's tiny graph (oscillator/noise + filter + gain envelope), self-disconnecting on
 * `ended` so a long session never accumulates dead nodes. */
function buildVoice(
  ctx: AudioContext,
  destination: GainNode,
  noiseBuffer: AudioBuffer,
  name: SfxName,
  startAt: number,
  index: number,
  gainMult: number,
) {
  const voiceGain = ctx.createGain();
  voiceGain.connect(destination);

  const cleanup: AudioScheduledSourceNode[] = [];
  const disconnectAll = () => {
    voiceGain.disconnect();
    for (const node of cleanup) node.disconnect();
  };

  function envelope(peak: number, attackS: number, holdAt: number, decayTo: number, decayS: number) {
    const g = voiceGain.gain;
    const cappedPeak = Math.min(VOICE_PEAK_CEILING, peak) * gainMult;
    g.setValueAtTime(ENV_FLOOR, startAt);
    g.linearRampToValueAtTime(Math.max(ENV_FLOOR, cappedPeak), startAt + attackS);
    g.setValueAtTime(Math.max(ENV_FLOOR, cappedPeak), startAt + holdAt);
    g.exponentialRampToValueAtTime(Math.max(ENV_FLOOR, decayTo), startAt + holdAt + decayS);
  }

  function tone(freqStart: number, freqEnd: number, durationS: number, type: OscillatorType = "sine") {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startAt);
    if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), startAt + durationS);
    osc.connect(voiceGain);
    osc.start(startAt);
    osc.stop(startAt + durationS + 0.05);
    osc.addEventListener("ended", disconnectAll, { once: true });
    cleanup.push(osc);
    return osc;
  }

  function noiseBurst(durationS: number, filterFreq: number, filterType: BiquadFilterType = "bandpass") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    src.connect(filter);
    filter.connect(voiceGain);
    src.start(startAt);
    src.stop(startAt + durationS + 0.05);
    src.addEventListener("ended", disconnectAll, { once: true });
    cleanup.push(src);
    return { src, filter };
  }

  // Semitone step per stagger index so a 12-player "pop pop pop" reads as ascending, not identical.
  const semitoneMul = Math.pow(2, (2 * index) / 12);

  switch (name) {
    case "pop": {
      const osc = tone(880 * semitoneMul, 440 * semitoneMul, 0.06, "sine");
      void osc;
      envelope(0.5, 0.005, 0.01, ENV_FLOOR, 0.11);
      break;
    }
    case "join": {
      const osc = tone(360, 720, 0.14, "sine");
      void osc;
      envelope(0.4, 0.01, 0.03, ENV_FLOOR, 0.12);
      break;
    }
    case "leave": {
      const osc = tone(560, 260, 0.16, "sine");
      void osc;
      envelope(0.4, 0.01, 0.03, ENV_FLOOR, 0.14);
      break;
    }
    case "tick": {
      const osc = tone(1800, 1800, 0.02, "square");
      void osc;
      envelope(0.15, 0.002, 0.004, ENV_FLOOR, 0.03);
      break;
    }
    case "lock": {
      tone(1200, 900, 0.03, "square");
      envelope(0.2, 0.002, 0.01, ENV_FLOOR, 0.04);
      // Low thump layered under the click.
      const thumpGain = ctx.createGain();
      thumpGain.connect(destination);
      const thump = ctx.createOscillator();
      thump.type = "sine";
      thump.frequency.setValueAtTime(120, startAt);
      thump.frequency.exponentialRampToValueAtTime(60, startAt + 0.1);
      thump.connect(thumpGain);
      thumpGain.gain.setValueAtTime(ENV_FLOOR, startAt);
      thumpGain.gain.linearRampToValueAtTime(Math.min(VOICE_PEAK_CEILING, 0.45) * gainMult, startAt + 0.01);
      thumpGain.gain.exponentialRampToValueAtTime(ENV_FLOOR, startAt + 0.14);
      thump.start(startAt);
      thump.stop(startAt + 0.2);
      thump.addEventListener("ended", () => thumpGain.disconnect(), { once: true });
      break;
    }
    case "whoosh": {
      const { filter } = noiseBurst(0.22, 400, "bandpass");
      filter.frequency.setValueAtTime(300, startAt);
      filter.frequency.exponentialRampToValueAtTime(3200, startAt + 0.22);
      envelope(0.35, 0.02, 0.08, ENV_FLOOR, 0.14);
      break;
    }
    case "flip": {
      const first = ctx.createOscillator();
      first.type = "square";
      first.frequency.value = 1400;
      first.connect(voiceGain);
      first.start(startAt);
      first.stop(startAt + 0.02);
      first.addEventListener("ended", disconnectAll, { once: true });
      cleanup.push(first);

      const second = ctx.createOscillator();
      second.type = "square";
      second.frequency.value = 1400;
      second.connect(voiceGain);
      second.start(startAt + 0.12);
      second.stop(startAt + 0.14);
      second.addEventListener("ended", disconnectAll, { once: true });
      cleanup.push(second);

      const g = voiceGain.gain;
      const peak = Math.min(VOICE_PEAK_CEILING, 0.3) * gainMult;
      g.setValueAtTime(ENV_FLOOR, startAt);
      g.linearRampToValueAtTime(peak, startAt + 0.002);
      g.exponentialRampToValueAtTime(ENV_FLOOR, startAt + 0.02);
      g.setValueAtTime(ENV_FLOOR, startAt + 0.12);
      g.linearRampToValueAtTime(peak, startAt + 0.122);
      g.exponentialRampToValueAtTime(ENV_FLOOR, startAt + 0.14);
      break;
    }
    case "reveal": {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.connect(voiceGain);
        const noteStart = startAt + i * 0.09;
        osc.start(noteStart);
        osc.stop(noteStart + 0.16);
        osc.addEventListener("ended", disconnectAll, { once: true });
        cleanup.push(osc);
      });
      const g = voiceGain.gain;
      const peak = Math.min(VOICE_PEAK_CEILING, 0.4) * gainMult;
      g.setValueAtTime(ENV_FLOOR, startAt);
      notes.forEach((_freq, i) => {
        const noteStart = startAt + i * 0.09;
        g.setValueAtTime(ENV_FLOOR, noteStart);
        g.linearRampToValueAtTime(peak, noteStart + 0.01);
        g.exponentialRampToValueAtTime(ENV_FLOOR, noteStart + 0.15);
      });
      break;
    }
    case "correct": {
      const chord = [523.25, 659.25, 783.99];
      for (const freq of chord) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.connect(voiceGain);
        osc.start(startAt);
        osc.stop(startAt + 0.35);
        osc.addEventListener("ended", disconnectAll, { once: true });
        cleanup.push(osc);
      }
      envelope(0.4, 0.01, 0.05, ENV_FLOOR, 0.3);
      break;
    }
    case "wrong": {
      const osc = tone(220, 90, 0.22, "sawtooth");
      void osc;
      envelope(0.35, 0.01, 0.02, ENV_FLOOR, 0.2);
      break;
    }
    case "score": {
      const first = ctx.createOscillator();
      first.type = "sine";
      first.frequency.value = 988;
      first.connect(voiceGain);
      first.start(startAt);
      first.stop(startAt + 0.1);
      first.addEventListener("ended", disconnectAll, { once: true });
      cleanup.push(first);

      const second = ctx.createOscillator();
      second.type = "sine";
      second.frequency.value = 1319;
      second.connect(voiceGain);
      second.start(startAt + 0.08);
      second.stop(startAt + 0.22);
      second.addEventListener("ended", disconnectAll, { once: true });
      cleanup.push(second);

      const g = voiceGain.gain;
      const peak = Math.min(VOICE_PEAK_CEILING, 0.4) * gainMult;
      g.setValueAtTime(ENV_FLOOR, startAt);
      g.linearRampToValueAtTime(peak, startAt + 0.005);
      g.exponentialRampToValueAtTime(ENV_FLOOR, startAt + 0.08);
      g.setValueAtTime(ENV_FLOOR, startAt + 0.08);
      g.linearRampToValueAtTime(peak, startAt + 0.09);
      g.exponentialRampToValueAtTime(ENV_FLOOR, startAt + 0.22);
      break;
    }
    case "fanfare": {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.connect(voiceGain);
        const noteStart = startAt + i * 0.11;
        osc.start(noteStart);
        osc.stop(noteStart + 0.5);
        osc.addEventListener("ended", disconnectAll, { once: true });
        cleanup.push(osc);
      });
      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = 2093;
      shimmer.connect(voiceGain);
      shimmer.start(startAt + 0.33);
      shimmer.stop(startAt + 0.9);
      shimmer.addEventListener("ended", disconnectAll, { once: true });
      cleanup.push(shimmer);

      const g = voiceGain.gain;
      const peak = Math.min(VOICE_PEAK_CEILING, 0.45) * gainMult;
      g.setValueAtTime(ENV_FLOOR, startAt);
      notes.forEach((_freq, i) => {
        const noteStart = startAt + i * 0.11;
        g.setValueAtTime(ENV_FLOOR, noteStart);
        g.linearRampToValueAtTime(peak, noteStart + 0.015);
        g.exponentialRampToValueAtTime(ENV_FLOOR, noteStart + 0.4);
      });
      g.setValueAtTime(ENV_FLOOR, startAt + 0.33);
      g.linearRampToValueAtTime(peak * 0.7, startAt + 0.35);
      g.exponentialRampToValueAtTime(ENV_FLOOR, startAt + 0.9);
      break;
    }
    case "drumroll": {
      const { filter } = noiseBurst(0.7, 200, "lowpass");
      filter.frequency.setValueAtTime(200, startAt);
      filter.frequency.linearRampToValueAtTime(900, startAt + 0.7);
      const g = voiceGain.gain;
      const peak = Math.min(VOICE_PEAK_CEILING, 0.4) * gainMult;
      g.setValueAtTime(ENV_FLOOR, startAt);
      g.linearRampToValueAtTime(peak, startAt + 0.7);
      g.exponentialRampToValueAtTime(ENV_FLOOR, startAt + 0.75);
      break;
    }
  }
}

export const sfx: SfxEngine = new SfxEngineImpl();
