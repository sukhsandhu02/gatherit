import * as FileSystem from 'expo-file-system/legacy';
import { storage } from './storage';
import { OfflineQueueItem } from '../types';

type QueueListener = (items: OfflineQueueItem[]) => void;

class UploadQueueManager {
  private isProcessing = false;
  private listeners: Set<QueueListener> = new Set();

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    storage.getUploadQueue().then(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(items: OfflineQueueItem[]) {
    this.listeners.forEach((l) => l(items));
  }

  async enqueuePhoto(localUri: string): Promise<string> {
    const id = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);
    
    // Copy image to app's persistent storage so it survives cache clearing
    const mediaDir = await storage.getMediaDirectory();
    const destPath = `${mediaDir}${id}.jpg`;
    await FileSystem.copyAsync({ from: localUri, to: destPath });

    const item: OfflineQueueItem = {
      id,
      localUri: destPath,
      kind: 'photo',
      status: 'pending',
      createdAt: Date.now(),
      progress: 0,
      retryCount: 0,
    };

    await storage.addToUploadQueue(item);
    const updated = await storage.getUploadQueue();
    this.notify(updated);

    this.processQueue();
    return id;
  }

  async enqueueVideo(localUri: string): Promise<string> {
    const id = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);
    
    // Copy video to app's persistent storage
    const mediaDir = await storage.getMediaDirectory();
    const ext = localUri.endsWith('.mov') ? 'mov' : localUri.endsWith('.webm') ? 'webm' : 'mp4';
    const destPath = `${mediaDir}${id}.${ext}`;
    await FileSystem.copyAsync({ from: localUri, to: destPath });

    const item: OfflineQueueItem = {
      id,
      localUri: destPath,
      kind: 'video',
      status: 'pending',
      createdAt: Date.now(),
      progress: 0,
      retryCount: 0,
    };

    await storage.addToUploadQueue(item);
    const updated = await storage.getUploadQueue();
    this.notify(updated);

    this.processQueue();
    return id;
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const queue = await storage.getUploadQueue();
      const pendingItems = queue.filter((i) => i.status === 'pending' || i.status === 'failed');

      for (const item of pendingItems) {
        await this.uploadItem(item);
      }
    } finally {
      this.isProcessing = false;
      const current = await storage.getUploadQueue();
      this.notify(current);
    }
  }

  private async uploadItem(item: OfflineQueueItem) {
    const baseUrl = await storage.getServerUrl();
    const token = await storage.getToken();

    await storage.updateQueueItem(item.id, { status: 'uploading' });
    this.notify(await storage.getUploadQueue());

    try {
      const isVideo = item.kind === 'video' || /\.(mp4|webm|mov)$/i.test(item.localUri);
      const endpoint = isVideo ? '/api/upload/video' : '/api/upload/photo';
      const uploadUrl = `${baseUrl.replace(/\/+$/, '')}${endpoint}`;
      
      const response = await FileSystem.uploadAsync(uploadUrl, item.localUri, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          Cookie: token ? `guest_token=${token}` : '',
        },
      });

      if (response.status >= 200 && response.status < 300) {
        // Upload succeeded - remove from queue
        await storage.removeFromQueue(item.id);
      } else {
        await storage.updateQueueItem(item.id, {
          status: 'failed',
          retryCount: item.retryCount + 1,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (err: any) {
      await storage.updateQueueItem(item.id, {
        status: 'failed',
        retryCount: item.retryCount + 1,
        error: err.message || 'Network error',
      });
    }
  }
}

export const uploadQueue = new UploadQueueManager();
