export class HorrorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private staticGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private initialized = false;
  private nextHeartbeatTime = 0;
  private nextFootstepTime = 0;
  private nextStalkerStepTime = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.75, this.ctx.currentTime, 0.05);
    }
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.75;
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
      this.setupAmbience();
      this.initialized = true;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private setupAmbience(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    // Sub-bass bunker hum
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.08;

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 115;

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.value = 41.2; // Deep E1 rumble

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.value = 42.1; // Slow beating dissonance

    this.droneOsc1.connect(droneFilter);
    this.droneOsc2.connect(droneFilter);
    droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    this.droneOsc1.start();
    this.droneOsc2.start();

    // Filtered radio/ventilation static controlled by dread
    const staticSource = this.ctx.createBufferSource();
    staticSource.buffer = this.noiseBuffer;
    staticSource.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1400;
    bandpass.Q.value = 1.6;

    this.staticGain = this.ctx.createGain();
    this.staticGain.gain.value = 0.008;

    staticSource.connect(bandpass);
    bandpass.connect(this.staticGain);
    this.staticGain.connect(this.masterGain);
    staticSource.start();
  }

  public update(
    nowSec: number,
    dreadLevel: number,
    isMoving: boolean,
    isSprinting: boolean,
    isCrouching: boolean,
    stalkerDistance: number,
    stalkerHunting: boolean,
    isPlaying: boolean
  ): void {
    if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;

    const t = this.ctx.currentTime;

    if (this.droneGain) {
      const targetDrone = isPlaying ? 0.07 + dreadLevel * 0.12 : 0.04;
      this.droneGain.gain.setTargetAtTime(targetDrone, t, 0.15);
    }

    if (this.staticGain) {
      const targetStatic = isPlaying ? 0.006 + Math.pow(dreadLevel, 1.7) * 0.14 : 0.004;
      this.staticGain.gain.setTargetAtTime(targetStatic, t, 0.1);
    }

    if (!isPlaying) return;

    // Player footsteps
    if (isMoving && nowSec >= this.nextFootstepTime) {
      const interval = isSprinting ? 0.31 : isCrouching ? 0.62 : 0.46;
      this.nextFootstepTime = nowSec + interval;
      this.playFootstep(isSprinting ? 0.16 : isCrouching ? 0.05 : 0.1, isSprinting ? 140 : 105);
    }

    // Dynamic heartbeat when dread > 0.18
    if (dreadLevel > 0.18 && nowSec >= this.nextHeartbeatTime) {
      const bpm = 62 + dreadLevel * 92;
      this.nextHeartbeatTime = nowSec + 60 / bpm;
      this.playHeartbeat(0.08 + dreadLevel * 0.28);
    }

    // Stalker heavy metallic steps when within 24m
    if (stalkerDistance < 24 && nowSec >= this.nextStalkerStepTime) {
      const interval = stalkerHunting ? 0.38 : 0.68;
      this.nextStalkerStepTime = nowSec + interval;
      const atten = Math.max(0, 1 - stalkerDistance / 24);
      this.playStalkerStep(atten * atten * (stalkerHunting ? 0.34 : 0.2));
    }
  }

  private playFootstep(volume: number, cutoff: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff + Math.random() * 40, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.14);
  }

  private playStalkerStep(volume: number): void {
    if (!this.ctx || !this.masterGain || volume < 0.005) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(78, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  private playHeartbeat(volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    const triggerBeat = (offset: number, amp: number) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + offset;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(58, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.14);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(amp, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
    };

    triggerBeat(0, volume);
    triggerBeat(0.16, volume * 0.65);
  }

  public playFlashlightClick(on: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(on ? 1650 : 1200, t);
    osc.frequency.exponentialRampToValueAtTime(on ? 950 : 620, t + 0.03);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  public playBreakerSwitch(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Mechanical clunk
    const clunk = this.ctx.createOscillator();
    clunk.type = 'sawtooth';
    clunk.frequency.setValueAtTime(210, t);
    clunk.frequency.exponentialRampToValueAtTime(65, t + 0.14);

    const clunkGain = this.ctx.createGain();
    clunkGain.gain.setValueAtTime(0.32, t);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    clunk.connect(clunkGain);
    clunkGain.connect(this.masterGain);
    clunk.start(t);
    clunk.stop(t + 0.2);

    // Electrical power-up hum
    const hum = this.ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(120, t + 0.1);
    hum.frequency.exponentialRampToValueAtTime(240, t + 0.65);

    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0.001, t + 0.1);
    humGain.gain.linearRampToValueAtTime(0.16, t + 0.25);
    humGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    hum.connect(humGain);
    humGain.connect(this.masterGain);
    hum.start(t + 0.1);
    hum.stop(t + 0.85);
  }

  public playPickup(kind: 'battery' | 'note'): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = kind === 'battery' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(kind === 'battery' ? 520 : 380, t);
    osc.frequency.exponentialRampToValueAtTime(kind === 'battery' ? 780 : 490, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  public playAlertSting(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const freqs = [220, 233.08, 466.16];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.88, t + 0.55);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1900, t);
      filter.frequency.exponentialRampToValueAtTime(320, t + 0.55);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.62);
    }
  }

  public playCaughtScream(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    const freqs = [130, 184, 311, 590];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 1.3, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.85);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.92);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    noise.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.82);
  }

  public playEscapeChime(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const start = t + idx * 0.11;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  }

  public dispose(): void {
    try {
      this.droneOsc1?.stop();
      this.droneOsc2?.stop();
      this.ctx?.close();
    } catch {
      // Ignore audio teardown errors
    }
    this.ctx = null;
    this.initialized = false;
  }
}
