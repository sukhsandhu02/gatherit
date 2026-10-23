import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HostLayout } from '../../../layouts/HostLayout';
import { api } from '../../../lib/api';
import { Share2, HardDrive, Image, Users, Download, Lock, Globe } from 'lucide-react';

interface MediaCount {
  visibility: 'host' | 'selected' | 'all';
  label: string;
  count: number;
}

export default function HostSharingPage() {
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [counts, setCounts] = useState<MediaCount[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [perGuest, setPerGuest] = useState<{ name: string; shared: number; total: number }[]>([]);

  const fetchStats = async () => {
    try {
      const overview = await api('/api/host/overview');
      const guestsData = await api('/api/host/guests');
      const mediaData = await api('/api/host/media');

      const event = overview.event;
      const guests = (guestsData.guests || []) as any[];
      const media = (mediaData.media || []) as any[];

      const byVisibility: Record<string, number> = { host: 0, selected: 0, all: 0 };
      let bytes = 0;

      for (const m of media) {
        byVisibility[m.visibility] = (byVisibility[m.visibility] || 0) + 1;
        bytes += Number(m.sizeBytes || 0);
      }

      setCounts([
        { visibility: 'host', label: 'Host only', count: byVisibility.host },
        { visibility: 'selected', label: 'Shared with selected', count: byVisibility.selected },
        { visibility: 'all', label: 'Shared with everyone', count: byVisibility.all },
      ]);

      setTotalBytes(bytes);

      const guestTotals: Record<string, { name: string; shared: number; total: number }> = {};
      for (const g of guests) {
        guestTotals[g.id] = { name: g.name, shared: 0, total: 0 };
      }

      for (const m of media) {
        const entry = guestTotals[m.guestId];
        if (entry) {
          entry.total += 1;
          if (m.visibility === 'all') {
            for (const g of guests) {
              guestTotals[g.id].shared += 1;
            }
          } else if (m.visibility === 'selected') {
            // shared with specific guests only, so count is approximate here
          }
        }
      }

      setPerGuest(
        Object.values(guestTotals)
          .filter((g) => g.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
      );

      setEvent(event);
    } catch {
      navigate('/host/setup');
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const totalCount = counts.reduce((a, c) => a + c.count, 0);

  if (!loaded) {
    return (
      <HostLayout>
        <div className="py-20 text-center text-sand-500 dark:text-sand-400 text-sm">Loading sharing overview…</div>
      </HostLayout>
    );
  }

  return (
    <HostLayout eventName={event?.name}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-500/10 dark:bg-terracotta-500/20 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-sand-900 dark:text-sand-100 tracking-tight">Sharing & export</h2>
              <p className="text-xs text-sand-500 dark:text-sand-400 mt-1">
                What is private, shared with selected guests, or published to everyone.
              </p>
            </div>
          </div>

          <a
            href="/host/gallery"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-sand-700 dark:text-sand-300 hover:text-sand-900 dark:hover:text-sand-100 border border-[#e2dcce] dark:border-[#332b25] bg-[#fbf9f5] dark:bg-[#1a1715] hover:bg-[#f5f2ec] dark:hover:bg-[#201c19] transition"
          >
            <Image className="w-3.5 h-3.5" />
            Open gallery
          </a>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-4 shadow-xs">
            <Image className="w-5 h-5 text-sand-400 dark:text-sand-500" />
            <p className="mt-2 text-2xl font-serif font-bold text-sand-900 dark:text-sand-100">{totalCount}</p>
            <p className="text-[11px] text-sand-500 dark:text-sand-400">Total media items</p>
          </div>
          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-4 shadow-xs">
            <Lock className="w-5 h-5 text-coral-600 dark:text-coral-400" />
            <p className="mt-2 text-2xl font-serif font-bold text-sand-900 dark:text-sand-100">{counts.find((c) => c.visibility === 'host')?.count ?? 0}</p>
            <p className="text-[11px] text-sand-500 dark:text-sand-400">Private (host only)</p>
          </div>
          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-4 shadow-xs">
            <Users className="w-5 h-5 text-ochre-600 dark:text-ochre-400" />
            <p className="mt-2 text-2xl font-serif font-bold text-sand-900 dark:text-sand-100">{counts.find((c) => c.visibility === 'selected')?.count ?? 0}</p>
            <p className="text-[11px] text-sand-500 dark:text-sand-400">Shared with selected</p>
          </div>
          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-4 shadow-xs">
            <Globe className="w-5 h-5 text-sage-600 dark:text-sage-400" />
            <p className="mt-2 text-2xl font-serif font-bold text-sand-900 dark:text-sand-100">{counts.find((c) => c.visibility === 'all')?.count ?? 0}</p>
            <p className="text-[11px] text-sand-500 dark:text-sand-400">Shared with everyone</p>
          </div>
        </div>

        {/* Sharing breakdown */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
            <h3 className="font-serif font-bold text-sm text-sand-900 dark:text-sand-100">Sharing breakdown</h3>
            <p className="text-[11px] text-sand-500 dark:text-sand-400 mt-0.5 mb-4">How many items are in each sharing state.</p>

            <div className="space-y-3">
              {counts.map((c) => {
                const shade =
                  c.visibility === 'host'
                    ? 'bg-coral-500'
                    : c.visibility === 'selected'
                    ? 'bg-ochre-500'
                    : 'bg-sage-500';
                const pct = totalCount > 0 ? (c.count / totalCount) * 100 : 0;
                return (
                  <div key={c.visibility} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-sand-900 dark:text-sand-100">{c.label}</span>
                      <span className="ml-2 text-sand-400 dark:text-sand-500">{c.count}</span>
                    </div>
                    <div className="w-32 h-2 bg-[#f0eae0] dark:bg-[#231e1a] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${shade}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
            <h3 className="font-serif font-bold text-sm text-sand-900 dark:text-sand-100">Storage used</h3>
            <p className="text-[11px] text-sand-500 dark:text-sand-400 mt-0.5 mb-4">Total uploaded media size for this event.</p>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-serif font-bold text-sand-900 dark:text-sand-100">{formatBytes(totalBytes)}</span>
              <span className="text-xs text-sand-500 dark:text-sand-400">stored</span>
            </div>

            <div className="mt-4 space-y-2 text-xs text-sand-500 dark:text-sand-400">
              <div className="flex justify-between">
                <span>{counts.find((c) => c.visibility === 'all')?.count ?? 0} items shared with everyone</span>
                <span className="font-semibold text-sand-900 dark:text-sand-100">{formatBytes(Math.round((totalBytes * ((counts.find((c) => c.visibility === 'all')?.count ?? 0) / Math.max(1, totalCount)))))}</span>
              </div>
              <div className="flex justify-between">
                <span>{counts.find((c) => c.visibility === 'host')?.count ?? 0} items still private</span>
                <span className="font-semibold text-sand-900 dark:text-sand-100">{formatBytes(Math.round((totalBytes * ((counts.find((c) => c.visibility === 'host')?.count ?? 0) / Math.max(1, totalCount)))))}</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#e2dcce] dark:border-[#332b25] flex items-center justify-between">
              <span className="text-xs font-semibold text-sand-700 dark:text-sand-200">Guest downloads</span>
              <span className="text-xs text-sand-500 dark:text-sand-400">
                Guests can download shared media as a ZIP from their album.
              </span>
            </div>
          </div>
        </div>

        {/* Top contributors by media */}
        {perGuest.length > 0 && (
          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
            <h3 className="font-serif font-bold text-sm text-sand-900 dark:text-sand-100">Media by guest</h3>
            <p className="text-[11px] text-sand-500 dark:text-sand-400 mt-0.5 mb-4">
              Who has captured the most so far.
            </p>

            <div className="divide-y divide-[#e2dcce] dark:divide-[#332b25]">
              {perGuest.map((g) => (
                <div key={g.name} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#e7e1d7] dark:bg-[#25201c] text-sand-700 dark:text-sand-300 text-[11px] font-bold flex items-center justify-center">
                      {g.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-sand-900 dark:text-sand-100">{g.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sand-500 dark:text-sand-400">{g.shared} shared</span>
                    <span className="text-sand-900 dark:text-sand-100 font-semibold">{g.total} total</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export actions */}
        <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
          <h3 className="font-serif font-bold text-sm text-sand-900 dark:text-sand-100">Host export</h3>
          <p className="text-[11px] text-sand-500 dark:text-sand-400 mt-0.5 mb-4">
            Download the full media folder for this event from the gallery.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="/host/gallery"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta-600 hover:bg-terracotta-500 text-white text-xs font-semibold transition shadow-xs"
            >
              <HardDrive className="w-3.5 h-3.5" />
              Export all media
            </a>
            <a
              href="/host/gallery?visibility=all"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbf9f5] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-xs font-semibold text-sand-700 dark:text-sand-300 hover:bg-[#f5f2ec] dark:hover:bg-[#201c19] transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Only shared items
            </a>
          </div>

          <p className="mt-3 text-[11px] text-sand-500 dark:text-sand-400">
            The gallery also supports batch deletion, privacy changes, and per-item sharing controls.
          </p>
        </div>
      </div>
    </HostLayout>
  );
}
