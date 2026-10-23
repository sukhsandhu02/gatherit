/**
 * Host Emergency PA / Walkie-Talkie Audio Broadcaster
 * Captures microphone audio, downsamples/converts to 16kHz Int16 PCM chunks,
 * and passes base64 chunks for real-time WebSocket dispatch.
 */

export interface BroadcasterCallbacks {
  onChunk: (base64Pcm: string, seq: number, sampleRate: number) => void;
  onVolume?: (level: number) => void;
  onError?: (err: Error) => void;
}

export class PABroadcaster {
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isBroadcasting: boolean = false;
  private seq: number = 0;
  private callbacks: BroadcasterCallbacks | null = null;
  private volumeTimer: any = null;

  async start(callbacks: BroadcasterCallbacks): Promise<void> {
    if (this.isBroadcasting) return;
    this.callbacks = callbacks;
    this.seq = 0;

    try {
      // 1. Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      // 2. Setup AudioContext (attempt 16kHz, fallback to native hardware rate)
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      try {
        this.audioCtx = new AudioCtxClass({ sampleRate: 16000 });
      } catch {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const activeSampleRate = this.audioCtx.sampleRate;
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // 3. Analyser for live VU meter
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.sourceNode.connect(this.analyserNode);

      // 4. ScriptProcessorNode buffer (2048 samples = ~128ms per packet)
      const bufferSize = 2048;
      this.processorNode = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isBroadcasting) return;

        const inputChannel = e.inputBuffer.getChannelData(0);
        // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
        const int16 = new Int16Array(inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
          const s = Math.max(-1, Math.min(1, inputChannel[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convert Int16Array to Base64
        const uint8 = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
        let binary = '';
        const len = uint8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);

        this.seq++;
        this.callbacks?.onChunk(base64, this.seq, activeSampleRate);
      };

      this.sourceNode.connect(this.processorNode);
      // Connect to silent gain node (gain = 0) to prevent acoustic speaker feedback while keeping processor active
      const silentGain = this.audioCtx.createGain();
      silentGain.gain.value = 0;
      this.processorNode.connect(silentGain);
      silentGain.connect(this.audioCtx.destination);

      this.isBroadcasting = true;

      // Start volume level loop
      const pcmData = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.volumeTimer = setInterval(() => {
        if (!this.analyserNode || !this.isBroadcasting) return;
        this.analyserNode.getByteFrequencyData(pcmData);
        let sum = 0;
        for (let i = 0; i < pcmData.length; i++) {
          sum += pcmData[i];
        }
        const avg = sum / pcmData.length;
        const normalized = Math.min(1, avg / 128);
        this.callbacks?.onVolume?.(normalized);
      }, 60);

    } catch (err: any) {
      this.stop();
      this.callbacks?.onError?.(err);
      throw err;
    }
  }

  stop(): void {
    this.isBroadcasting = false;
    if (this.volumeTimer) {
      clearInterval(this.volumeTimer);
      this.volumeTimer = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.callbacks?.onVolume?.(0);
  }

  isActive(): boolean {
    return this.isBroadcasting;
  }
}
