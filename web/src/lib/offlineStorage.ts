import { get, set, keys, createStore } from 'idb-keyval';

export interface OfflinePhoto {
  hash: string;
  blob: Blob;
  createdAt: number;
  authorId?: string;
}

const photoStore = createStore('gather-photos', 'photos');
const catalogStore = createStore('gather-catalog', 'catalog');

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
