export interface Group {
  id: string;
  name: string;
}

export interface Pass {
  id: string;
  name: string;
  role: 'camera' | 'viewer' | 'both';
  tokenHash: string;
  deviceId: string | null;
  revoked: boolean;
  canDownload: boolean;
  createdAt: string;
  groups: Group[];
}
