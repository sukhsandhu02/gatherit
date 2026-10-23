import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Radio, AlertTriangle, X } from 'lucide-react';
import { globalPAPlayer } from '../lib/audio/paPlayer';

interface BroadcastState {
  active: boolean;
  ended: boolean;
  sender: string;
  title?: string;
  targetGuestId?: string | null;
  isMuted: boolean;
}

// Guest voice messages play one at a time; overlapping ones are buffered and played after a short gap
interface VoiceItem {
  id: string;
  sender: string;
  title?: string;
  targetGuestId?: string | null;
  chunks: { pcm: string; sampleRate: number; seq?: number }[];
  ended: boolean;
}
const VOICE_GAP_MS = 900;

export function EmergencyBroadcastBanner() {
  const [state, setState] = useState<BroadcastState>({
    active: false,
    ended: false,
    sender: 'Host Console',
    title: 'Emergency Announcement',
    targetGuestId: null,
    isMuted: false,
  });
  const [waveSeed, setWaveSeed] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);

  const mutedRef = useRef(false);
  mutedRef.current = state.isMuted;
  const activeVoiceRef = useRef<VoiceItem | null>(null);
  const voiceQueueRef = useRef<VoiceItem[]>([]);
  const voiceGapPendingRef = useRef(false);
  const voiceTimersRef = useRef<{ finish?: any; gap?: any; dismiss?: any }>({});

  useEffect(() => {
    const timers = voiceTimersRef.current;
    return () => {
      clearTimeout(timers.finish);
      clearTimeout(timers.gap);
      clearTimeout(timers.dismiss);
    };
  }, []);

  const feedVoiceChunk = (c: VoiceItem['chunks'][number]) => {
    if (mutedRef.current) return;
    globalPAPlayer.feedBase64PCM(c.pcm, c.sampleRate, c.seq);
    setWaveSeed((s) => (s + 1) % 100);
  };

  const finishActiveVoice = () => {
    activeVoiceRef.current = null;
    setState((prev) => ({ ...prev, ended: true }));
    const next = voiceQueueRef.current.shift();
    setQueuedCount(voiceQueueRef.current.length);
    if (next) {
      voiceGapPendingRef.current = true;
      voiceTimersRef.current.gap = setTimeout(() => {
        voiceGapPendingRef.current = false;
        activateVoice(next);
      }, VOICE_GAP_MS);
    } else {
      voiceTimersRef.current.dismiss = setTimeout(() => {
        setState((prev) => ({ ...prev, active: false, ended: false }));
      }, 3200);
    }
  };

  // Wait for already-scheduled audio to finish playing before moving on
  const scheduleVoiceFinish = () => {
    const waitMs = Math.ceil(globalPAPlayer.getRemainingSeconds() * 1000) + 100;
    voiceTimersRef.current.finish = setTimeout(finishActiveVoice, waitMs);
  };

  const activateVoice = (v: VoiceItem) => {
    activeVoiceRef.current = v;
    clearTimeout(voiceTimersRef.current.dismiss);
    globalPAPlayer.stop();
    setState((prev) => ({
      ...prev,
      active: true,
      ended: false,
      sender: v.sender,
      title: v.title || 'Voice message',
      targetGuestId: v.targetGuestId || null,
    }));
    if (!mutedRef.current) {
      globalPAPlayer.playEmergencyChime().catch(() => {});
    }
    v.chunks.forEach(feedVoiceChunk);
    v.chunks = [];
    if (v.ended) scheduleVoiceFinish();
  };

  const handleVoiceMessage = (msg: any) => {
    const id = String(msg.fromGuestId);
    const active = activeVoiceRef.current;
    const queued = voiceQueueRef.current.find((q) => q.id === id && !q.ended);
    const current = active && active.id === id && !active.ended ? active : queued;

    if (msg.type === 'pa_start') {
      if (current) return;
      const item: VoiceItem = {
        id,
        sender: msg.sender || 'Guest',
        title: msg.alertTitle,
        targetGuestId: msg.targetGuestId,
        chunks: [],
        ended: false,
      };
      if (!active && !voiceGapPendingRef.current) {
        activateVoice(item);
      } else {
        voiceQueueRef.current.push(item);
        setQueuedCount(voiceQueueRef.current.length);
      }
    } else if (msg.type === 'pa_audio') {
      if (!current || !msg.pcm) return;
      const chunk = { pcm: msg.pcm, sampleRate: msg.sampleRate || 16000, seq: msg.seq };
      if (current === active) feedVoiceChunk(chunk);
      else current.chunks.push(chunk);
    } else if (msg.type === 'pa_stop') {
      if (!current) return;
      current.ended = true;
      if (current === active) scheduleVoiceFinish();
    }
  };

  useEffect(() => {
    let dismissTimer: any = null;

    const handlePAMessage = (e: any) => {
      const msg = e.detail;
      if (!msg) return;

      if (msg.fromGuestId) {
        handleVoiceMessage(msg);
        return;
      }

      if (msg.type === 'pa_start') {
        clearTimeout(dismissTimer);
        setState((prev) => ({
          ...prev,
          active: true,
          ended: false,
          sender: msg.sender || 'Host Console',
          title: msg.alertTitle || 'Emergency Announcement',
          targetGuestId: msg.targetGuestId || null,
        }));
        if (!state.isMuted) {
          globalPAPlayer.playEmergencyChime().catch(() => {});
        }
      } else if (msg.type === 'pa_audio') {
        if (!state.isMuted && msg.pcm) {
          globalPAPlayer.feedBase64PCM(msg.pcm, msg.sampleRate || 16000, msg.seq);
          setWaveSeed((s) => (s + 1) % 100);
        }
      } else if (msg.type === 'pa_stop') {
        globalPAPlayer.stop();
        setState((prev) => ({ ...prev, ended: true }));
        dismissTimer = setTimeout(() => {
          setState((prev) => ({ ...prev, active: false, ended: false }));
        }, 3200);
      }
    };

    window.addEventListener('gather:pa_message', handlePAMessage);
    return () => {
      window.removeEventListener('gather:pa_message', handlePAMessage);
      clearTimeout(dismissTimer);
    };
  }, [state.isMuted]);

  const toggleMute = () => {
    const nextMuted = !state.isMuted;
    setState((prev) => ({ ...prev, isMuted: nextMuted }));
    globalPAPlayer.setVolume(nextMuted ? 0 : 1.0);
  };

  if (!state.active) return null;

  return (
    <aside
      aria-label="Emergency Broadcast"
      className="fixed top-2.5 sm:top-4 inset-x-2.5 sm:inset-x-4 max-w-md mx-auto z-50 pointer-events-auto select-none transition-all duration-300"
      style={{ top: 'max(env(safe-area-inset-top, 0px), 0.625rem)' }}
    >
      <div
        className={`p-2.5 sm:p-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all ${
          state.ended
            ? 'bg-[#1a1715]/95 border-[#423932] text-sand-300'
            : state.targetGuestId
            ? 'bg-[#8c4618]/95 dark:bg-[#68320e]/95 border-amber-500/80 text-white shadow-amber-950/40'
            : 'bg-[#b43e33]/95 dark:bg-[#7c251d]/95 border-coral-400 text-white shadow-coral-950/40'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Status Icon */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            {state.ended ? (
              <Radio className="w-4 h-4 text-sand-300" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-300 animate-pulse" />
            )}
          </div>

          {/* Text Area with Clean Wrapping and Truncation */}
          <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full shrink-0 leading-none ${
                  state.targetGuestId
                    ? 'bg-amber-400 text-stone-900 shadow-2xs'
                    : 'bg-white/20 text-white'
                }`}
              >
                {state.ended
                  ? 'Ended'
                  : state.targetGuestId
                  ? 'Direct To You'
                  : 'Live Host PA'}
              </span>
              <span className="text-[11px] text-white/85 truncate font-medium">
                {state.sender}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-white leading-snug line-clamp-2 break-words mt-0.5">
              {state.ended ? 'Host announcement has concluded' : state.title}
              {!state.ended && queuedCount > 0 && ` (+${queuedCount} waiting)`}
            </p>
          </div>

          {/* Actions & Mini Waveform */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!state.ended && (
              <div className="hidden xs:flex sm:flex items-center gap-0.5 h-4 px-1.5 bg-black/25 rounded-md">
                {[10, 16, 9].map((height, i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-white rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(3, (height * ((waveSeed + i * 3) % 5)) / 4)}px`,
                    }}
                  />
                ))}
              </div>
            )}

            <button
              onClick={toggleMute}
              title={state.isMuted ? 'Unmute PA audio' : 'Mute PA audio'}
              className="p-1.5 sm:p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition cursor-pointer"
            >
              {state.isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-amber-200" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>

            {state.ended && (
              <button
                onClick={() => setState((prev) => ({ ...prev, active: false }))}
                title="Dismiss"
                className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
