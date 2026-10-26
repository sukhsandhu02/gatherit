import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HostLayout } from '../../../layouts/HostLayout';
import {
  Users,
  Camera,
  Radio,
  QrCode,
  ArrowUpRight,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { EventMetaCard } from '../Event/components/EventMetaCard';

export default function HostOverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  // Event Memory (Hindsight AI)
  const [memoryQuery, setMemoryQuery] = useState('');
  const [memoryResults, setMemoryResults] = useState<Array<{ text: string; type: string }> | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryUnavailable, setMemoryUnavailable] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const res: any = await api('/api/host/overview');
      setData(res);
      if (res?.event) {
        setName(res.event.name || '');
        setDate(res.event.date || '');
      }
    } catch {
      navigate('/host/setup');
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleMemoryRecall = async () => {
    const q = memoryQuery.trim();
    if (!q) return;
    setMemoryLoading(true);
    setMemoryResults(null);
    setMemoryUnavailable(false);
    setMemoryError(null);
    try {
      const res: any = await api('/api/host/memory/recall', {
        method: 'POST',
        body: JSON.stringify({ query: q }),
      });
      if (res.unavailable) {
        setMemoryUnavailable(true);
      } else {
        setMemoryResults(res.results ?? []);
      }
    } catch (err: any) {
      setMemoryError(err.message || 'Failed to query event memory.');
    } finally {
      setMemoryLoading(false);
    }
  };

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      const res: any = await api('/api/host/event', {
        method: 'PATCH',
        body: JSON.stringify({ eventId: data?.event?.id, name, date }),
      });
      if (res.event) {
        setData((prev: any) => ({ ...prev, event: res.event }));
      }
      alert('Event details updated successfully!');
    } catch (err: any) {
      alert('Error updating event: ' + err.message);
    } finally {
      setSavingMeta(false);
    }
  };

  return (
    <HostLayout eventName={data?.event?.name}>
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#2b2621] dark:text-[#f5f2ec] tracking-tight">Overview Dashboard</h2>
            <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] mt-1">Live metrics, guest count, and event configuration.</p>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href="/host/event"
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#a05e44] text-white font-semibold text-xs hover:bg-[#8e5038] transition shadow-2xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Event QR</span>
            </a>
          </div>
        </div>

        {/* Metric Cards Grid (Total Guests, Live Cameras, Photos Taken) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8c7e6c] dark:text-[#a69c8e]">Total Guests</span>
              <div className="w-8 h-8 rounded-xl bg-[#f4efe6] dark:bg-[#2b2520] flex items-center justify-center text-[#6e6459] dark:text-[#c7bfb4]">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-3xl font-serif font-bold text-[#2b2621] dark:text-[#f5f2ec]">{data?.guestsCount ?? 0}</span>
              <span className="block text-[11px] text-[#8c7e6c] dark:text-[#a69c8e]">
                {data?.pendingGuestsCount > 0 ? `${data.pendingGuestsCount} pending approval` : 'All approved'}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8c7e6c] dark:text-[#a69c8e]">Live Cameras</span>
              <div className="w-8 h-8 rounded-xl bg-[#eef5f0] dark:bg-[#1a2920] text-[#4d7c5f] dark:text-[#699777] flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-3xl font-serif font-bold text-[#4d7c5f] dark:text-[#699777]">{data?.connectedCamerasCount ?? 0}</span>
              <span className="block text-[11px] text-[#8c7e6c] dark:text-[#a69c8e]">Streaming live right now</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8c7e6c] dark:text-[#a69c8e]">Photos Taken</span>
              <div className="w-8 h-8 rounded-xl bg-[#faf3f0] dark:bg-[#2d1d17] text-[#a05e44] dark:text-[#deb09d] flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-3xl font-serif font-bold text-[#2b2621] dark:text-[#f5f2ec]">{data?.photosCount ?? 0}</span>
              <span className="block text-[11px] text-[#8c7e6c] dark:text-[#a69c8e]">Uploads processed</span>
            </div>
          </div>
        </div>

        {/* Event Details Section (Moved from Event & QR page) */}
        <div className="max-w-2xl">
          <EventMetaCard
            name={name}
            setName={setName}
            date={date}
            setDate={setDate}
            slug={data?.event?.slug || ''}
            onSave={handleSaveMeta}
            saving={savingMeta}
          />
        </div>

        {/* Quick Action Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="/host/event"
            className="group bg-white dark:bg-[#201c19] hover:bg-[#faf6ef] dark:hover:bg-[#27211c] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-6 transition shadow-xs flex items-center justify-between cursor-pointer"
          >
            <div className="space-y-1">
              <span className="text-base font-semibold text-[#2b2621] dark:text-[#f5f2ec] block group-hover:text-[#a05e44] dark:group-hover:text-[#deb09d] transition">
                Event QR & Settings
              </span>
              <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e]">Display QR code, toggle approval & joining</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-[#8c7e6c] group-hover:text-[#a05e44] dark:group-hover:text-[#deb09d] transition" />
          </a>

          <a
            href="/host/guests"
            className="group bg-white dark:bg-[#201c19] hover:bg-[#faf6ef] dark:hover:bg-[#27211c] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-6 transition shadow-xs flex items-center justify-between cursor-pointer"
          >
            <div className="space-y-1">
              <span className="text-base font-semibold text-[#2b2621] dark:text-[#f5f2ec] block group-hover:text-[#a05e44] dark:group-hover:text-[#deb09d] transition">
                Manage Guests
              </span>
              <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e]">Approve join requests, notify on WhatsApp</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-[#8c7e6c] group-hover:text-[#a05e44] dark:group-hover:text-[#deb09d] transition" />
          </a>

          <a
            href="/host/gallery"
            className="group bg-white dark:bg-[#201c19] hover:bg-[#faf6ef] dark:hover:bg-[#27211c] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-6 transition shadow-xs flex items-center justify-between cursor-pointer"
          >
            <div className="space-y-1">
              <span className="text-base font-semibold text-[#2b2621] dark:text-[#f5f2ec] block group-hover:text-[#a05e44] dark:group-hover:text-[#deb09d] transition">
                Gallery & Sharing
              </span>
              <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e]">Curate captured media and share with guests</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-[#8c7e6c] group-hover:text-[#a05e44] dark:group-hover:text-[#deb09d] transition" />
          </a>
        </div>

        {/* Event Memory — Hindsight AI (additive, non-destructive) */}
        <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#a05e44] dark:text-[#deb09d]" />
            <h3 className="text-sm font-semibold text-[#2b2621] dark:text-[#f5f2ec]">Event Memory</h3>
          </div>
          <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e]">
            Ask anything about this event — guest activity, uploads, and more.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={memoryQuery}
              onChange={(e) => setMemoryQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMemoryRecall()}
              placeholder="Ask about this event..."
              maxLength={500}
              className="flex-1 text-sm rounded-xl border border-[#e7dfd3] dark:border-[#332b25] bg-[#faf6ef] dark:bg-[#17120f] text-[#2b2621] dark:text-[#f5f2ec] placeholder-[#8c7e6c] dark:placeholder-[#a69c8e] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#a05e44]/40"
            />
            <button
              onClick={handleMemoryRecall}
              disabled={memoryLoading || !memoryQuery.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#a05e44] hover:bg-[#8e5038] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition shadow-2xs"
            >
              {memoryLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Ask
            </button>
          </div>

          {/* Results */}
          {memoryUnavailable && (
            <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] italic">
              Event Memory is not configured. Add <code className="font-mono">HINDSIGHT_API_KEY</code> and{' '}
              <code className="font-mono">HINDSIGHT_BASE_URL</code> to enable it.
            </p>
          )}
          {memoryError && (
            <p className="text-xs text-red-500 dark:text-red-400">{memoryError}</p>
          )}
          {memoryResults !== null && !memoryUnavailable && (
            <div className="space-y-2">
              {memoryResults.length === 0 ? (
                <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] italic">No memories found for that query.</p>
              ) : (
                memoryResults.map((r, i) => (
                  <div
                    key={i}
                    className="text-xs text-[#2b2621] dark:text-[#f5f2ec] bg-[#faf3f0] dark:bg-[#2d1d17] border border-[#f0e5d8] dark:border-[#3a2a20] rounded-xl px-4 py-2.5"
                  >
                    {r.text}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </HostLayout>
  );
}
