import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HostLayout } from '../../../layouts/HostLayout';
import { QrCenterCard } from './components/QrCenterCard';
import { JoiningControlsCard } from './components/JoiningControlsCard';
import { api } from '../../../lib/api';

export default function HostEventPage() {
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchEvent = async () => {
    try {
      const data = await api('/api/host/event');
      if (!data.event) {
        navigate('/host/setup');
        return;
      }
      setEvent(data.event);
      // Always build joinUrl from the browser's own origin — the server's req.host is
      // always localhost:8080 when accessed locally, which is unreachable from other devices.
      // window.location.origin correctly reflects the Tailscale funnel URL, LAN IP, etc.
      setJoinUrl(`${window.location.origin}/e/${data.event.slug}`);
    } catch {
      navigate('/host/setup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, []);

  const handleToggleJoinOpen = async () => {
    if (!event) return;
    try {
      const res = await api('/api/host/event', {
        method: 'PATCH',
        body: JSON.stringify({ eventId: event.id, joinOpen: !event.joinOpen }),
      });
      setEvent(res.event);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleRequireApproval = async () => {
    if (!event) return;
    try {
      const res = await api('/api/host/event', {
        method: 'PATCH',
        body: JSON.stringify({ eventId: event.id, requireApproval: !event.requireApproval }),
      });
      setEvent(res.event);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <HostLayout>
        <div className="py-20 text-center text-slate-400">Loading event details...</div>
      </HostLayout>
    );
  }

  return (
    <HostLayout eventName={event?.name}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#2b2621] dark:text-[#f5f2ec] tracking-tight">Event Join QR & Access</h2>
            <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] mt-1">
              Share this single QR code with all guests to allow registration and capture.
            </p>
          </div>
          <a
            href="/host"
            className="text-xs font-semibold text-[#5c5246] dark:text-[#c7bfb4] hover:text-[#2b2621] dark:hover:text-white px-3.5 py-2 rounded-xl border border-[#e7dfd3] dark:border-[#332b25] bg-[#faf7f2] dark:bg-[#201c19] hover:bg-[#f4efe6] dark:hover:bg-[#27211c] transition"
          >
            ← Back to Overview
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* QR Code Center Card */}
          <QrCenterCard joinUrl={joinUrl} slug={event?.slug || ''} />

          {/* Joining Controls */}
          <JoiningControlsCard
            joinOpen={event?.joinOpen ?? true}
            onToggleJoinOpen={handleToggleJoinOpen}
            requireApproval={event?.requireApproval ?? false}
            onToggleRequireApproval={handleToggleRequireApproval}
          />
        </div>
      </div>
    </HostLayout>
  );
}
