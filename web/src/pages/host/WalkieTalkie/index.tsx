import { useState, useEffect, useRef } from 'react';
import { HostLayout } from '../../../layouts/HostLayout';
import { api, getWsUrl } from '../../../lib/api';
import {
  Mic,
  Lock,
  Unlock,
  Bell,
  Users,
  UserCheck,
  AlertTriangle,
  Headphones,
  History,
} from 'lucide-react';
import { PABroadcaster } from '../../../lib/audio/paBroadcaster';
import { PAPlayer } from '../../../lib/audio/paPlayer';

interface BroadcastLog {
  id: string;
  timestamp: string;
  title: string;
  durationSeconds: number;
}

interface SavedVoiceMessage {
  id: string;
  fromName: string;
  toHost: boolean;
  toGuestNames: string[];
  startedAt: number;
  durationMs: number;
}

const PRESETS = [
  'Emergency Announcement',
  'Evacuate Through Designated Exits',
  'Severe Weather / Shelter in Place',
  'Medical Assistance Needed Immediately',
  'Lost Child / Family Reunion at Main Desk',
  'All Clear — Resume Normal Flow',
];

export default function HostWalkieTalkiePage() {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<any[]>([]);
  const [onlineGuestIds, setOnlineGuestIds] = useState<string[]>([]);
  const [targetType, setTargetType] = useState<'all' | 'direct'>('all');
  const [targetGuestId, setTargetGuestId] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(true);
  const [isSelfTest, setIsSelfTest] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [listeners, setListeners] = useState(0);
  const [topic, setTopic] = useState('Emergency Announcement');
  const [error, setError] = useState<string | null>(null);
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLog[]>([]);
  const [voiceMessages, setVoiceMessages] = useState<SavedVoiceMessage[]>([]);

  const broadcasterRef = useRef<PABroadcaster | null>(null);
  const selfTestPlayerRef = useRef<PAPlayer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isPttActiveRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // Saved guest voice messages (refresh every 10s)
  useEffect(() => {
    const load = () =>
      api('/api/host/voice-messages')
        .then((res: any) => setVoiceMessages(Array.isArray(res.messages) ? res.messages : []))
        .catch(() => {});
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api('/api/host/event')
      .then((data: any) => {
        setEvent(data.event);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api('/api/host/guests')
      .then((data: any) => {
        const guestList = data.guests || [];
        setGuests(guestList);
        if (guestList.length > 0 && !targetGuestId) {
          setTargetGuestId(guestList[0].id);
        }
      })
      .catch(() => {});

    // Connect to WebSocket broker
    const socket = new WebSocket(getWsUrl('/ws'));
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'pa_status' }));
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'pa_status') {
          setListeners(msg.connectedListeners || 0);
          if (Array.isArray(msg.onlineGuestIds)) {
            setOnlineGuestIds(msg.onlineGuestIds);
          }
        }
      } catch {}
    };

    const interval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'pa_status' }));
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      if (broadcasterRef.current?.isActive()) {
        broadcasterRef.current.stop();
      }
      socket.close();
      wsRef.current = null;
    };
  }, []);

  // Spacebar Push-to-Talk listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        if (isHandsFree) {
          if (!isBroadcasting) {
            startBroadcast();
          } else {
            stopBroadcast();
          }
        } else if (!isPttActiveRef.current) {
          isPttActiveRef.current = true;
          startBroadcast();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (!isHandsFree && e.code === 'Space' && isPttActiveRef.current && tag !== 'INPUT') {
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
  }, [isHandsFree, isBroadcasting, topic, isSelfTest, targetType, targetGuestId, guests]);

  const startBroadcast = async () => {
    if (isBroadcasting) return;
    setError(null);
    startTimeRef.current = Date.now();

    try {
      if (!broadcasterRef.current) {
        broadcasterRef.current = new PABroadcaster();
      }

      const selectedGuest = targetType === 'direct' ? guests.find((g) => g.id === targetGuestId) : null;
      const targetPayload = targetType === 'direct' && selectedGuest ? {
        targetGuestId: selectedGuest.id,
        targetName: selectedGuest.name,
      } : {};

      if (!isSelfTest) {
        // Broadcast pa_start over WebSocket
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'pa_start',
            alertTitle: topic.trim() || 'Emergency Announcement',
            sender: event?.name ? `${event.name} Host` : 'Host Console',
            ...targetPayload,
            timestamp: Date.now(),
          }));
        }
      } else {
        // Self-test local loop
        if (!selfTestPlayerRef.current) {
          selfTestPlayerRef.current = new PAPlayer();
        }
      }

      await broadcasterRef.current.start({
        onChunk: (base64Pcm, seq, sampleRate) => {
          if (!isSelfTest) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'pa_audio',
                pcm: base64Pcm,
                seq,
                sampleRate: sampleRate || 16000,
                ...targetPayload,
              }));
            }
          } else {
            selfTestPlayerRef.current?.feedBase64PCM(base64Pcm, sampleRate, seq);
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
      setError(err.message || 'Microphone access denied. Please allow microphone permissions.');
      setIsBroadcasting(false);
    }
  };

  const stopBroadcast = () => {
    const selectedGuest = targetType === 'direct' ? guests.find((g) => g.id === targetGuestId) : null;
    const targetPayload = targetType === 'direct' && selectedGuest ? {
      targetGuestId: selectedGuest.id,
      targetName: selectedGuest.name,
    } : {};

    if (broadcasterRef.current?.isActive()) {
      broadcasterRef.current.stop();
    }
    if (!isSelfTest && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'pa_stop', ...targetPayload }));
    }
    if (isSelfTest) {
      selfTestPlayerRef.current?.stop();
    }

    if (isBroadcasting && startTimeRef.current > 0) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const logTitle = isSelfTest
        ? `[Self-Test] ${topic}`
        : targetType === 'direct' && selectedGuest
        ? `[Direct to ${selectedGuest.name}] ${topic}`
        : topic;

      setBroadcastLogs((prev) => [
        {
          id: Math.random().toString(36).slice(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          title: logTitle,
          durationSeconds: Math.max(1, elapsed),
        },
        ...prev.slice(0, 9),
      ]);
    }

    setIsBroadcasting(false);
    setMicVolume(0);
  };

  const handlePttMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isHandsFree) {
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

  const selectedGuest = targetType === 'direct' ? guests.find((g) => g.id === targetGuestId) : null;

  const broadcastAttentionChime = () => {
    const targetPayload = targetType === 'direct' && selectedGuest ? {
      targetGuestId: selectedGuest.id,
      targetName: selectedGuest.name,
    } : {};

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'pa_start',
        alertTitle: targetType === 'direct' && selectedGuest ? `Direct Alert: ${selectedGuest.name}` : 'Attention: Host Alert Chime',
        sender: event?.name ? `${event.name} Host` : 'Host Console',
        ...targetPayload,
        timestamp: Date.now(),
      }));
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'pa_stop', ...targetPayload }));
        }
      }, 1500);

      setBroadcastLogs((prev) => [
        {
          id: Math.random().toString(36).slice(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          title: targetType === 'direct' && selectedGuest ? `[Alert Chime -> ${selectedGuest.name}]` : 'Emergency 2-Tone Attention Chime',
          durationSeconds: 2,
        },
        ...prev.slice(0, 9),
      ]);
    }
  };

  if (loading) {
    return (
      <HostLayout>
        <div className="py-20 text-center text-sand-500 text-sm">Loading Walkie-Talkie console…</div>
      </HostLayout>
    );
  }

  return (
    <HostLayout eventName={event?.name}>
      <div className="max-w-2xl mx-auto space-y-4 pb-8">
        {/* Compact Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-terracotta-500/15 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-serif font-bold text-sand-900 dark:text-sand-100 leading-tight">
                Walkie-Talkie PA
              </h1>
              <span className="text-[11px] text-sand-500 font-medium">
                {targetType === 'direct' && selectedGuest
                  ? `Direct to ${selectedGuest.name}`
                  : `${listeners} ${listeners === 1 ? 'device' : 'devices'} listening`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={broadcastAttentionChime}
              title="Broadcast 2-tone chime to alert all devices"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#fbf9f5] dark:bg-[#1a1715] hover:bg-[#f5f2ec] dark:hover:bg-[#201c19] border border-[#e2dcce] dark:border-[#332b25] text-xs font-semibold text-sand-800 dark:text-sand-200 transition shadow-2xs cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-ochre-600 dark:text-ochre-400" />
              <span>Chime</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-coral-50 dark:bg-coral-950/40 border border-coral-200 dark:border-coral-800 text-coral-800 dark:text-coral-300 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Compact Unified Cockpit Card */}
        <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-2xl p-5 shadow-xs space-y-4">
          {/* Top Controls: Audience & Topic */}
          <div className="space-y-3">
            {/* Audience Segmented Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="grid grid-cols-2 gap-1.5 flex-1 p-1 bg-[#f5f2ec] dark:bg-[#141210] rounded-xl border border-[#e2dcce]/70 dark:border-[#2f2822]">
                <button
                  type="button"
                  disabled={isBroadcasting}
                  onClick={() => setTargetType('all')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    targetType === 'all'
                      ? 'bg-terracotta-600 text-white shadow-2xs'
                      : 'text-sand-600 dark:text-sand-400 hover:text-sand-900 dark:hover:text-sand-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>All Devices ({listeners})</span>
                </button>

                <button
                  type="button"
                  disabled={isBroadcasting}
                  onClick={() => {
                    setTargetType('direct');
                    if (!targetGuestId && guests.length > 0) {
                      setTargetGuestId(guests[0].id);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    targetType === 'direct'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-sand-600 dark:text-sand-400 hover:text-sand-900 dark:hover:text-sand-100'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Specific Person</span>
                </button>
              </div>

              {targetType === 'direct' && (
                <div className="flex-1 min-w-[160px]">
                  {guests.length === 0 ? (
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">No registered guests yet</span>
                  ) : (
                    <select
                      disabled={isBroadcasting}
                      value={targetGuestId}
                      onChange={(e) => setTargetGuestId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-xs font-semibold text-sand-900 dark:text-sand-100 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
                    >
                      {guests.map((g) => {
                        const isOnline = onlineGuestIds.includes(g.id);
                        return (
                          <option key={g.id} value={g.id}>
                            {isOnline ? '🟢 ' : '⚪ '} {g.name}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Topic Input + Quick Presets Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={topic}
                disabled={isBroadcasting}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Announcement Banner Message"
                className="flex-1 px-3 py-2 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-xs font-medium text-sand-900 dark:text-sand-100 placeholder-sand-400 focus:outline-none focus:border-terracotta-500 disabled:opacity-60 shadow-2xs"
              />

              <select
                disabled={isBroadcasting}
                onChange={(e) => {
                  if (e.target.value) setTopic(e.target.value);
                }}
                value=""
                className="px-2.5 py-2 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-xs font-medium text-sand-700 dark:text-sand-300 focus:outline-none cursor-pointer"
              >
                <option value="" disabled>Preset templates...</option>
                {PRESETS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Center Intercom: Tactile PTT Button */}
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className="relative flex items-center justify-center">
              {isBroadcasting && (
                <span className={`absolute w-36 h-36 rounded-full pointer-events-none animate-ping ${
                  isSelfTest ? 'bg-ochre-500/20' : targetType === 'direct' ? 'bg-amber-500/25' : 'bg-coral-500/25'
                }`} />
              )}

              <button
                onMouseDown={handlePttMouseDown}
                onMouseUp={handlePttMouseUp}
                onTouchStart={handlePttMouseDown}
                onTouchEnd={handlePttMouseUp}
                className={`w-32 h-32 rounded-full flex flex-col items-center justify-center space-y-1.5 select-none shadow-xl transition-all duration-150 cursor-pointer ${
                  isBroadcasting
                    ? isSelfTest
                      ? 'bg-ochre-600 text-white ring-4 ring-ochre-400/50 scale-95 shadow-ochre-700/30'
                      : targetType === 'direct'
                      ? 'bg-amber-600 text-white ring-4 ring-amber-400/50 scale-95 shadow-amber-700/30'
                      : 'bg-coral-600 text-white ring-4 ring-coral-400/50 scale-95 shadow-coral-700/30'
                    : targetType === 'direct'
                    ? 'bg-amber-700 hover:bg-amber-600 text-white shadow-amber-950/20 active:scale-95'
                    : 'bg-terracotta-600 hover:bg-terracotta-500 text-white shadow-terracotta-900/20 active:scale-95'
                }`}
              >
                <Mic className={`w-9 h-9 ${isBroadcasting ? 'animate-bounce' : ''}`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-center px-2 line-clamp-1">
                  {isBroadcasting
                    ? isSelfTest
                      ? 'TESTING'
                      : targetType === 'direct' && selectedGuest
                      ? `LIVE -> ${selectedGuest.name}`
                      : 'ON AIR'
                    : isHandsFree
                    ? 'MIC LOCKED'
                    : targetType === 'direct' && selectedGuest
                    ? `TALK TO ${selectedGuest.name.toUpperCase()}`
                    : 'HOLD TO TALK'}
                </span>
              </button>
            </div>

            {/* Slim VU Meter Bar */}
            <div className="w-full max-w-xs space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-sand-500 dark:text-sand-400">
                <span>MIC LEVEL</span>
                <span className="font-bold text-sand-800 dark:text-sand-200">{Math.round(micVolume * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-[#f0eae0] dark:bg-[#141210] rounded-full overflow-hidden border border-[#e2dcce] dark:border-[#2f2822]">
                <div
                  className={`h-full transition-all duration-75 rounded-full ${
                    isBroadcasting
                      ? isSelfTest ? 'bg-ochre-500' : 'bg-coral-500'
                      : 'bg-terracotta-500'
                  }`}
                  style={{ width: `${Math.max(3, micVolume * 100)}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-sand-500 dark:text-sand-400 text-center">
              {isHandsFree
                ? isBroadcasting
                  ? 'Microphone locked open. Click button to stop.'
                  : 'Hands-Free ready. Click button to broadcast.'
                : 'Hold button or [Spacebar] to transmit.'}
            </p>
          </div>

          {/* Mode Toggles Row */}
          <div className="pt-3 border-t border-[#e2dcce]/70 dark:border-[#332b25]/70 flex items-center justify-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => {
                if (isBroadcasting) stopBroadcast();
                setIsHandsFree((v) => !v);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition cursor-pointer font-semibold ${
                isHandsFree
                  ? 'bg-ochre-50 dark:bg-ochre-950/40 border-ochre-300 dark:border-ochre-700 text-ochre-800 dark:text-ochre-300'
                  : 'bg-[#f5f2ec] dark:bg-[#141210] border-[#e2dcce] dark:border-[#2f2822] text-sand-600 dark:text-sand-400 hover:text-sand-900 dark:hover:text-sand-100'
              }`}
            >
              {isHandsFree ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>Hands-Free: {isHandsFree ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isBroadcasting) stopBroadcast();
                setIsSelfTest((v) => !v);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition cursor-pointer font-semibold ${
                isSelfTest
                  ? 'bg-sage-50 dark:bg-sage-950/40 border-sage-300 dark:border-sage-700 text-sage-800 dark:text-sage-300'
                  : 'bg-[#f5f2ec] dark:bg-[#141210] border-[#e2dcce] dark:border-[#2f2822] text-sand-600 dark:text-sand-400 hover:text-sand-900 dark:hover:text-sand-100'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Self-Test: {isSelfTest ? 'ON (Headphones)' : 'OFF (Live)'}</span>
            </button>
          </div>
        </div>

        {/* Compact Recent Transmissions Strip (Only if logs exist) */}
        {broadcastLogs.length > 0 && (
          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-2xl p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-sand-500">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-terracotta-600" />
                <span>Recent Transmissions</span>
              </div>
              <span className="font-mono text-sand-400">{broadcastLogs.length}</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {broadcastLogs.slice(0, 4).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce]/70 dark:border-[#2f2822] text-xs"
                >
                  <span className="truncate font-medium text-sand-900 dark:text-sand-100 max-w-[340px]">
                    {log.title}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-sand-500 font-mono shrink-0">
                    <span>{log.durationSeconds}s</span>
                    <span>•</span>
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saved Guest Voice Messages */}
        {voiceMessages.length > 0 && (
          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-2xl p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-sand-500">
              <div className="flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-terracotta-600" />
                <span>Guest Voice Messages</span>
              </div>
              <span className="font-mono text-sand-400">{voiceMessages.length}</span>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {voiceMessages.map((m) => (
                <div
                  key={m.id}
                  className="px-2.5 py-2 rounded-lg bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce]/70 dark:border-[#2f2822] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-sand-900 dark:text-sand-100">
                      {m.fromName} → {[m.toHost ? 'Host' : null, ...m.toGuestNames].filter(Boolean).join(', ')}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-sand-500 font-mono shrink-0">
                      <span>{Math.max(1, Math.round(m.durationMs / 1000))}s</span>
                      <span>•</span>
                      <span>{new Date(m.startedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <audio controls preload="none" src={`/api/host/voice-messages/${m.id}/audio`} className="w-full h-8" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </HostLayout>
  );
}
