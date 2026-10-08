// Zero-asset sound effects: every voice is synthesized with WebAudio oscillators/noise, never an
// mp3/ogg, because local LAN mode has no internet and the repo bans CDN-loaded assets. The TV
// is the only speaker (packages/sandbox forwards mute state into game frames); phones stay silent
// and use navigator.vibrate instead.

import { buildVoice } from "./sfx-voices.js";

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

export const sfx: SfxEngine = new SfxEngineImpl();
