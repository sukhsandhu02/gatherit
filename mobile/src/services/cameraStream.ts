import { storage } from './storage';
import { toByteArray, fromByteArray } from 'base64-js';
import * as Haptics from 'expo-haptics';

export type LiveStreamCallback = (status: 'connected' | 'disconnected' | 'reconnecting') => void;

export class LivePreviewStreamer {
  private socket: WebSocket | null = null;
  private isRunning: boolean = false;
  private reconnectTimer: any = null;
  private onStatusChange?: LiveStreamCallback;
  private isBoosted: boolean = false;

  constructor(onStatusChange?: LiveStreamCallback) {
    this.onStatusChange = onStatusChange;
  }

  async start() {
    this.isRunning = true;
    await this.connect();
  }

  private async connect() {
    if (!this.isRunning) return;

    try {
      const baseUrl = await storage.getServerUrl();
      const token = await storage.getToken();
      let wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
      if (token) {
        wsUrl += `?token=${encodeURIComponent(token)}`;
      }

      this.socket = new WebSocket(wsUrl);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        this.onStatusChange?.('connected');
      };

      this.socket.onclose = () => {
        this.onStatusChange?.('disconnected');
        if (this.isRunning) {
          this.reconnectTimer = setTimeout(() => {
            this.onStatusChange?.('reconnecting');
            this.connect();
          }, 2000);
        }
      };

      this.socket.onerror = () => {
        this.socket?.close();
      };

      this.socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const buffer = event.data;
          if (buffer.byteLength > 16) {
            const hexBytes = new Uint8Array(buffer, 0, 16);
            let hexStr = '';
            for (let i = 0; i < 16; i++) {
              hexStr += hexBytes[i].toString(16).padStart(2, '0');
            }
            const streamerId = `${hexStr.slice(0, 8)}-${hexStr.slice(8, 12)}-${hexStr.slice(12, 16)}-${hexStr.slice(16, 20)}-${hexStr.slice(20, 32)}`;
            const jpegBytes = new Uint8Array(buffer, 16);
            const base64Jpeg = fromByteArray(jpegBytes);
            this.frameListeners.forEach((fn) => fn(streamerId, base64Jpeg));
          }
          return;
        }

        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'boost') {
              this.isBoosted = true;
            } else if (msg.type === 'unboost') {
              this.isBoosted = false;
            } else if (msg.type === 'pa_start') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            }
            this.messageListeners.forEach((fn) => fn(msg));
          } catch {
            // ignore non-json
          }
        }
      };
    } catch (err) {
      this.onStatusChange?.('disconnected');
    }
  }

  sendFrame(frameBuffer: ArrayBuffer | string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(frameBuffer);
    }
  }

  sendBase64Frame(base64Str: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const cleanBase64 = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str;
        const bytes = toByteArray(cleanBase64);
        this.socket.send(bytes.buffer as ArrayBuffer);
      } catch {
        // frame drop
      }
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getBoosted(): boolean {
    return this.isBoosted;
  }

  private frameListeners: Set<(streamerId: string, base64Jpeg: string) => void> = new Set();
  private messageListeners: Set<(msg: any) => void> = new Set();

  addFrameListener(fn: (streamerId: string, base64Jpeg: string) => void) {
    this.frameListeners.add(fn);
    return () => {
      this.frameListeners.delete(fn);
    };
  }

  addMessageListener(fn: (msg: any) => void) {
    this.messageListeners.add(fn);
    return () => {
      this.messageListeners.delete(fn);
    };
  }

  sendShareConfig(shareMode: 'off' | 'host' | 'all' | 'selected', allowedGuestIds: string[] = [], guestName: string = 'Guest') {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'live_share_config',
          shareMode,
          allowedGuestIds,
          guestName,
        })
      );
    }
  }

  sendJson(payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  stop() {
    this.isRunning = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.frameListeners.clear();
    this.messageListeners.clear();
    this.onStatusChange?.('disconnected');
  }
}
