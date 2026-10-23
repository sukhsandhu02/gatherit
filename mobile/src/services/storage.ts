import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { GuestProfile, OfflineQueueItem } from '../types';

const TOKEN_KEY = '@gather_auth_token';
const GUEST_KEY = '@gather_guest_profile';
const EVENT_KEY = '@gather_event_slug';
const SERVER_URL_KEY = '@gather_server_url';
const QUEUE_KEY = '@gather_upload_queue';

// Default to local/USB adb reverse or user configured URL
export const DEFAULT_SERVER_URL = 'http://127.0.0.1:8080';

export const storage = {
  async getServerUrl(): Promise<string> {
    const url = await AsyncStorage.getItem(SERVER_URL_KEY);
    if (!url) return DEFAULT_SERVER_URL;

    // Sanitize any broken Tailscale funnel URL that had :8080 or :5173, but keep port 8443
    if (url.includes('omarchy.tailedcbcc.ts.net')) {
      if (url.includes(':8443')) return 'https://omarchy.tailedcbcc.ts.net:8443';
      return 'https://omarchy.tailedcbcc.ts.net';
    }
    // Stale subnet cleanup
    if (url.includes('192.168.1.9')) {
      return DEFAULT_SERVER_URL;
    }
    return url;
  },

  async setServerUrl(url: string): Promise<void> {
    let clean = (url || '').trim();
    if (clean.includes('omarchy.tailedcbcc.ts.net')) {
      clean = clean.includes(':8443')
        ? 'https://omarchy.tailedcbcc.ts.net:8443'
        : 'https://omarchy.tailedcbcc.ts.net';
    }
    await AsyncStorage.setItem(SERVER_URL_KEY, clean);
  },

  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },

  async getGuest(): Promise<GuestProfile | null> {
    const raw = await AsyncStorage.getItem(GUEST_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  async setGuest(guest: GuestProfile): Promise<void> {
    await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  },

  async clearGuest(): Promise<void> {
    await AsyncStorage.removeItem(GUEST_KEY);
  },

  async getEventSlug(): Promise<string | null> {
    return AsyncStorage.getItem(EVENT_KEY);
  },

  async setEventSlug(slug: string): Promise<void> {
    await AsyncStorage.setItem(EVENT_KEY, slug);
  },

  async getUploadQueue(): Promise<OfflineQueueItem[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  async setUploadQueue(queue: OfflineQueueItem[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  async addToUploadQueue(item: OfflineQueueItem): Promise<void> {
    const queue = await storage.getUploadQueue();
    queue.push(item);
    await storage.setUploadQueue(queue);
  },

  async updateQueueItem(id: string, updates: Partial<OfflineQueueItem>): Promise<void> {
    const queue = await storage.getUploadQueue();
    const idx = queue.findIndex(q => q.id === id);
    if (idx !== -1) {
      queue[idx] = { ...queue[idx], ...updates };
      await storage.setUploadQueue(queue);
    }
  },

  async removeFromQueue(id: string): Promise<void> {
    const queue = await storage.getUploadQueue();
    const updated = queue.filter(q => q.id !== id);
    await storage.setUploadQueue(updated);
  },

  async getMediaDirectory(): Promise<string> {
    const docDir = FileSystem.documentDirectory || '';
    const mediaDir = `${docDir}gather_media/`;
    const info = await FileSystem.getInfoAsync(mediaDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
    }
    return mediaDir;
  },
};
