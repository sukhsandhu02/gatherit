import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, X, Check } from 'lucide-react';
import { api, getWsUrl } from '../lib/api';
import { PABroadcaster } from '../lib/audio/paBroadcaster';

interface FellowGuest {
  id: string;
  name: string;
}

const MAX_TALK_MS = 60_000;

/**
 * Guest push-to-talk: floating mic button -> pick Host and/or specific guests -> tap to start/stop talking.
 * Audio goes only to the chosen recipients (never everyone).
 */
export function GuestTalkButton() {
  const [isGuest, setIsGuest] = useState(false);
  const [open, setOpen] = useState(false);
  const [guests, setGuests] = useState<FellowGuest[]>([]);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(['host']));
  const [talking, setTalking] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const broadcasterRef = useRef<PABroadcaster | null>(null);
  const holdingRef = useRef(false);
  const talkTimerRef = useRef<any>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Only show for logged-in guests
  useEffect(() => {
    api('/api/me')
      .then((res: any) => setIsGuest(!!res.guest))
      .catch(() => setIsGuest(false));
  }, []);

  const stopTalking = useCallback(() => {
    holdingRef.current = false;
    clearTimeout(talkTimerRef.current);
    if (broadcasterRef.current?.isActive()) {
      broadcasterRef.current.stop();
    }
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'gpa_stop' }));
    }
    setTalking(false);
    setLevel(0);
  }, []);

  // Socket + recipient list live only while the sheet is open
  useEffect(() => {
    if (!open) return;

    api('/api/me/event-guests')
      .then((res: any) => {
        if (Array.isArray(res.guests)) setGuests(res.guests);
      })
      .catch(() => {});

    const socket = new WebSocket(getWsUrl('/ws'));
    wsRef.current = socket;

    socket.onopen = () => socket.send(JSON.stringify({ type: 'pa_status' }));
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'pa_status' && Array.isArray(msg.onlineGuestIds)) {
          setOnlineIds(msg.onlineGuestIds);
        } else if (msg.type === 'gpa_error') {
          setError(msg.error || 'Could not send');
          stopTalking();
        }
      } catch {}
    };
    const interval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'pa_status' }));
    }, 4000);

    return () => {
      clearInterval(interval);
      stopTalking();
      socket.close();
      wsRef.current = null;
    };
  }, [open, stopTalking]);

  const toggleRecipient = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startTalking = async () => {
    const ws = wsRef.current;
    const targets = Array.from(selectedRef.current);
    if (targets.length === 0) {
      setError('Pick someone to talk to first.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone needs a secure (https) connection. Open the https link.');
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Still connecting. Try again in a moment.');
      return;
    }

    setError(null);
    holdingRef.current = true;
    setTalking(true);

    // Starting the mic first makes the browser show its permission prompt
    const broadcaster = new PABroadcaster();
    broadcasterRef.current = broadcaster;
    try {
      await broadcaster.start({
        onChunk: (pcm, seq, sampleRate) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'gpa_audio', pcm, seq, sampleRate }));
          }
        },
        onVolume: setLevel,
      });
      // Stopped while the mic permission prompt was open
      if (!holdingRef.current) {
        broadcaster.stop();
        return;
      }
      ws.send(JSON.stringify({ type: 'gpa_start', targets }));
      talkTimerRef.current = setTimeout(stopTalking, MAX_TALK_MS);
    } catch (err: any) {
      holdingRef.current = false;
      setTalking(false);
      setLevel(0);
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone blocked. Allow it in your browser site settings, then tap again.'
          : 'Microphone unavailable. Check mic access and try again.'
      );
    }
  };

  const toggleTalking = () => {
    if (talking) stopTalking();
    else startTalking();
  };

  if (!isGuest) return null;

  const canTalk = selected.size > 0;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Talk to host or guests"
          className="fixed right-4 bottom-20 z-40 w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center shadow-lg transition cursor-pointer"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <Mic className="w-5 h-5" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-x-0 bottom-16 z-50 px-3 pb-3"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Talk to</p>
                <p className="text-[10px] text-slate-400">Only the people you pick will hear you</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 flex flex-wrap gap-2 max-h-36 overflow-y-auto">
              {[{ id: 'host', name: 'Host', online: true }, ...guests.map((g) => ({ ...g, online: onlineIds.includes(g.id) }))].map((r) => {
                const isSelected = selected.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={!r.online || talking}
                    onClick={() => toggleRecipient(r.id)}
                    className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer disabled:opacity-40 ${
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span className="truncate max-w-[120px]">{r.name}</span>
                    {r.id !== 'host' && (
                      <span className={`w-1.5 h-1.5 rounded-full ${r.online ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="px-3.5 pb-3.5">
              {error && <p className="text-[11px] text-rose-500 mb-2">{error}</p>}
              <button
                type="button"
                disabled={!canTalk && !talking}
                onClick={toggleTalking}
                className={`w-full py-3 rounded-xl text-white font-semibold text-xs flex items-center justify-center space-x-2 transition select-none disabled:opacity-50 cursor-pointer shadow-xs ${
                  talking ? 'bg-rose-500' : 'bg-brand-600 hover:bg-brand-500'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>
                  {!canTalk ? 'Pick someone to talk to' : talking ? 'Talking… tap to stop' : 'Tap to talk'}
                </span>
                {talking && (
                  <span className="flex items-center gap-0.5 h-3">
                    {[0.4, 0.8, 0.6].map((m, i) => (
                      <span
                        key={i}
                        className="w-0.5 bg-white rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(3, level * 12 * m + 3)}px` }}
                      />
                    ))}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
