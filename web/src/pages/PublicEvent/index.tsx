import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Calendar,
  Users,
  QrCode,
  Phone,
  CheckCircle,
  AlertCircle,
  Share2,
  ArrowLeft,
} from 'lucide-react';
import { LogoMark } from '../../components/Logo';

export default function PublicEventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<any>(null);
  const [joinPage, setJoinPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Missing event code');
      setLoading(false);
      return;
    }

    api(`/api/events/${slug}`)
      .then((data: any) => {
        if (!data.event) {
          setError('Event not found');
          return;
        }
        setEvent(data.event);
        return api<any>(`/api/events/${slug}/join-page`);
      })
      .then((jp) => {
        if (jp) setJoinPage(jp.joinPage || null);
      })
      .catch(() => setError('Could not load event details'))
      .finally(() => setLoading(false));

    api<any>(`/api/events/${slug}/join-page`)
      .then((jp) => setJoinPage(jp.joinPage || null))
      .catch(() => {});
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f4ee] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading event…</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#f6f4ee] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-serif font-bold">Event not found</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </a>
        </div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/e/${slug}`;
  const formattedDate =
    event.date && event.date !== 'Invalid date'
      ? new Date(event.date).toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null;

  return (
    <div className="min-h-screen bg-[#f6f4ee] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 selection:bg-brand-600 selection:text-white transition-colors duration-200">
      <header className="border-b border-transparent dark:border-slate-800/60 backdrop-blur-md bg-[#f6f4ee]/80 dark:bg-[#090b0e]/80 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-5 py-4">
          <a href="/" className="flex items-center gap-2">
            <LogoMark className="w-7 h-7" />
            <span className="font-serif font-black text-lg tracking-tight text-slate-900 dark:text-white">gather</span>
          </a>
          <a
            href={`/e/${slug}/join`}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-slate-900 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-500 text-white px-5 py-2.5 rounded-full transition-colors duration-200 shadow-xs"
          >
            Join event
            <QrCode className="w-4 h-4" />
          </a>
        </div>
      </header>

      <main>
        <div className="max-w-3xl mx-auto px-5 pt-12 pb-16 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold bg-white border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-600 dark:text-slate-300">
            <Share2 className="w-3.5 h-3.5 text-brand-600" />
            {event.name}
          </span>

          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
            {event.name}
          </h1>

          {formattedDate && (
            <p className="mt-4 text-base text-slate-600 dark:text-slate-300">{formattedDate}</p>
          )}

          <div className="mt-5 text-center max-w-lg mx-auto">
            {joinPage?.subtitle ? (
              <p className="text-base text-slate-600 dark:text-slate-300">{joinPage.subtitle}</p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                One QR code, every guest a camera. Join with your phone and capture the moment from your own angle.
              </p>
            )}
            {joinPage?.instructions && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                {joinPage.instructions}
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={`/e/${slug}/join`}
              className="group inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-brand-600 text-white font-semibold px-7 py-4 rounded-full transition-colors duration-200 shadow-xs"
            >
              {joinPage?.joinButton || 'Join the event'}
              <QrCode className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="/host/setup"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 font-semibold px-7 py-4 rounded-full transition"
            >
              Host your own event
            </a>
          </div>

          {joinPage?.subtitle ? (
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
              {[
                'No app to install',
                'Works on any phone',
                'Host-controlled privacy',
              ].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-brand-600" />
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Event details card */}
        <div className="max-w-3xl mx-auto px-5 pb-20">
          <div className="bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Event details</p>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Date</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {event.date
                      ? new Date(event.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Not set'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Joining</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                    {event.joinOpen ? 'Open' : 'Closed'}
                    {event.requireApproval ? ' · approval required' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Event code</p>
                  <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">/{event.slug}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Invite link</p>
                  <a
                    href={joinUrl}
                    className="font-mono text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline break-all"
                    onClick={(e) => {
                      e.preventDefault();
                      navigator.clipboard.writeText(joinUrl);
                    }}
                  >
                    {joinUrl}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-2 font-serif font-black text-slate-900 dark:text-white">
            <LogoMark className="w-5 h-5" />
            gather
          </span>
          <div className="flex items-center gap-5 font-medium">
            <a href="/host/setup" className="hover:text-slate-900 dark:hover:text-white">Host setup</a>
            <a href="/dash" className="hover:text-slate-900 dark:hover:text-white">Console</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
