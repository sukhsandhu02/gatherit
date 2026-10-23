import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HostLayout } from '../../../layouts/HostLayout';
import { api } from '../../../lib/api';
import { JoinPageEditor } from './components/JoinPageEditor';
import { ArrowLeft, Settings, QrCode, Shield, Trash2, Edit2, Copy, Check, AlertTriangle, LayoutGrid } from 'lucide-react';

export default function HostSettingsPage() {
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', date: '', joinOpen: true, requireApproval: false });
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [, setSaving] = useState(false);
  const [joinPage, setJoinPage] = useState<any>(null);
  const [joinPageLoading, setJoinPageLoading] = useState(true);
  const [joinPageSaving, setJoinPageSaving] = useState(false);
  const [showJoinEditor, setShowJoinEditor] = useState(false);

  const handleSave = async () => {
    void setSaving(true);
    void 0;
    setSuccess(null);
  };    const fetchJoinPage = async () => {
      setJoinPageLoading(true);
      try {
        const data: any = await api('/api/host/event/join-page');
        setJoinPage(data.joinPage || null);
      } catch {
        setJoinPage(null);
      } finally {
        setJoinPageLoading(false);
      }
    };

    const fetchEvent = async () => {
    try {
      const data = await api('/api/host/event');
      if (!data.event) {
        navigate('/host/setup');
        return;
      }
      setEvent(data.event);
      setForm({
        name: data.event.name || '',
        date: data.event.date || '',
        joinOpen: data.event.joinOpen ?? true,
        requireApproval: data.event.requireApproval ?? false,
      });
    } catch {
      navigate('/host/setup');
    } finally {
      setLoading(false);
    }
  };  useEffect(() => {
    fetchEvent();
    fetchJoinPage();
  }, []);

  void handleSave;

  const handleSaveReal = async () => {
    void setSaving(true);
    void 0;
    setSuccess(null);

    try {
      const res = await api('/api/host/event', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setEvent(res.event);
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleJoinPageSave = async (fields: any) => {
    setJoinPageSaving(true);
    try {
      const res: any = await api('/api/host/event/join-page', {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      setJoinPage(res.joinPage || null);
      setShowJoinEditor(false);
      setSuccess('Join page saved');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setJoinPageSaving(false);
    }
  };

  void handleSaveReal;


  const handleDelete = async () => {
    if (!event) return;
    if (!confirm(`Permanently delete "${event.name}" and all associated media? This cannot be undone.`)) return;
    try {
      await api(`/api/host/events/${event.id}`, { method: 'DELETE' });
      navigate('/host/setup');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const joinUrl = event ? `${window.location.origin}/e/${event.slug}` : '';

  const handleCopy = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <HostLayout>
        <div className="py-20 text-center text-sand-500 dark:text-sand-400 text-sm">Loading event settings…</div>
      </HostLayout>
    );
  }

  return (
    <HostLayout eventName={event?.name}>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-500/10 dark:bg-terracotta-500/20 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-sand-900 dark:text-sand-100 tracking-tight">Event settings</h2>
              <p className="text-xs text-sand-500 dark:text-sand-400 mt-1">
                Name, date, join rules, join page copy, and deletion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSaveReal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-terracotta-600 hover:bg-terracotta-500 transition shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Save changes
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

        {success && (
          <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-sage-50 dark:bg-sage-950/40 border border-sage-200 dark:border-sage-800/60 text-sage-800 dark:text-sage-300 text-xs font-semibold">
            <Check className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Event identity */}
        <section className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-sand-500 dark:text-sand-400 mb-4">
            <Edit2 className="w-3.5 h-3.5" />
            Event identity
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-sand-700 dark:text-sand-300 mb-1.5">Event name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sm text-sand-900 dark:text-sand-100 focus:outline-none focus:border-terracotta-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-sand-700 dark:text-sand-300 mb-1.5">Event date <span className="text-sand-400 font-normal">(optional)</span></label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sm text-sand-900 dark:text-sand-100 focus:outline-none focus:border-terracotta-500"
              />
            </div>
          </div>
        </section>

        {/* Join rules */}
        <section className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-sand-500 dark:text-sand-400 mb-4">
            <Shield className="w-3.5 h-3.5" />
            Guest access rules
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-[#e2dcce] dark:border-[#332b25] hover:border-[#cfc6b5] dark:hover:border-[#423932] cursor-pointer transition">
              <input
                type="checkbox"
                checked={form.joinOpen}
                onChange={(e) => setForm((f) => ({ ...f, joinOpen: e.target.checked }))}
                className="mt-0.5 accent-terracotta-600"
              />
              <div>
                <span className="text-sm font-semibold text-sand-900 dark:text-sand-100">Joining is open</span>
                <p className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">Guests can join immediately with a phone number and password.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-[#e2dcce] dark:border-[#332b25] hover:border-[#cfc6b5] dark:hover:border-[#423932] cursor-pointer transition">
              <input
                type="checkbox"
                checked={form.requireApproval}
                onChange={(e) => setForm((f) => ({ ...f, requireApproval: e.target.checked }))}
                className="mt-0.5 accent-terracotta-600"
              />
              <div>
                <span className="text-sm font-semibold text-sand-900 dark:text-sand-100">Require host approval</span>
                <p className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">New guests stay pending until you approve them on the guests page.</p>
              </div>
            </label>
          </div>
        </section>

        {/* QR and invite link */}
        <section className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-sand-500 dark:text-sand-400 mb-4">
            <QrCode className="w-3.5 h-3.5" />
            Invite link
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={joinUrl}
              readOnly
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-xs font-mono text-sand-700 dark:text-sand-300 focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition border ${
                copied
                  ? 'bg-sage-50 dark:bg-sage-950/40 border-sage-300 dark:border-sage-800 text-sage-800 dark:text-sage-300'
                  : 'bg-[#fbf9f5] dark:bg-[#1a1715] border-[#e2dcce] dark:border-[#332b25] text-sand-700 dark:text-sand-300 hover:bg-[#f5f2ec] dark:hover:bg-[#201c19]'
              }`}
            >
              {copied ? <><Check className="w-3.5 h-3.5 inline mr-1" /> Copied</> : <><Copy className="w-3.5 h-3.5 inline mr-1" /> Copy</>}
            </button>
          </div>

          <p className="mt-2 text-[11px] text-sand-500 dark:text-sand-400">
            Share this link or its QR code so guests can join the event.
          </p>
        </section>

        {/* Join page copy */}
        <section className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-sand-500 dark:text-sand-400">
              <LayoutGrid className="w-3.5 h-3.5" />
              Join page copy
            </div>
            <button
              type="button"
              onClick={() => setShowJoinEditor((v) => !v)}
              className="text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:text-terracotta-700 dark:hover:text-terracotta-300 transition"
            >
              {showJoinEditor ? 'Cancel' : 'Customize'}
            </button>
          </div>

          {showJoinEditor ? (
            <JoinPageEditor
              initial={joinPage || {}}
              saving={joinPageSaving}
              onSave={handleJoinPageSave}
              onLivePreview={() => {
                window.location.href = `/e/${event?.slug || ''}`;
              }}
            />
          ) : (
            <div className="text-xs text-sand-500 dark:text-sand-400">
              {joinPageLoading ? (
                'Loading join page copy…'
              ) : joinPage ? (
                <>Current title: {joinPage.title || '(default)'}</>
              ) : (
                'No join page settings yet.'
              )}
            </div>
          )}
        </section>

        {/* Delete event */}
        <section className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-coral-200 dark:border-coral-900/40 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-coral-600 dark:text-coral-400 mb-4">
            <Trash2 className="w-3.5 h-3.5" />
            Danger zone
          </div>

          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-coral-500 dark:text-coral-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-sand-900 dark:text-sand-100">Delete this event</p>
              <p className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">
                Removes the event, all guest accounts, and all captured media.
              </p>
              <button
                onClick={handleDelete}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-coral-600 hover:bg-coral-500 text-white text-xs font-semibold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete event
              </button>
            </div>
          </div>
        </section>
      </div>
    </HostLayout>
  );
}
