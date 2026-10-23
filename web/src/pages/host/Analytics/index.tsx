import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HostLayout } from '../../../layouts/HostLayout';
import { api } from '../../../lib/api';
import { ArrowLeft, BarChart3, Users, Camera, Clock, HardDrive, Activity } from 'lucide-react';

interface HourSlot {
  hour: string;
  photos: number;
  videos: number;
  activeGuests: number;
}

interface GuestActivity {
  name: string;
  shots: number;
  firstAt: string;
  lastAt: string;
}

interface EventStats {
  event: any;
  windowStart: string;
  windowEnd: string;
  totalGuests: number;
  activeGuests: number;
  joinedDuringWindow: number;
  joinedThisHour: number;
  photos: number;
  videos: number;
  totalBytes: number;
  topShots: GuestActivity[];
  hourly: HourSlot[];
}

export default function HostAnalyticsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStats = async () => {
    try {
      const [overview, guestsData, mediaData] = await Promise.all([
        api('/api/host/overview'),
        api('/api/host/guests'),
        api('/api/host/media'),
      ]);

      const event = overview.event;
      const guests = (guestsData.guests || []) as any[];
      const media = (mediaData.media || []) as any[];

      const now = new Date();
      const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const activeGuests = guests.filter((g) => g.status === 'active').length;
      const joinedDuringWindow = guests.filter((g) => {
        if (!g.createdAt) return false;
        return new Date(g.createdAt) >= windowStart;
      }).length;

      const joinedThisHour = guests.filter((g) => {
        if (!g.createdAt) return false;
        const created = new Date(g.createdAt);
        const sameDay = created.toDateString() === now.toDateString();
        return sameDay && created.getHours() === now.getHours();
      }).length;

      const guestMap = new Map(guests.map((g) => [g.id, g.name]));

      const guestShots: Record<string, { shots: number; firstAt: string; lastAt: string }> = {};
      for (const m of media) {
        const entry = guestShots[m.guestId] || { shots: 0, firstAt: m.createdAt, lastAt: m.createdAt };
        entry.shots += 1;
        if (m.createdAt < entry.firstAt) entry.firstAt = m.createdAt;
        if (m.createdAt > entry.lastAt) entry.lastAt = m.createdAt;
        guestShots[m.guestId] = entry;
      }

      const topShots: GuestActivity[] = Object.entries(guestShots)
        .map(([id, d]) => ({
          name: guestMap.get(id) || 'Unknown',
          shots: d.shots,
          firstAt: d.firstAt,
          lastAt: d.lastAt,
        }))
        .sort((a, b) => b.shots - a.shots)
        .slice(0, 8);

      const hourly: HourSlot[] = [];
      for (let i = 23; i >= 0; i--) {
        const h = (now.getHours() - i + 24) % 24;
        const label = `${String(h).padStart(2, '0')}:00`;
        const startOfSlot = new Date(now);
        startOfSlot.setHours(h, 0, 0, 0);
        const endOfSlot = new Date(startOfSlot);
        endOfSlot.setHours(h, 59, 59, 999);

        const slotMedia = media.filter((m) => {
          const t = new Date(m.createdAt);
          return t >= startOfSlot && t <= endOfSlot;
        });

        const slotGuestIds = new Set<string>();
        for (const m of slotMedia) {
          slotGuestIds.add(m.guestId);
        }

        hourly.push({
          hour: label,
          photos: slotMedia.filter((m) => m.kind === 'photo').length,
          videos: slotMedia.filter((m) => m.kind === 'video').length,
          activeGuests: slotGuestIds.size,
        });
      }

      const totalBytes = media.reduce((acc, m) => acc + Number(m.sizeBytes || 0), 0);

      setStats({
        event,
        windowStart: windowStart.toISOString(),
        windowEnd: now.toISOString(),
        totalGuests: guests.length,
        activeGuests,
        joinedDuringWindow,
        joinedThisHour,
        photos: media.filter((m) => m.kind === 'photo').length,
        videos: media.filter((m) => m.kind === 'video').length,
        totalBytes,
        topShots,
        hourly,
      });
    } catch {
      navigate('/host/setup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshKey]);

  if (loading) {
    return (
      <HostLayout>
        <div className="py-20 text-center text-sand-500 dark:text-sand-400 text-sm">Loading analytics…</div>
      </HostLayout>
    );
  }

  if (!stats) {
    return (
      <HostLayout>
        <div className="py-20 text-center text-sand-500 dark:text-sand-400 text-sm">No analytics data</div>
      </HostLayout>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const maxHourlyPhotos = Math.max(1, ...stats.hourly.map((h) => h.photos));

  return (
    <HostLayout eventName={stats.event?.name}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-500/10 dark:bg-terracotta-500/20 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-sand-900 dark:text-sand-100 tracking-tight">Event analytics</h2>
              <p className="text-xs text-sand-500 dark:text-sand-400 mt-1">
                Last 24 hours, updated from captured media and guest activity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] text-xs font-semibold text-sand-700 dark:text-sand-300 hover:bg-[#f5f2ec] dark:hover:bg-[#201c19] transition shadow-xs"
            >
              <Activity className="w-3.5 h-3.5" />
              Refresh
            </button>
            <a
              href="/host"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-sand-700 dark:text-sand-300 hover:text-sand-900 dark:hover:text-sand-100 border border-[#e2dcce] dark:border-[#332b25] bg-[#fbf9f5] dark:bg-[#1a1715] hover:bg-[#f5f2ec] dark:hover:bg-[#201c19] transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Overview
            </a>
          </div>
        </div>

        {/* Headline cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Active guests"
            value={stats.activeGuests}
            sub={`${stats.joinedDuringWindow} joined in 24h`}
            tone="bg-sage-50 dark:bg-sage-950/40 text-sage-700 dark:text-sage-400"
          />
          <StatCard
            icon={Camera}
            label="Photos captured"
            value={stats.photos}
            sub={`${stats.videos} videos`}
            tone="bg-terracotta-50 dark:bg-terracotta-950/40 text-terracotta-700 dark:text-terracotta-400"
          />
          <StatCard
            icon={Clock}
            label="Joined this hour"
            value={stats.joinedThisHour}
            sub={`${stats.totalGuests} total guests`}
            tone="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
          />
          <StatCard
            icon={HardDrive}
            label="Media stored"
            value={formatBytes(stats.totalBytes)}
            sub="across all guests"
            tone="bg-sand-200/50 dark:bg-sand-800/40 text-sand-700 dark:text-sand-300"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Hourly capture chart */}
          <div className="lg:col-span-2 bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-serif font-bold text-sm text-sand-900 dark:text-sand-100">Capture volume by hour</h3>
                <p className="text-[11px] text-sand-500 dark:text-sand-400 mt-0.5">Photos and videos per hour, last 24 hours</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-terracotta-700 dark:text-terracotta-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-terracotta-500" /> Photos
                </span>
                <span className="flex items-center gap-1.5 text-sage-700 dark:text-sage-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-sage-500" /> Videos
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {stats.hourly.map((slot) => (
                <div key={slot.hour} className="flex items-center gap-3 text-xs">
                  <span className="w-12 font-mono text-sand-500 dark:text-sand-400 shrink-0">{slot.hour}</span>
                  <div className="flex-1 h-6 bg-[#f5f2ec] dark:bg-[#141210] rounded-lg overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-terracotta-500/80"
                      style={{ width: `${(slot.photos / maxHourlyPhotos) * 100}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-sage-500/80"
                      style={{ width: `${(slot.videos / Math.max(1, ...stats.hourly.map((h) => h.videos))) * 100}%` }}
                    />
                  </div>
                  <div className="w-24 text-right font-mono text-sand-600 dark:text-sand-400 shrink-0">
                    <span className="block leading-tight">{slot.photos}</span>
                    <span className="text-[10px] text-sand-400 dark:text-sand-500">{slot.videos} vid</span>
                  </div>
                  <span className="w-16 text-right text-[11px] text-sand-400 dark:text-sand-500 font-medium shrink-0">
                    {slot.activeGuests} guest{slot.activeGuests === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top contributors */}
          <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
            <h3 className="font-serif font-bold text-sm text-sand-900 dark:text-sand-100">Most active guests</h3>
            <p className="text-[11px] text-sand-500 dark:text-sand-400 mt-0.5 mb-4">By number of photos and videos</p>

            <div className="space-y-3">
              {stats.topShots.length === 0 ? (
                <div className="py-6 text-center text-xs text-sand-400">No media yet</div>
              ) : (
                stats.topShots.map((guest, idx) => (
                  <div
                    key={guest.name + guest.firstAt}
                    className="flex items-center gap-3 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] px-3.5 py-2.5"
                  >
                    <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-terracotta-600 text-white' : 'bg-[#e7e1d7] dark:bg-[#25201c] text-sand-700 dark:text-sand-300'}`}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-sand-900 dark:text-sand-100 truncate">{guest.name}</span>
                      <span className="text-[10px] text-sand-500 dark:text-sand-400 font-mono">
                        {new Date(guest.firstAt).toLocaleDateString()} → {new Date(guest.lastAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-sand-900 dark:text-sand-100">{guest.shots}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent join activity */}
        <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
          <h3 className="font-serif font-bold text-sm text-sand-900 dark:text-sand-100">Guest join activity</h3>
          <p className="text-[11px] text-sand-500 dark:text-sand-400 mt-0.5 mb-4">
            Guests who joined in the last 24 hours
          </p>

          {stats.topShots.length === 0 && stats.activeGuests === 0 ? (
            <div className="py-6 text-center text-xs text-sand-400">No recent guest activity</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {stats.topShots.slice(0, 6).map((guest) => (
                <div
                  key={guest.name + guest.firstAt}
                  className="flex items-center gap-3 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] p-3"
                >
                  <div className="w-9 h-9 rounded-full bg-terracotta-100 dark:bg-terracotta-950/40 text-terracotta-700 dark:text-terracotta-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {guest.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-sand-900 dark:text-sand-100 truncate">{guest.name}</span>
                    <span className="text-[11px] text-sand-500 dark:text-sand-400 font-mono">{guest.shots} shots</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </HostLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub: string;
  tone: string;
}) {
  return (
    <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-[11px] text-sand-500 dark:text-sand-400">{sub}</span>
      </div>
      <p className="mt-3 text-xl font-serif font-bold text-sand-900 dark:text-sand-100">{value}</p>
      <p className="mt-0.5 text-[11px] text-sand-500 dark:text-sand-400">{label}</p>
    </div>
  );
}
