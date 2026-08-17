/**
 * Solo Leveling "The System" Web Audio Synthesizer
 * Generates futuristic holographic sound effects matching the anime sound design.
 */

const AUDIO_ENABLED_KEY = 'sololeveling_system_audio_enabled';

class SystemSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(AUDIO_ENABLED_KEY);
      this.enabled = stored === null ? true : stored === 'true';
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUDIO_ENABLED_KEY, String(this.enabled));
    }
    if (this.enabled) {
      this.playSystemChime();
    }
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Signature Solo Leveling System Notification Chime [ A QUEST HAS ARRIVED ] */
  public playSystemChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 880, start: 0, dur: 0.12 },     // A5
      { freq: 1318.51, start: 0.08, dur: 0.18 }, // E6
      { freq: 1760, start: 0.16, dur: 0.35 },    // A6 (high crystalline ring)
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.2, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  }

  /** Futuristic Holographic Button Click / Tab Switch */
  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Epic Level Up Fanfare / Stat Boost */
  public playLevelUp(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chords = [
      [523.25, 659.25, 783.99],   // C5 Major
      [659.25, 830.61, 987.77],   // E5
      [783.99, 1046.50, 1318.51], // G5 / C6
      [1046.50, 1318.51, 1567.98, 2093.00], // S-Rank High Chord
    ];

    chords.forEach((chord, i) => {
      const stepTime = now + i * 0.12;
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = i === 3 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, stepTime);

        gain.gain.setValueAtTime(0, stepTime);
        gain.gain.linearRampToValueAtTime(0.15, stepTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, stepTime + (i === 3 ? 0.8 : 0.25));

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(stepTime);
        osc.stop(stepTime + (i === 3 ? 0.8 : 0.25));
      });
    });
  }

  /** Quest Complete / Reward Claimed */
  public playQuestComplete(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, delay: 0 },
      { freq: 880.00, delay: 0.1 },
      { freq: 1174.66, delay: 0.2 },
      { freq: 1760.00, delay: 0.35 },
    ];

    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.18, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    });
  }

  /** Stat Point Allocated Thud */
  public playStatPoint(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** Urgent / Penalty Zone Alert Warning Pulse */
  public playPenaltyWarning(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const start = now + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, start);
      osc.frequency.linearRampToValueAtTime(160, start + 0.18);

      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.18);
    }
  }
}

export const systemSound = new SystemSoundEngine();
