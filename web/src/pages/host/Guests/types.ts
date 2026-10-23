export interface Guest {
  id: string;
  name: string;
  phone: string;
  status: 'active' | 'pending' | 'blocked';
  canDownload: boolean;
  shotsCount: number;
  sharedWithThemCount: number;
  createdAt: string;
  lastSeenAt?: string;
}
