/**
 * Host Emergency PA / Walkie-Talkie Audio Player
 * Drains and plays incoming 16kHz Int16 PCM chunks with jitter-free, gapless scheduling via AudioContext.
 */

export class PAPlayer {
  private audioCtx: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  private volumeNode: GainNode | null = null;
  private lastSeq: number = -1;

  constructor() {
    // AudioContext will be lazily initialized on first user interaction or incoming audio
  }

  private initContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.volumeNode = this.audioCtx.createGain();
      this.volumeNode.gain.value = 1.0;
      this.volumeNode.connect(this.audioCtx.destination);
      this.unlockOnUserGesture(this.audioCtx);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private unlockOnUserGesture(ctx: AudioContext): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('touchend', unlock, true);
      window.removeEventListener('click', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('touchend', unlock, true);
    window.addEventListener('click', unlock, true);
  }

  async resume(): Promise<void> {
    const ctx = this.initContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  }

  isSuspended(): boolean {
    return this.audioCtx?.state === 'suspended';
  }

  /**
   * Plays a crisp 2-tone emergency attention chime (D5 -> A5)
   */
  async playEmergencyChime(): Promise<void> {
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // Note 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(this.volumeNode || ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.22);
      gain2.gain.setValueAtTime(0.35, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(this.volumeNode || ctx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.65);

      this.nextPlayTime = now + 0.7;
    } catch (err) {
      console.warn('Failed to play emergency chime:', err);
    }
  }

  /**
   * Feed a base64-encoded Int16 PCM chunk
   */
  feedBase64PCM(base64Pcm: string, sampleRate = 16000, seq?: number): void {
    if (seq !== undefined && seq > 0) {
      if (this.lastSeq !== -1 && seq <= this.lastSeq && this.lastSeq - seq < 100) {
        // Drop duplicate or already-played packet to prevent repeating and stuttering
        return;
      }
      this.lastSeq = seq;
    }

    try {
      const ctx = this.initContext();
      this.isPlaying = true;

      // Decode Base64 to Uint8Array
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert Uint8Array buffer into Int16Array
      const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      if (int16.length === 0) return;

      // Convert to normalized Float32 (-1.0 to 1.0)
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      // Create AudioBuffer
      const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32);

      // Schedule buffer to play smoothly after previous chunk
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.volumeNode || ctx.destination);

      const currentTime = ctx.currentTime;
      // If we fell behind current playback time or jumped ahead, reset to smooth 50ms cushion
      if (this.nextPlayTime < currentTime || this.nextPlayTime - currentTime > 1.2) {
        this.nextPlayTime = currentTime + 0.05; // 50ms smooth jitter cushion
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
    } catch (err) {
      console.error('Failed to feed PCM chunk to PA player:', err);
    }
  }

  setVolume(vol: number): void {
    if (this.volumeNode) {
      this.volumeNode.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  stop(): void {
    this.isPlaying = false;
    this.lastSeq = -1;
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.nextPlayTime = this.audioCtx.currentTime;
    }
  }

  /** Seconds of already-scheduled audio that have not finished playing yet */
  getRemainingSeconds(): number {
    if (!this.audioCtx) return 0;
    return Math.max(0, this.nextPlayTime - this.audioCtx.currentTime);
  }

  getPlaying(): boolean {
    return this.isPlaying;
  }
}

export const globalPAPlayer = new PAPlayer();
