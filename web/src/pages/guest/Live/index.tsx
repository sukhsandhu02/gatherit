import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestLayout } from '../../../layouts/GuestLayout';
import { api, getWsUrl } from '../../../lib/api';
import { ThemeToggle } from '../../../components/ThemeToggle';
import {
  Radio,
  Maximize2,
  Globe,
  UserCheck,
  AlertCircle,
  X,
  Eye,
  Camera,
} from 'lucide-react';

interface LiveStreamItem {
  guestId: string;
  guestName: string;
  isSharedToAll: boolean;
  lastFrameTime: number;
}

// Peer live stream tile
const PeerCanvasTile = memo(function PeerCanvasTile({
  stream,
  onFullscreen,
  registerCanvas,
}: {
  stream: LiveStreamItem;
  onFullscreen: (stream: LiveStreamItem) => void;
  registerCanvas: (guestId: string, canvas: HTMLCanvasElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isStale = Date.now() - stream.lastFrameTime > 4000;

  useEffect(() => {
    registerCanvas(stream.guestId, canvasRef.current);
    return () => registerCanvas(stream.guestId, null);
  }, [stream.guestId, registerCanvas]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs transition group">
      {/* Stream Card Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 font-bold text-xs flex items-center justify-center">
            {stream.guestName ? stream.guestName.slice(0, 2).toUpperCase() : 'GC'}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                {stream.guestName}
              </span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Live now</span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center space-x-1 ${
              stream.isSharedToAll
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
            }`}
          >
            {stream.isSharedToAll ? <Globe className="w-2.5 h-2.5" /> : <UserCheck className="w-2.5 h-2.5" />}
            <span>{stream.isSharedToAll ? 'All Guests' : 'Direct'}</span>
          </span>

          <button
            type="button"
            onClick={() => onFullscreen(stream)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            title="Expand Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="w-full bg-slate-950 aspect-4/3 relative flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full object-contain" />

        {/* Buffering Overlay */}
        {isStale && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xs flex flex-col items-center justify-center text-amber-400 text-xs font-medium space-y-1">
            <AlertCircle className="w-5 h-5 animate-pulse" />
            <span>Buffering feed...</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default function GuestLivePage() {
  const navigate = useNavigate();
  const [guestMe, setGuestMe] = useState<{ id: string; name: string } | null>(null);
  const [activeStreams, setActiveStreams] = useState<Map<string, LiveStreamItem>>(new Map());
  const [fellowGuests, setFellowGuests] = useState<Array<{ id: string; name: string }>>([]);
  const [fullscreenStream, setFullscreenStream] = useState<LiveStreamItem | null>(null);

  // WebSocket & Canvas refs
  const wsRef = useRef<WebSocket | null>(null);
  const canvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const streamsRef = useRef<Map<string, LiveStreamItem>>(new Map());
  streamsRef.current = activeStreams;

  const registerCanvas = useCallback((guestId: string, canvas: HTMLCanvasElement | null) => {
    if (canvas) {
      canvasesRef.current.set(guestId, canvas);
    } else {
      canvasesRef.current.delete(guestId);
    }
  }, []);

  // 1. Initial auth, peers and active streams fetch
  useEffect(() => {
    api('/api/me')
      .then((res: any) => {
        if (res.guest) {
          setGuestMe(res.guest);
        }
      })
      .catch((err: any) => {
        if (err.status === 401 || err.data?.pending) {
          navigate('/waiting', { replace: true });
        }
      });

    api('/api/me/event-guests')
      .then((res: any) => {
        if (Array.isArray(res.guests)) {
          setFellowGuests(res.guests);
        }
      })
      .catch(() => {});

    api('/api/guest/live-streams')
      .then((res: any) => {
        if (Array.isArray(res.streams)) {
          const map = new Map<string, LiveStreamItem>();
          for (const s of res.streams) {
            map.set(s.guestId, s);
          }
          setActiveStreams(map);
        }
      })
      .catch(() => {});
  }, [navigate]);

  // 2. Persistent WebSocket connection for live camera streams
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      socket = new WebSocket(getWsUrl('/ws'));
      wsRef.current = socket;
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        if (!isMounted) return;
        socket?.send(JSON.stringify({ type: 'watch_live_start' }));
      };

      socket.onmessage = async (event) => {
        // Binary live camera frame from peer
        if (event.data instanceof ArrayBuffer) {
          const buffer = event.data;
          if (buffer.byteLength <= 16) return;

          const hexBytes = new Uint8Array(buffer, 0, 16);
          const hexStr = Array.from(hexBytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          const streamerId = `${hexStr.slice(0, 8)}-${hexStr.slice(8, 12)}-${hexStr.slice(12, 16)}-${hexStr.slice(16, 20)}-${hexStr.slice(20, 32)}`;

          if (guestMe && streamerId === guestMe.id) return;

          const jpegData = new Uint8Array(buffer, 16);
          const blob = new Blob([jpegData], { type: 'image/jpeg' });
          const now = Date.now();

          const currentStreams = streamsRef.current;
          if (!currentStreams.has(streamerId)) {
            const matchGuest = fellowGuests.find((g) => g.id === streamerId);
            setActiveStreams((prev) => {
              const next = new Map(prev);
              next.set(streamerId, {
                guestId: streamerId,
                guestName: matchGuest?.name || 'Guest Cam',
                isSharedToAll: true,
                lastFrameTime: now,
              });
              return next;
            });
          } else {
            const existing = currentStreams.get(streamerId)!;
            existing.lastFrameTime = now;
          }

          try {
            const bitmap = await createImageBitmap(blob);
            const canvas = canvasesRef.current.get(streamerId);
            if (canvas) {
              if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
              }
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(bitmap, 0, 0);
              }
            }
          } catch {
            // Drop damaged frame
          }
          return;
        }

        // Text control messages
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'live_streams_sync' && Array.isArray(msg.streams)) {
              const map = new Map<string, LiveStreamItem>();
              for (const s of msg.streams) {
                map.set(s.guestId, s);
              }
              setActiveStreams(map);
            }
          } catch {}
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'watch_live_stop' }));
        socket.close();
      }
    };
  }, [fellowGuests, guestMe]);

  const streamList = Array.from(activeStreams.values());

  return (
    <GuestLayout>
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 flex flex-col transition-colors duration-200">
        {/* Sticky Header */}
        <header className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-lg font-bold text-slate-900 dark:text-white">Guest Live Feeds</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Watch live camera streams from other guests
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>{streamList.length} Live</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Live Feeds Grid */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>Live Streams ({streamList.length})</span>
            </h2>
          </div>

          {streamList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/50 border border-brand-100 dark:border-brand-900/60 mx-auto flex items-center justify-center text-brand-600 dark:text-brand-400">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white">
                  No Guests Live Right Now
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  When other guests share their camera live with everyone or specifically with you, their real-time video feeds will show up here.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/cam')}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Go to Camera to Share Mine</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {streamList.map((stream) => (
                <PeerCanvasTile
                  key={stream.guestId}
                  stream={stream}
                  onFullscreen={(s) => setFullscreenStream(s)}
                  registerCanvas={registerCanvas}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Viewer Modal */}
      {fullscreenStream && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="font-serif font-bold text-white text-base">
                {fullscreenStream.guestName}'s Live Cam
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFullscreenStream(null)}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative rounded-3xl overflow-hidden bg-slate-950">
            <canvas
              ref={(c) => {
                if (c) {
                  registerCanvas(fullscreenStream.guestId, c);
                }
              }}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="pt-3 text-center text-xs text-slate-400 font-mono">
            Low-latency peer live stream
          </div>
        </div>
      )}
    </GuestLayout>
  );
}
