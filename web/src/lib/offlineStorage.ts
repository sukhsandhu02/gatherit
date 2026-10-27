import { get, set, del, keys, createStore } from 'idb-keyval';
import { getApiUrl } from './api';

export interface OfflinePhoto {
  hash: string;
  blob: Blob;
  createdAt: number;
  authorId?: string;
}

export interface QueuedUpload {
  id: string;
  blob: Blob;
  kind: 'photo' | 'video';
  filename: string;
  mimeType: string;
  retries: number;
  createdAt: number;
}

const photoStore = createStore('gather-photos', 'photos');
const catalogStore = createStore('gather-catalog', 'catalog');
const uploadQueueStore = createStore('gather-upload-queue', 'uploads');

export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function savePhotoLocally(blob: Blob, authorId?: string): Promise<string> {
  const hash = await hashBlob(blob);
  const photo: OfflinePhoto = {
    hash,
    blob,
    createdAt: Date.now(),
    authorId
  };
  await set(hash, photo, photoStore);
  await addHashToCatalog('local', hash);
  return hash;
}

export async function getPhotoLocally(hash: string): Promise<OfflinePhoto | undefined> {
  return get(hash, photoStore);
}

export async function getAllLocalPhotos(): Promise<OfflinePhoto[]> {
  const allKeys = await keys(photoStore);
  const photos: OfflinePhoto[] = [];
  for (const k of allKeys) {
    const p = await get(k, photoStore);
    if (p) photos.push(p);
  }
  return photos.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPeerCatalog(peerId: string): Promise<string[]> {
  return (await get(peerId, catalogStore)) || [];
}

export async function addHashToCatalog(peerId: string, hash: string): Promise<void> {
  const catalog = await getPeerCatalog(peerId);
  if (!catalog.includes(hash)) {
    catalog.push(hash);
    await set(peerId, catalog, catalogStore);
  }
}

export async function setPeerCatalog(peerId: string, hashes: string[]): Promise<void> {
  await set(peerId, hashes, catalogStore);
}

export async function getKnownPeers(): Promise<string[]> {
  const all = await keys(catalogStore);
  return all.filter(k => k !== 'local') as string[];
}

// Upload Queue Management (Reliable Background Uploads with Backoff Retry)
export async function enqueueUpload(
  blob: Blob,
  kind: 'photo' | 'video',
  filename?: string,
  mimeType?: string
): Promise<string> {
  const id = `up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultExt = kind === 'video' ? 'mp4' : 'jpg';
  const item: QueuedUpload = {
    id,
    blob,
    kind,
    filename: filename || `${kind}_${Date.now()}.${defaultExt}`,
    mimeType: mimeType || blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    retries: 0,
    createdAt: Date.now(),
  };
  await set(id, item, uploadQueueStore);
  // Trigger processing asynchronously
  processUploadQueue().catch(() => {});
  return id;
}

export async function getQueuedUploads(): Promise<QueuedUpload[]> {
  const allKeys = await keys(uploadQueueStore);
  const items: QueuedUpload[] = [];
  for (const k of allKeys) {
    const item = await get(k, uploadQueueStore);
    if (item) items.push(item);
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeQueuedUpload(id: string): Promise<void> {
  await del(id, uploadQueueStore);
}

let isProcessingQueue = false;
export async function processUploadQueue(onUpdate?: (pendingCount: number) => void): Promise<void> {
  if (isProcessingQueue) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const pending = (await keys(uploadQueueStore)).length;
    onUpdate?.(pending);
    return;
  }

  isProcessingQueue = true;
  try {
    const items = await getQueuedUploads();
    onUpdate?.(items.length);

    for (const item of items) {
      if (item.retries > 6) {
        // Drop after 6 failed attempts to avoid endless retry loop
        await removeQueuedUpload(item.id);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', item.blob, item.filename);

        const endpoint = item.kind === 'video' ? '/api/upload/video' : '/api/upload/photo';
        const res = await fetch(getApiUrl(endpoint), {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (res.ok) {
          await removeQueuedUpload(item.id);
        } else {
          item.retries += 1;
          await set(item.id, item, uploadQueueStore);
          // Wait exponential backoff delay before next attempt
          const backoffMs = Math.min(30000, 1000 * Math.pow(2, item.retries));
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      } catch (uploadErr) {
        // Network offline / abort
        item.retries += 1;
        await set(item.id, item, uploadQueueStore);
        break; // stop loop if network error
      }
    }
  } finally {
    isProcessingQueue = false;
    const pending = (await keys(uploadQueueStore)).length;
    onUpdate?.(pending);
  }
}

// Auto-process upload queue when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processUploadQueue().catch(() => {});
  });
}
