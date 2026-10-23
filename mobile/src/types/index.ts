export interface EventInfo {
  id: string;
  name: string;
  date: string;
  slug: string;
  joinOpen: boolean;
  requireApproval: boolean;
}

export interface GuestProfile {
  id: string;
  name: string;
  phone: string;
  status: 'active' | 'pending' | 'revoked';
  canDownload: boolean;
  mustChangePassword?: boolean;
}

export interface MediaItem {
  id: string;
  eventId: string;
  guestId: string;
  kind: 'photo' | 'video';
  path: string;
  thumbPath: string;
  sizeBytes: number;
  visibility: 'host' | 'all' | 'selected';
  createdAt: string;
  uploaderName?: string;
}

export interface OfflineQueueItem {
  id: string;
  localUri: string;
  kind: 'photo' | 'video';
  status: 'pending' | 'uploading' | 'failed' | 'synced';
  createdAt: number;
  progress: number;
  retryCount: number;
  error?: string;
}

export interface P2PMeshStats {
  peersConnected: number;
  offlinePhotosCount: number;
  isMeshActive: boolean;
}
