import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestLayout } from '../../../layouts/GuestLayout';
import { api, getApiUrl, getWsUrl, getGuestToken } from '../../../lib/api';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  Upload,
  FlipHorizontal,
  ChevronDown,
  Globe,
  Users,
  EyeOff,
  X,
  Check,
  Search,
  Shield,
} from 'lucide-react';
import { useMesh } from '../../../lib/p2p/MeshContext';

interface CameraErrorDetails {
  name: string;
  message: string;
  isPermissionDenied?: boolean;
  isInAppBrowser?: boolean;
  isUnsupported?: boolean;
}

function checkInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|Snapchat|MicroMessenger|musical_ly|ByteLocale/i.test(ua);
}

function checkCameraSupport(): { supported: boolean; details?: CameraErrorDetails } {
  if (typeof window === 'undefined') {
    return { supported: false, details: { name: 'NotSupportedError', message: 'Window is undefined' } };
  }

  if (
    window.isSecureContext === false &&
    window.location.protocol !== 'https:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return {
      supported: false,
      details: {
        name: 'InsecureContextError',
        message: 'Camera access requires a secure HTTPS connection. Please access GatherIt via HTTPS.',
        isUnsupported: true,
      },
    };
  }

  if (checkInAppBrowser()) {
    return {
      supported: false,
      details: {
        name: 'InAppBrowserError',
        message:
          'In-app browsers (Instagram, WhatsApp, TikTok, etc.) block camera access. Please open this link in Safari or Chrome.',
        isInAppBrowser: true,
      },
    };
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    return {
      supported: false,
      details: {
        name: 'NotSupportedError',
        message:
          'Your browser does not support in-browser camera streaming. Please open this link in Safari or Chrome, or use the system camera below.',
        isUnsupported: true,
      },
    };
  }

  return { supported: true };
}

export default function GuestCameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isMirrored, setIsMirrored] = useState(false);
  const [liveStreamEnabled, setLiveStreamEnabled] = useState(true);
  const [shareMode, setShareMode] = useState<'off' | 'host' | 'all' | 'selected'>('host');
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [fellowGuests, setFellowGuests] = useState<Array<{ id: string; name: string }>>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [bgUploadCount, setBgUploadCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [cameraError, setCameraError] = useState<CameraErrorDetails | null>(null);

  const { broadcastLocation } = useMesh();
  const guestNameRef = useRef<string | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const previewIntervalRef = useRef<any>(null);

  // Show transient toast
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const boostedRef = useRef(false);

  // Fetch fellow guests for live sharing selection
  useEffect(() => {
    api('/api/me/event-guests')
      .then((res: any) => {
        if (Array.isArray(res.guests)) {
          setFellowGuests(res.guests);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectShareMode = (mode: 'off' | 'host' | 'all' | 'selected', selectedIds = selectedGuestIds) => {
    setShareMode(mode);
    setSelectedGuestIds(selectedIds);
    const isStreaming = mode !== 'off';
    setLiveStreamEnabled(isStreaming);

    const configPayload = {
      type: 'live_share_config',
      shareMode: mode,
      allowedGuestIds: mode === 'selected' ? selectedIds : [],
      guestName: guestNameRef.current || 'Guest',
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(configPayload));
    }

    if (mode === 'off') {
      showToast('Live stream off (private)');
    } else if (mode === 'host') {
      showToast('Live stream: Host Only (Default)');
    } else if (mode === 'all') {
      showToast('Live stream: Shared with All Guests');
    } else if (mode === 'selected') {
      showToast(`Live stream: Shared with ${selectedIds.length} guest${selectedIds.length === 1 ? '' : 's'}`);
    }
  };

  // Setup WebSocket connection for live camera preview with auto-reconnection
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      socket = new WebSocket(getWsUrl('/ws'));
      socket.binaryType = 'arraybuffer';
      wsRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) return;
        setWsConnected(true);
        // Announce initial host share config
        socket?.send(JSON.stringify({
          type: 'live_share_config',
          shareMode: 'host',
          allowedGuestIds: [],
          guestName: guestNameRef.current || 'Guest',
        }));
      };

      socket.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
        // Automatically reconnect after 1.5 seconds if hotspot or network interface switched
        reconnectTimer = setTimeout(connect, 1500);
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'boost') boostedRef.current = true;
          else if (msg.type === 'unboost') boostedRef.current = false;
        } catch {
          // ignore non-JSON
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  // Session guard: check credentials when online, but stay in camera if offline
  useEffect(() => {
    api('/api/me').then((res: any) => {
      guestNameRef.current = res?.guest?.name;
    }).catch((err: any) => {
      // If server explicitly returned 401/pending, redirect. But if network failed (offline), do NOT bounce.
      if (err?.data?.pending) {
        navigate('/waiting', { replace: true });
      } else if (err?.status === 401) {
        if (!getGuestToken()) {
          navigate('/?join=1', { replace: true });
        }
      }
    });
  }, [navigate]);

  const broadcastLocationRef = useRef(broadcastLocation);
  broadcastLocationRef.current = broadcastLocation;

  // Periodic device GPS telemetry for connected location map and offline distance calculations
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    let watchId: number | null = null;
    let lastSent = 0;
    let lastLat: number | null = null;
    let lastLng: number | null = null;

    // Haversine distance in meters (inline, no import needed)
    const metersBetween = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371000;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const sendPos = (pos: GeolocationPosition) => {
      const now = Date.now();
      const { latitude, longitude, accuracy } = pos.coords;

      // Dead-zone filter: skip update if device hasn't moved more than 4m.
      // This eliminates GPS jitter oscillation when the device is stationary.
      const MOVE_THRESHOLD_M = 4;
      if (lastLat !== null && lastLng !== null) {
        const moved = metersBetween(lastLat, lastLng, latitude, longitude);
        if (moved < MOVE_THRESHOLD_M && now - lastSent < 10000) return;
      }

      // Also enforce a minimum 2s send interval even on movement
      if (now - lastSent < 2000) return;

      lastSent = now;
      lastLat = latitude;
      lastLng = longitude;
      broadcastLocationRef.current(latitude, longitude, accuracy, guestNameRef.current, 'guest');
    };

    try {
      watchId = navigator.geolocation.watchPosition(sendPos, () => {}, {
        enableHighAccuracy: true,  // Precise GNSS fix for accurate meter-level distance
        maximumAge: 0,             // Always request a fresh GPS fix (no cached position)
        timeout: 10000,
      });
    } catch {
      // Geolocation denied or unavailable
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Track whether initial permission has already been granted in this session
  const permissionGrantedRef = useRef(false);
  const isStartingCameraRef = useRef(false);

  // Helper to cleanly terminate any existing camera streams and wait for OS driver release
  const stopCurrentStream = async () => {
    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((t) => {
          t.stop();
          t.enabled = false;
        });
      } catch {
        // cleanup ignore
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // Give mobile OS camera server/driver 150ms to cleanly release sensor lock
    await new Promise((r) => setTimeout(r, 150));
  };

  // Initialize Camera Stream with soft constraints and fallback
  const startCamera = useCallback(async () => {
    if (isStartingCameraRef.current) return;
    isStartingCameraRef.current = true;

    try {
      setCameraError(null);

      // 1. Context and in-app browser validation
      const support = checkCameraSupport();
      if (!support.supported && support.details) {
        setCameraError(support.details);
        return;
      }

      await stopCurrentStream();

      // 2. Soft constraints: { ideal: facingMode }, audio: false
      const targetFacing = facingMode || 'environment';
      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err: any) {
        console.warn('Primary soft constraints failed:', err?.name, err?.message);
        // Fall back to { video: true } if OverconstrainedError is thrown or secondary fails
        if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: targetFacing } },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }
        } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
          // Hardware sensor temporarily busy (switching), pause 200ms and retry
          await new Promise((r) => setTimeout(r, 200));
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: targetFacing } },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }
        } else {
          // Fall back to bare { video: true }
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch {
            throw err;
          }
        }
      }

      if (!stream) {
        throw new Error('Unable to obtain camera feed.');
      }

      permissionGrantedRef.current = true;
      streamRef.current = stream;

      // 3. Configure video element (autoPlay, playsInline, muted) and call play()
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('video.play() failed on start:', playErr);
        }
      }

      // Configure video track focus if supported
      try {
        const track = stream.getVideoTracks()[0];
        if (track && 'applyConstraints' in track) {
          const caps: any = (track as any).getCapabilities ? (track as any).getCapabilities() : {};
          const adv: any = {};
          if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous';
          if (caps.exposureMode?.includes('continuous')) adv.exposureMode = 'continuous';
          if (caps.whiteBalanceMode?.includes('continuous')) adv.whiteBalanceMode = 'continuous';
          if (Object.keys(adv).length > 0) {
            await track.applyConstraints({ advanced: [adv] } as any);
          }
        }
      } catch {}
    } catch (err: any) {
      console.error('Camera access error:', err);
      const isPermissionDenied =
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') &&
        !permissionGrantedRef.current;

      setCameraError({
        name: err.name || 'CameraError',
        message: err.message || 'Could not access camera feed.',
        isPermissionDenied,
      });
    } finally {
      isStartingCameraRef.current = false;
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // Live camera stream encoder: ~10fps @ 800px (16fps @ 1280px boosted)
  // Perfectly calibrated for fluid real-time transmission without mobile lag or thermal throttling
  useEffect(() => {
    if (previewIntervalRef.current) clearTimeout(previewIntervalRef.current);

    if (!liveStreamEnabled) return;

    let cancelled = false;
    const encodeCanvas = document.createElement('canvas');

    const schedule = () => {
      if (cancelled) return;
      const delay = boostedRef.current ? 80 : 130;
      previewIntervalRef.current = setTimeout(tick, delay);
    };

    const tick = () => {
      const ws = wsRef.current;
      const video = videoRef.current;
      if (
        !ws ||
        ws.readyState !== WebSocket.OPEN ||
        ws.bufferedAmount > 16384 || // drop frame immediately if socket has >16KB pending to eliminate latency buildup
        !video ||
        video.readyState < 2 ||
        !video.videoWidth
      ) {
        schedule();
        return;
      }

      const ctx = encodeCanvas.getContext('2d');
      if (!ctx) {
        schedule();
        return;
      }

      const nativeW = video.videoWidth;
      const nativeH = video.videoHeight;
      const maxDim = boostedRef.current ? 640 : 420;
      const scale = Math.min(1, maxDim / Math.max(nativeW, nativeH));
      const targetW = Math.round(nativeW * scale);
      const targetH = Math.round(nativeH * scale);

      if (encodeCanvas.width !== targetW || encodeCanvas.height !== targetH) {
        encodeCanvas.width = targetW;
        encodeCanvas.height = targetH;
      }
      ctx.imageSmoothingEnabled = false; // Fast pixel blit

      if (isMirrored) {
        ctx.save();
        ctx.translate(targetW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, targetW, targetH);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, targetW, targetH);
      }

      encodeCanvas.toBlob(
        (blob) => {
          if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
            try {
              // ws.send(blob) natively dispatches binary data without .arrayBuffer() conversion overhead
              wsRef.current.send(blob);
            } catch {
              // socket error
            }
          }
          schedule();
        },
        'image/jpeg',
        boostedRef.current ? 0.55 : 0.40
      );
    };

    schedule();

    return () => {
      cancelled = true;
      if (previewIntervalRef.current) clearTimeout(previewIntervalRef.current);
    };
  }, [liveStreamEnabled]);

  // Flip camera (front / rear)
  const toggleFacingMode = () => {
    setFacingMode((prev) => {
      const nextFacing = prev === 'environment' ? 'user' : 'environment';
      setIsMirrored(nextFacing === 'user');
      return nextFacing;
    });
  };

  // Manual invert/mirror toggle (useful for landscape sensor flips)
  const toggleMirror = () => {
    setIsMirrored((prev) => !prev);
    showToast(!isMirrored ? 'Mirror / Invert enabled' : 'Mirror / Invert disabled');
  };

  // Tap to Focus: Applies focusMode and points of interest if supported by phone camera, and shows animated focus ring
  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    // Don't trigger if tapping on controls
    if ((e.target as HTMLElement).closest('button, input, label, a')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setFocusRing({ x, y });
    setTimeout(() => {
      setFocusRing((current) => (current?.x === x && current?.y === y ? null : current));
    }, 1500);

    // Apply hardware focus if supported by mobile browser
    try {
      const videoTrack = streamRef.current?.getVideoTracks()[0];
      if (videoTrack && 'applyConstraints' in videoTrack) {
        const capabilities: any = (videoTrack as any).getCapabilities ? (videoTrack as any).getCapabilities() : {};
        const constraints: any = { advanced: [] };

        if (capabilities.focusMode?.includes('continuous') || capabilities.focusMode?.includes('auto')) {
          constraints.advanced.push({ focusMode: 'continuous' });
        }
        if (capabilities.exposureMode?.includes('continuous')) {
          constraints.advanced.push({ exposureMode: 'continuous' });
        }

        if (constraints.advanced.length > 0) {
          await videoTrack.applyConstraints(constraints);
        }
      }
    } catch {
      // Focus capability optional on older WebViews
    }
  };

  // Client-side downscaler/compressor to keep uploads fast (~1-2MB max instead of 6-15MB raw phone uploads)
  const compressImage = async (blobOrFile: Blob | File, maxDim = 2560, quality = 0.88): Promise<Blob> => {
    return new Promise((resolve) => {
      // If image is already smaller than 1.5MB, keep as is
      if (blobOrFile.size < 1.5 * 1024 * 1024) {
        return resolve(blobOrFile);
      }

      const img = new Image();
      const url = URL.createObjectURL(blobOrFile);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(blobOrFile);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (result) => {
            resolve(result || blobOrFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blobOrFile);
      };
      img.src = url;
    });
  };

  // Upload photo in background without freezing the camera or shutter button
  const uploadPhotoInBackground = async (rawBlob: Blob | File) => {
    // If incoming file is a video, route directly to video handler
    if (rawBlob.type && rawBlob.type.startsWith('video/')) {
      return uploadVideoBlob(rawBlob, rawBlob.type);
    }

    setBgUploadCount((c) => c + 1);
    try {
      try {
        const { savePhotoLocally } = await import('../../../lib/offlineStorage');
        const hash = await savePhotoLocally(rawBlob);
        // Broadcast over P2P mesh
        try {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'catalog_update', hash }));
          }
        } catch {
          // ignore mesh broadcast failure
        }
      } catch (err) {
        console.warn('Failed to save offline:', err);
      }
      showToast('Photo captured & saved to local mesh!');

      try {
        const compressedBlob = await compressImage(rawBlob);
        const formData = new FormData();
        formData.append('file', compressedBlob, 'photo.jpg');

        const res = await fetch(getApiUrl('/api/upload/photo'), {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (res.ok) {
          showToast('Photo uploaded to host server!');
        }
      } catch {
        // Expected when disconnected/offline. Photo is already saved safely in IndexedDB and mesh
        console.log('Operating in pure offline mode. Photo stored locally in P2P mesh.');
      }
    } catch (err: any) {
      console.error('Background upload error:', err);
    } finally {
      setBgUploadCount((c) => Math.max(0, c - 1));
    }
  };

  // Upload video blob in background with offline storage backup
  const uploadVideoBlob = async (videoBlob: Blob | File, mimeType?: string) => {
    setBgUploadCount((c) => c + 1);
    try {
      // 1. Save offline in local IndexedDB
      try {
        const { savePhotoLocally } = await import('../../../lib/offlineStorage');
        const hash = await savePhotoLocally(videoBlob);
        try {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'catalog_update', hash }));
          }
        } catch {
          // ignore mesh broadcast failure
        }
      } catch (err) {
        console.warn('Failed to save video offline:', err);
      }
      showToast('Video saved locally!');

      // 2. Upload to server
      try {
        const detectedMime = mimeType || videoBlob.type || 'video/mp4';
        let ext = 'mp4';
        if (detectedMime.includes('webm')) ext = 'webm';
        else if (detectedMime.includes('quicktime') || detectedMime.includes('mov')) ext = 'mov';

        const formData = new FormData();
        formData.append('file', videoBlob, `video.${ext}`);

        const res = await fetch(getApiUrl('/api/upload/video'), {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (res.ok) {
          showToast('Video uploaded to host server!');
        } else {
          // Fallback to /api/upload/photo if needed
          const fbRes = await fetch(getApiUrl('/api/upload/photo'), {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });
          if (fbRes.ok) {
            showToast('Video uploaded to host server!');
          }
        }
      } catch {
        console.log('Operating in pure offline mode. Video stored locally in P2P mesh.');
      }
    } catch (err: any) {
      console.error('Background video upload error:', err);
      showToast(err.message || 'Failed to save video');
    } finally {
      setBgUploadCount((c) => Math.max(0, c - 1));
    }
  };

  // Capture Photo with native phone hardware processing or high-res frame
  const takePhoto = async () => {
    if (!videoRef.current) return;

    try {
      // 1. Try ImageCapture API (Chromium/Android) when not mirrored which grabs raw sensor resolution and ISP processing
      const videoTrack = streamRef.current?.getVideoTracks()[0];
      if (!isMirrored && videoTrack && (window as any).ImageCapture) {
        try {
          const imageCapture = new (window as any).ImageCapture(videoTrack);
          const blob = await imageCapture.takePhoto();
          if (blob) {
            uploadPhotoInBackground(blob);
            return;
          }
        } catch (icErr) {
          console.warn('ImageCapture fallback to canvas:', icErr);
        }
      }

      // 2. High-quality Canvas capture fallback (handles mirror/landscape inversion seamlessly)
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (isMirrored) {
        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, width, height);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            uploadPhotoInBackground(blob);
          }
        },
        'image/jpeg',
        0.92
      );
    } catch (err: any) {
      showToast(err.message || 'Capture error');
    }
  };

  // Video Recording Controls
  const startRecording = () => {
    if (!streamRef.current || isRecording) return;

    try {
      const stream = streamRef.current;
      recordedChunksRef.current = [];

      let mimeType = '';
      const supportedTypes = [
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      for (const t of supportedTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(1000); // 1-second chunks for continuous buffer population
      setIsRecording(true);
      setRecordDuration(0);
    } catch (err: any) {
      showToast(err.message || 'Could not start recording');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    const mediaRecorder = mediaRecorderRef.current;
    setIsRecording(false);
    setUploading(true);

    mediaRecorder.onstop = async () => {
      try {
        const chunks = recordedChunksRef.current;
        if (chunks.length > 0) {
          const mime = mediaRecorder.mimeType || 'video/webm';
          const videoBlob = new Blob(chunks, { type: mime });
          await uploadVideoBlob(videoBlob, mime);
        } else {
          showToast('No video recorded');
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to finalize video');
      } finally {
        setUploading(false);
      }
    };

    try {
      mediaRecorder.stop();
    } catch (err: any) {
      console.error('Error stopping MediaRecorder:', err);
      setUploading(false);
    }
  };

  // Recording timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <GuestLayout fullScreen hideNav={isRecording || showShareModal}>
      <div
        onClick={handleTapToFocus}
        className="relative w-full h-full bg-black flex flex-col justify-between overflow-hidden cursor-crosshair select-none touch-none"
      >
        {/* Hidden preview canvas for WebSockets */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewfinder Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${
            isMirrored ? '-scale-x-100' : ''
          }`}
        />

        {/* Animated Tap to Focus Ring */}
        {focusRing && (
          <div
            className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-amber-400 rounded-full animate-ping duration-700"
            style={{ left: focusRing.x, top: focusRing.y }}
          >
            <div className="absolute inset-2 border border-amber-300 rounded-full" />
          </div>
        )}

        {/* Top Floating Controls */}
        <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
          {/* Live Feed Toggle: Compact sleek pill */}
          <button
            onClick={() => setShowShareModal((prev) => !prev)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md transition active:scale-95 cursor-pointer ${
              shareMode === 'all'
                ? 'bg-rose-950/80 border-rose-500/80 text-rose-300'
                : shareMode === 'selected'
                ? 'bg-blue-950/80 border-blue-500/80 text-blue-300'
                : shareMode === 'host'
                ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300'
                : 'bg-black/50 border-white/20 text-slate-400'
            }`}
            title="Configure who can watch your live camera"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                shareMode === 'all'
                  ? 'bg-rose-500 animate-ping'
                  : shareMode === 'selected'
                  ? 'bg-blue-400 animate-pulse'
                  : shareMode === 'host'
                  ? 'bg-emerald-400'
                  : 'bg-slate-400'
              }`}
            />
            <span className="text-[10px] font-bold tracking-tight">
              {shareMode === 'all'
                ? 'Live'
                : shareMode === 'selected'
                ? `Live ${selectedGuestIds.length}`
                : shareMode === 'host'
                ? 'Host'
                : 'Off'}
            </span>
            <ChevronDown className={`w-2.5 h-2.5 opacity-60 transition-transform ${showShareModal ? 'rotate-180' : ''}`} />
            {!wsConnected && <WifiOff className="w-2.5 h-2.5 text-amber-400 ml-0.5" />}
          </button>

          {/* Mode Switcher */}
          <div className="flex bg-black/50 backdrop-blur-md rounded-full p-1 border border-white/10">
            <button
              onClick={() => {
                if (!isRecording) setMode('photo');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                mode === 'photo' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-300'
              }`}
            >
              Photo
            </button>
            <button
              onClick={() => {
                if (!isRecording) setMode('video');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                mode === 'video' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-300'
              }`}
            >
              Video
            </button>
          </div>

          {/* Mirror / Invert & Camera Flip Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMirror}
              className={`p-2.5 rounded-full backdrop-blur-md border active:scale-95 transition cursor-pointer ${
                isMirrored
                  ? 'bg-amber-500/30 text-amber-300 border-amber-400/60'
                  : 'bg-black/50 text-white border-white/15'
              }`}
              title="Toggle horizontal mirror / invert (for landscape & selfies)"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFacingMode}
              className="p-2.5 rounded-full bg-black/50 backdrop-blur-md text-white border border-white/15 active:scale-95 transition cursor-pointer"
              title="Switch camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {toast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-white/95 text-slate-900 text-xs font-bold px-4 py-2 rounded-2xl shadow-xl flex items-center space-x-2 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toast}</span>
          </div>
        )}

        {/* Camera Permission or Hardware Error */}
        {cameraError && (
          <div className="absolute inset-0 z-30 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3 shrink-0" />
            <h3 className="font-bold text-white text-base mb-1">
              {cameraError.isPermissionDenied
                ? 'Camera Permission Blocked'
                : cameraError.isInAppBrowser
                ? 'In-App Browser Detected'
                : 'Camera Unavailable'}
            </h3>

            {/* Error Name & Message Badge */}
            <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl px-3 py-1.5 my-2 text-[11px] font-mono text-rose-300 max-w-xs break-all">
              <span className="font-semibold">{cameraError.name}:</span> {cameraError.message}
            </div>

            {cameraError.isPermissionDenied ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 my-2 max-w-xs text-left text-xs space-y-2 text-slate-300">
                <p className="font-semibold text-white">How to unblock in 2 taps:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Tap the <span className="text-white font-bold">Lock icon 🔒</span> or <span className="text-white font-bold">Page settings</span> icon in your address bar</li>
                  <li>Tap <span className="text-white font-bold">Permissions</span> (or Site settings)</li>
                  <li>Switch <span className="text-white font-bold">Camera</span> to <span className="text-emerald-400 font-bold">Allow</span></li>
                </ol>
              </div>
            ) : cameraError.isInAppBrowser ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 my-2 max-w-xs text-left text-xs space-y-2 text-slate-300">
                <p className="font-semibold text-white">Open in your real browser:</p>
                <p className="text-slate-400">
                  Tap <span className="text-white font-bold">⋯</span> or <span className="text-white font-bold">⋮</span> in the top-right corner of this screen, then tap <span className="text-brand-400 font-bold">Open in Safari</span> or <span className="text-brand-400 font-bold">Open in Chrome</span>.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col w-full max-w-xs space-y-3 mt-3">
              <button
                onClick={startCamera}
                className="w-full py-3.5 rounded-2xl bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition shadow-md active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try again</span>
              </button>

              <label className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center space-x-2 border border-slate-700 cursor-pointer active:scale-95">
                <Upload className="w-4 h-4 text-slate-300" />
                <span>{mode === 'video' ? 'Or Record with System Camera' : 'Or Snap photo with System Camera'}</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.type.startsWith('video/')) {
                      uploadVideoBlob(file, file.type);
                    } else {
                      uploadPhotoInBackground(file);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {/* Video Recording Indicator */}
        {isRecording && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 bg-red-600/90 text-white px-3.5 py-1.5 rounded-full text-xs font-mono font-bold backdrop-blur-xs animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span>{formatSeconds(recordDuration)}</span>
          </div>
        )}

          {/* Bottom Shutter Trigger Controls */}
        <div className="relative z-20 pb-6 pt-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center justify-center">
          {/* Hidden input to invoke phone's native camera processing app */}
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              uploadPhotoInBackground(file);
              if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
            }}
          />

          {mode === 'photo' ? (
            <button
              type="button"
              onClick={takePhoto}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition p-1 cursor-pointer shadow-2xl relative"
            >
              <div className="w-full h-full rounded-full bg-white transition hover:scale-95" />
              {bgUploadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 border-2 border-black flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                  {bgUploadCount}
                </div>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition p-1 cursor-pointer disabled:opacity-50 shadow-2xl ${
                isRecording ? 'border-red-500' : 'border-white'
              }`}
            >
              <div
                className={`transition-all duration-200 ${
                  isRecording ? 'w-8 h-8 rounded-md bg-red-600' : 'w-full h-full rounded-full bg-red-600'
                }`}
              />
            </button>
          )}

          <p className="text-[11px] text-slate-300 font-medium mt-3 tracking-wide drop-shadow-md">
            {mode === 'photo'
              ? bgUploadCount > 0
                ? `Uploading ${bgUploadCount} photo${bgUploadCount > 1 ? 's' : ''} in background...`
                : 'Tap to capture'
              : isRecording
              ? 'Tap to stop recording'
              : bgUploadCount > 0
              ? `Uploading ${bgUploadCount} video${bgUploadCount > 1 ? 's' : ''} in background...`
              : 'Tap to start recording'}
          </p>
        </div>

        {/* Live Share Audience Floating Popover Toast (Anchored under top-left button, bottom controls remain 100% visible) */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-start pointer-events-none">
            {/* Click outside to close backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto cursor-pointer"
              onClick={() => setShowShareModal(false)}
            />

            {/* Floating Popover anchored directly below top button */}
            <div className="relative mt-14 mx-3 w-[calc(100%-1.5rem)] max-w-sm z-50 pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-slate-100 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[calc(100dvh-5.5rem)] flex flex-col">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
                <div>
                  <h3 className="text-xs font-bold tracking-wide uppercase text-slate-300">Live Camera Sharing</h3>
                  <p className="text-[11px] text-slate-400">Choose who can watch your feed</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Share Audience Options */}
              <div className="space-y-2 mt-3 shrink-0">
                {/* Host Only (Default) */}
                <button
                  type="button"
                  onClick={() => {
                    handleSelectShareMode('host');
                    setShowShareModal(false);
                  }}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-left ${
                    shareMode === 'host'
                      ? 'bg-emerald-950/50 border-emerald-500/80 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-white">Host Only (Default)</span>
                      <span className="text-[10px] text-slate-400">Stream live preview only to event host</span>
                    </div>
                  </div>
                  {shareMode === 'host' && <Check className="w-4 h-4 text-emerald-400" />}
                </button>

                {/* Off (Private) */}
                <button
                  type="button"
                  onClick={() => {
                    handleSelectShareMode('off');
                    setShowShareModal(false);
                  }}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-left ${
                    shareMode === 'off'
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center">
                      <EyeOff className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-white">Private (Off)</span>
                      <span className="text-[10px] text-slate-400">Stop streaming your live camera</span>
                    </div>
                  </div>
                  {shareMode === 'off' && <Check className="w-4 h-4 text-emerald-400" />}
                </button>

                {/* All Guests (Public) */}
                <button
                  type="button"
                  onClick={() => {
                    handleSelectShareMode('all');
                    setShowShareModal(false);
                  }}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-left ${
                    shareMode === 'all'
                      ? 'bg-rose-950/50 border-rose-500/80 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-white">All Guests (Public)</span>
                      <span className="text-[10px] text-slate-400">Anyone in this event can watch</span>
                    </div>
                  </div>
                  {shareMode === 'all' && <Check className="w-4 h-4 text-rose-400" />}
                </button>

                {/* Specific Guests */}
                <button
                  type="button"
                  onClick={() => {
                    setShareMode('selected');
                  }}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-left ${
                    shareMode === 'selected'
                      ? 'bg-blue-950/50 border-blue-500/80 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-white">
                        Specific Guests {selectedGuestIds.length > 0 ? `(${selectedGuestIds.length})` : ''}
                      </span>
                      <span className="text-[10px] text-slate-400">Stream live only to selected guests</span>
                    </div>
                  </div>
                  {shareMode === 'selected' && <Check className="w-4 h-4 text-blue-400" />}
                </button>
              </div>

              {/* Guest Checkboxes List (Shown when 'selected' is active) */}
              {shareMode === 'selected' && (
                <div className="space-y-2 pt-2.5 mt-2 border-t border-slate-800 animate-in fade-in duration-150 flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="relative shrink-0">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search fellow guests..."
                      value={guestSearch}
                      onChange={(e) => setGuestSearch(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5 shrink-0">
                    <span>{selectedGuestIds.length} of {fellowGuests.length} chosen</span>
                    <div className="flex gap-2 font-medium">
                      <button
                        type="button"
                        onClick={() => setSelectedGuestIds(fellowGuests.map((g) => g.id))}
                        className="text-blue-400 hover:underline cursor-pointer"
                      >
                        All
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedGuestIds([])}
                        className="text-slate-400 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto space-y-1 flex-1 min-h-[3rem] max-h-36 pr-0.5">
                    {fellowGuests.length === 0 ? (
                      <div className="py-2.5 text-center text-xs text-slate-500">
                        No other active guests in event
                      </div>
                    ) : (
                      fellowGuests
                        .filter((g) => g.name.toLowerCase().includes(guestSearch.toLowerCase()))
                        .map((guest) => {
                          const isSel = selectedGuestIds.includes(guest.id);
                          return (
                            <button
                              key={guest.id}
                              type="button"
                              onClick={() => {
                                setSelectedGuestIds((prev) =>
                                  isSel ? prev.filter((id) => id !== guest.id) : [...prev, guest.id]
                                );
                              }}
                              className={`w-full p-2 rounded-lg border flex items-center justify-between text-left transition cursor-pointer ${
                                isSel
                                  ? 'bg-blue-950/40 border-blue-500/60 text-white'
                                  : 'bg-slate-950/40 border-slate-800 text-slate-300'
                              }`}
                            >
                              <span className="text-xs truncate">{guest.name}</span>
                              <div
                                className={`w-4 h-4 rounded-sm border flex items-center justify-center ${
                                  isSel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700'
                                }`}
                              >
                                {isSel && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectShareMode('selected', selectedGuestIds);
                      setShowShareModal(false);
                    }}
                    className="shrink-0 mt-2.5 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition cursor-pointer active:scale-98"
                  >
                    Apply & Stream ({selectedGuestIds.length} Guests)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </GuestLayout>
  );
}
