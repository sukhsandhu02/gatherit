import { savePhotoLocally, getPhotoLocally, setPeerCatalog, getPeerCatalog } from '../offlineStorage';

export type MeshMessage = 
  | { type: 'hello'; peerId: string; catalog: string[] }
  | { type: 'catalog_update'; peerId: string; hashes: string[] }
  | { type: 'request_chunk'; hash: string }
  | {
      type: 'location_ping';
      peerId: string;
      name?: string;
      role?: 'host' | 'guest';
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp: number;
    };

export class MeshPeer {
  pc: RTCPeerConnection;
  dc!: RTCDataChannel;
  peerId: string | null = null;
  
  onCatalogUpdate?: (peerId: string, hashes: string[]) => void;
  onPhotoReceived?: (hash: string) => void;
  onLocationUpdate?: (location: {
    peerId: string;
    name?: string;
    role?: 'host' | 'guest';
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
  }) => void;
  onClose?: () => void;

  private incomingHash: string | null = null;

  isInitiator: boolean;
  localId: string;
  onIceCandidateCallback: (candidate: RTCIceCandidate) => void;

  constructor(
    isInitiator: boolean,
    localId: string,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    iceServers: RTCIceServer[] = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ]
  ) {
    this.isInitiator = isInitiator;
    this.localId = localId;
    this.onIceCandidateCallback = onIceCandidate;
    this.pc = new RTCPeerConnection({
      iceServers: iceServers && iceServers.length > 0 ? iceServers : [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      ],
    });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.onIceCandidateCallback(e.candidate);
      }
    };

    if (this.isInitiator) {
      this.dc = this.pc.createDataChannel('mesh-data');
      this.setupDataChannel();
    } else {
      this.pc.ondatachannel = (e) => {
        this.dc = e.channel;
        this.setupDataChannel();
      };
    }

    this.pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(this.pc.connectionState)) {
        if (this.onClose) this.onClose();
      }
    };
  }

  setupDataChannel() {
    this.dc.binaryType = 'arraybuffer';
    
    this.dc.onopen = async () => {
      const catalog = await getPeerCatalog('local');
      this.sendMessage({ type: 'hello', peerId: this.localId, catalog });
    };

    this.dc.onclose = () => {
      if (this.onClose) this.onClose();
    };

    this.dc.onmessage = async (e) => {
      if (typeof e.data === 'string') {
        // It's a JSON message
        try {
          const msg = JSON.parse(e.data) as MeshMessage;
          if (msg.type === 'hello') {
            this.peerId = msg.peerId;
            await setPeerCatalog(msg.peerId, msg.catalog);
            if (this.onCatalogUpdate) this.onCatalogUpdate(msg.peerId, msg.catalog);
          } else if (msg.type === 'catalog_update') {
            await setPeerCatalog(msg.peerId, msg.hashes);
            if (this.onCatalogUpdate) this.onCatalogUpdate(msg.peerId, msg.hashes);
          } else if (msg.type === 'location_ping') {
            this.peerId = msg.peerId;
            if (this.onLocationUpdate) {
              this.onLocationUpdate({
                peerId: msg.peerId,
                name: msg.name,
                role: msg.role,
                latitude: msg.latitude,
                longitude: msg.longitude,
                accuracy: msg.accuracy,
                timestamp: msg.timestamp,
              });
            }
          } else if (msg.type === 'request_chunk') {
            const photo = await getPhotoLocally(msg.hash);
            if (photo) {
              const buffer = await photo.blob.arrayBuffer();
              // Send hash as string first, then binary buffer
              if (this.dc.readyState === 'open') {
                this.dc.send(`HASH:${msg.hash}`);
                this.dc.send(buffer);
              }
            }
          }
        } catch (err) {
          if (e.data.startsWith('HASH:')) {
            this.incomingHash = e.data.substring(5);
          }
        }
      } else if (e.data instanceof ArrayBuffer) {
        // It's binary data
        if (this.incomingHash) {
          const blob = new Blob([e.data], { type: 'image/jpeg' });
          const hash = await savePhotoLocally(blob, this.peerId || 'unknown');
          if (this.onPhotoReceived) this.onPhotoReceived(hash);
          this.incomingHash = null;
        }
      }
    };
  }

  sendMessage(msg: MeshMessage) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(msg));
    }
  }

  async close() {
    if (this.dc) this.dc.close();
    this.pc.close();
  }
}
