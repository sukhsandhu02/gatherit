import { useState, useEffect, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import { HostLayout } from '../../../layouts/HostLayout';
import { Radio, Maximize2, Minimize2, Sparkles, AlertCircle, Share2 } from 'lucide-react';
import { api, getWsUrl } from '../../../lib/api';

interface LiveStreamTile {
  guestId: string;
  guestName: string;
  lastFrameTime: number;
  boosted: boolean;
}

// Dedicated hardware-accelerated Live Stream Tile using HTML5 Canvas (Memoized for zero re-render overhead)
const LiveCanvasTile = memo(function LiveCanvasTile({
  tile,
  isFocused,
  onToggleBoost,
  registerCanvas,
}: {
  tile: LiveStreamTile;
  isFocused: boolean;
  onToggleBoost: (guestId: string) => void;
  registerCanvas: (guestId: string, canvas: HTMLCanvasElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isStale = Date.now() - tile.lastFrameTime > 4000;

  useEffect(() => {
    registerCanvas(tile.guestId, canvasRef.current);
    return () => registerCanvas(tile.guestId, null);
  }, [tile.guestId, registerCanvas]);

  return (
    <div
      className={`bg-[#201c19] rounded-3xl overflow-hidden border transition relative group shadow-md ${
        isFocused ? 'ring-4 ring-[#a05e44]' : 'border-[#38312a]'
      }`}
    >
      <div className="w-full bg-[#161412] flex items-center justify-center relative overflow-hidden min-h-[260px] max-h-[460px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full max-h-[460px] object-contain transition-all"
        />

        {/* Stale / Reconnecting overlay */}
        {isStale && (
          <div className="absolute inset-0 bg-[#161412]/70 backdrop-blur-2xs flex items-center justify-center text-amber-300 text-xs font-semibold space-x-1.5">
            <AlertCircle className="w-4 h-4" />
            <span>Reconnecting...</span>
          </div>
        )}

        {/* Top Status Bar on Video */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center space-x-1.5 bg-[#161412]/80 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-semibold text-stone-200">
            <span className="w-2 h-2 rounded-full bg-[#53785e] animate-pulse" />
            <span>{tile.guestName}</span>
          </div>

          {tile.boosted && (
            <div className="bg-[#a05e44] text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>BOOSTED</span>
            </div>
          )}
        </div>

        {/* Focus / Boost overlay button */}
        <button
          onClick={() => onToggleBoost(tile.guestId)}
          className="absolute bottom-3 right-3 p-2 rounded-xl bg-[#161412]/80 hover:bg-[#161412] text-stone-200 text-xs font-semibold backdrop-blur-xs transition cursor-pointer flex items-center space-x-1.5"
        >
          {tile.boosted ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span>{tile.boosted ? 'Unboost' : 'Focus Boost'}</span>
        </button>
      </div>
    </div>
  );
});

export default function HostLivePage() {
  const [event, setEvent] = useState<any>(null);
  const [streams, setStreams] = useState<Map<string, LiveStreamTile>>(new Map());
  const [guestMap, setGuestMap] = useState<Map<string, string>>(new Map());
  const [focusedGuestId, setFocusedGuestId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const canvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const streamsRef = useRef<Map<string, LiveStreamTile>>(new Map());
  streamsRef.current = streams;

  const registerCanvas = (guestId: string, canvas: HTMLCanvasElement | null) => {
    if (canvas) {
      canvasesRef.current.set(guestId, canvas);
    } else {
      canvasesRef.current.delete(guestId);
    }
  };

  // Fetch event and guest names
  useEffect(() => {
    api('/api/host/event').then((res: any) => setEvent(res.event)).catch(() => {});
    api('/api/host/guests').then((res: any) => {
      const map = new Map<string, string>();
      for (const g of res.guests || []) {
        map.set(g.id, g.name);
      }
      setGuestMap(map);
    }).catch(() => {});
  }, []);

  const guestMapRef = useRef(guestMap);
  guestMapRef.current = guestMap;

  // Connect to Host WebSocket with auto-reconnect
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      socket = new WebSocket(getWsUrl('/ws'));
      socketRef.current = socket;
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        if (!isMounted) return;
        setWsConnected(true);
        socket?.send(JSON.stringify({ type: 'ping' }));
      };

      socket.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary frame: First 16 bytes are the guest UUID (hex parsed), remainder is JPEG blob
          const buffer = event.data;
          if (buffer.byteLength <= 16) return;

          const hexBytes = new Uint8Array(buffer, 0, 16);
          const hexStr = Array.from(hexBytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          // Format UUID with dashes: 8-4-4-4-12
          const guestId = `${hexStr.slice(0, 8)}-${hexStr.slice(8, 12)}-${hexStr.slice(12, 16)}-${hexStr.slice(16, 20)}-${hexStr.slice(20, 32)}`;

          const jpegData = new Uint8Array(buffer, 16);
          const blob = new Blob([jpegData], { type: 'image/jpeg' });

          // Ensure stream is registered in state if new
          const now = Date.now();
          const existing = streamsRef.current.get(guestId);
          if (!existing) {
            const guestName = guestMapRef.current.get(guestId) || `Camera ${guestId.slice(0, 4)}`;
            setStreams((prev) => {
              const next = new Map(prev);
              next.set(guestId, {
                guestId,
                guestName,
                lastFrameTime: now,
                boosted: false,
              });
              return next;
            });
          } else {
            existing.lastFrameTime = now;
          }

          // Direct hardware-accelerated canvas paint (0 DOM churn, 0 React re-renders)
          try {
            const bitmap = await createImageBitmap(blob);
            const canvas = canvasesRef.current.get(guestId);
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
            bitmap.close();
          } catch {
            // Frame decode error
          }
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 1500);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    // Stale stream cleanup timer (every 2s)
    const interval = setInterval(() => {
      const now = Date.now();
      setStreams((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, tile] of next) {
          // If no frame for 10s, remove stream tile
          if (now - tile.lastFrameTime > 10000) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(interval);
      socket?.close();
    };
  }, []);

  const handleToggleBoost = (guestId: string) => {
    const tile = streams.get(guestId);
    if (!tile || !socketRef.current) return;

    const newBoosted = !tile.boosted;
    socketRef.current.send(
      JSON.stringify({
        type: newBoosted ? 'boost' : 'unboost',
        guestId,
      })
    );

    setStreams((prev) => {
      const next = new Map(prev);
      next.set(guestId, { ...tile, boosted: newBoosted });
      return next;
    });

    setFocusedGuestId(newBoosted ? guestId : null);
  };

  const streamArray = Array.from(streams.values());

  return (
    <HostLayout eventName={event?.name}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-serif font-bold text-[#2b2621] dark:text-[#f5f2ec] tracking-tight">Live Camera Grid</h2>
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#edf5f0] dark:bg-[#19271e] text-[#4d7c5f] dark:text-[#699777] border border-[#c6dfcd] dark:border-[#263e2e] text-xs font-semibold">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>{streamArray.length} Live</span>
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono ${wsConnected ? 'bg-[#f0ebe1] dark:bg-[#25201c] text-[#5c5246] dark:text-[#c7bfb4]' : 'bg-[#fdf6ec] dark:bg-[#2b2014] text-[#b3732c] dark:text-[#d48d3b]'}`}>
                {wsConnected ? 'Socket Connected' : 'Connecting...'}
              </span>
            </div>
            <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] mt-1">
              Real-time guest camera previews. Click any stream to boost frame rate and view full size.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/host/map"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#201c19] hover:bg-[#faf6ef] dark:hover:bg-[#27211c] text-[#5c5246] dark:text-[#c7bfb4] border border-[#e7dfd3] dark:border-[#332b25] text-xs font-semibold shadow-xs transition"
            >
              <Share2 className="w-4 h-4 text-[#a05e44] dark:text-[#deb09d]" />
              <span>Device Mesh Graph</span>
            </Link>
          </div>
        </div>

        {streamArray.length === 0 ? (
          <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-16 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-[#f4efe6] dark:bg-[#2b2520] flex items-center justify-center mx-auto text-[#8c7e6c] dark:text-[#a69c8e]">
              <Radio className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-[#2b2621] dark:text-[#f5f2ec]">No active cameras streaming</h3>
              <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] max-w-sm mx-auto leading-relaxed">
                When guests open the camera on their phones, their live low-latency video preview tiles will automatically appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {streamArray.map((tile) => (
              <LiveCanvasTile
                key={tile.guestId}
                tile={tile}
                isFocused={focusedGuestId === tile.guestId}
                onToggleBoost={handleToggleBoost}
                registerCanvas={registerCanvas}
              />
            ))}
          </div>
        )}
      </div>
    </HostLayout>
  );
}
