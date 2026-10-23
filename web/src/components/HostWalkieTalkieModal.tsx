import React, { useState, useEffect, useRef } from 'react';
import { Radio, Mic, Lock, Unlock, X, Bell, Users, AlertTriangle } from 'lucide-react';
import { PABroadcaster } from '../lib/audio/paBroadcaster';

interface HostWalkieTalkieModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventName?: string;
}

export function HostWalkieTalkieModal({ isOpen, onClose, eventName }: HostWalkieTalkieModalProps) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [listeners, setListeners] = useState<number>(0);
  const [topic, setTopic] = useState('Emergency Announcement');
  const [error, setError] = useState<string | null>(null);

  const broadcasterRef = useRef<PABroadcaster | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isPttActiveRef = useRef(false);

  // Setup WebSocket connection to host relay
  useEffect(() => {
    if (!isOpen) {
      if (isBroadcasting) {
        stopBroadcast();
      }
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'pa_status' }));
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'pa_status') {
          setListeners(msg.connectedListeners || 0);
        }
      } catch {}
    };

    // Poll listener count periodically
    const statusInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'pa_status' }));
      }
    }, 4000);

    return () => {
      clearInterval(statusInterval);
      if (broadcasterRef.current?.isActive()) {
        broadcasterRef.current.stop();
      }
      socket.close();
      wsRef.current = null;
    };
  }, [isOpen]);

  // Spacebar Push-to-Talk listener
  useEffect(() => {
    if (!isOpen || isHandsFree) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isPttActiveRef.current && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        isPttActiveRef.current = true;
        startBroadcast();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPttActiveRef.current && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        isPttActiveRef.current = false;
        stopBroadcast();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, isHandsFree, topic]);

  const startBroadcast = async () => {
    if (isBroadcasting) return;
    setError(null);

    try {
      if (!broadcasterRef.current) {
        broadcasterRef.current = new PABroadcaster();
      }

      // Send pa_start packet over WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'pa_start',
          alertTitle: topic.trim() || 'Emergency Announcement',
          sender: eventName ? `${eventName} Host` : 'Host Console',
          timestamp: Date.now(),
        }));
      }

      await broadcasterRef.current.start({
        onChunk: (base64Pcm, seq, sampleRate) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'pa_audio',
              pcm: base64Pcm,
              seq,
              sampleRate: sampleRate || 16000,
            }));
          }
        },
        onVolume: (vol) => {
          setMicVolume(vol);
        },
        onError: (err) => {
          setError(err.message);
          stopBroadcast();
        },
      });

      setIsBroadcasting(true);
    } catch (err: any) {
      setError(err.message || 'Microphone access denied. Please grant microphone permission.');
      setIsBroadcasting(false);
    }
  };

  const stopBroadcast = () => {
    if (broadcasterRef.current?.isActive()) {
      broadcasterRef.current.stop();
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'pa_stop' }));
    }
    setIsBroadcasting(false);
    setMicVolume(0);
  };

  const handlePttMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isHandsFree) {
      // In hands-free mode, click toggles on/off
      if (isBroadcasting) {
        stopBroadcast();
      } else {
        startBroadcast();
      }
    } else {
      isPttActiveRef.current = true;
      startBroadcast();
    }
  };

  const handlePttMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isHandsFree && isPttActiveRef.current) {
      isPttActiveRef.current = false;
      stopBroadcast();
    }
  };

  const playChimeOnly = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'pa_start',
        alertTitle: 'Attention: Host Alert Chime',
        sender: eventName ? `${eventName} Host` : 'Host Console',
        timestamp: Date.now(),
      }));
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'pa_stop' }));
        }
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="max-w-md w-full bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-6 shadow-2xl space-y-5 text-sand-900 dark:text-sand-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e2dcce] dark:border-[#332b25]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-terracotta-500/15 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-sand-900 dark:text-sand-100">
                Emergency PA / Walkie-Talkie
              </h3>
              <p className="text-[11px] text-sand-500 dark:text-sand-400">
                Direct live voice broadcast to all connected devices
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[#f5f2ec] dark:hover:bg-[#201c19] text-sand-400 hover:text-sand-900 dark:hover:text-sand-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Listeners badge & Chime button */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822]">
          <div className="flex items-center gap-2 text-xs text-sand-600 dark:text-sand-300">
            <Users className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" />
            <span>
              <strong>{listeners}</strong> {listeners === 1 ? 'device' : 'devices'} listening live
            </span>
          </div>

          <button
            onClick={playChimeOnly}
            title="Broadcast attention chime without speaking"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#fbf9f5] dark:bg-[#1a1715] hover:bg-[#eae4d8] dark:hover:bg-[#201c19] border border-[#e2dcce] dark:border-[#332b25] text-xs font-semibold text-sand-700 dark:text-sand-200 transition cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-ochre-600 dark:text-ochre-400" />
            <span>Alert Chime</span>
          </button>
        </div>

        {/* Announcement Topic Input */}
        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-sand-500 dark:text-sand-400 mb-1.5">
            Announcement Banner Title
          </label>
          <input
            type="text"
            value={topic}
            disabled={isBroadcasting}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Evacuate East Exit / Weather Warning"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sm text-sand-900 dark:text-sand-100 placeholder-sand-400 dark:placeholder-sand-500 focus:outline-none focus:border-terracotta-500 disabled:opacity-60"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-coral-50 dark:bg-coral-950/40 border border-coral-200 dark:border-coral-800 text-coral-800 dark:text-coral-300 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Push-to-Talk Big Button */}
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring during transmission */}
            {isBroadcasting && (
              <span className="absolute w-36 h-36 rounded-full bg-coral-500/20 animate-ping pointer-events-none" />
            )}

            <button
              onMouseDown={handlePttMouseDown}
              onMouseUp={handlePttMouseUp}
              onTouchStart={handlePttMouseDown}
              onTouchEnd={handlePttMouseUp}
              className={`w-32 h-32 rounded-full flex flex-col items-center justify-center space-y-2 select-none shadow-xl transition-all duration-150 cursor-pointer ${
                isBroadcasting
                  ? 'bg-coral-600 text-white scale-95 ring-4 ring-coral-400/50 shadow-coral-600/30'
                  : 'bg-terracotta-600 hover:bg-terracotta-500 text-white shadow-terracotta-900/20 active:scale-95'
              }`}
            >
              {isBroadcasting ? (
                <>
                  <Mic className="w-10 h-10 animate-bounce" />
                  <span className="text-xs font-bold uppercase tracking-wider">LIVE ON AIR</span>
                </>
              ) : (
                <>
                  <Mic className="w-10 h-10" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isHandsFree ? 'Start Mic' : 'Hold to Talk'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Audio VU Bar */}
          <div className="w-full max-w-xs space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-sand-500 dark:text-sand-400">
              <span>MIC INPUT</span>
              <span>{Math.round(micVolume * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-[#f0eae0] dark:bg-[#141210] rounded-full overflow-hidden border border-[#e2dcce] dark:border-[#2f2822]">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  isBroadcasting ? 'bg-coral-500' : 'bg-terracotta-500'
                }`}
                style={{ width: `${Math.max(4, micVolume * 100)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-sand-500 dark:text-sand-400 text-center">
            {isHandsFree
              ? isBroadcasting
                ? 'Microphone locked open. Click button to end.'
                : 'Hands-free mode active. Click to broadcast continuously.'
              : 'Press & hold button (or spacebar) to transmit voice.'}
          </p>
        </div>

        {/* Footer controls: Hands-free toggle */}
        <div className="pt-3 border-t border-[#e2dcce] dark:border-[#332b25] flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              if (isBroadcasting) stopBroadcast();
              setIsHandsFree((v) => !v);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition cursor-pointer font-semibold ${
              isHandsFree
                ? 'bg-ochre-50 dark:bg-ochre-950/40 border-ochre-300 dark:border-ochre-700 text-ochre-800 dark:text-ochre-300'
                : 'bg-[#f5f2ec] dark:bg-[#141210] border-[#e2dcce] dark:border-[#2f2822] text-sand-600 dark:text-sand-400'
            }`}
          >
            {isHandsFree ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>Hands-Free Lock: {isHandsFree ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#f5f2ec] dark:bg-[#201c19] text-sand-700 dark:text-sand-300 hover:bg-[#eae4d8] dark:hover:bg-[#26211d] font-semibold border border-[#e2dcce] dark:border-[#332b25] transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
