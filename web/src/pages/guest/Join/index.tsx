import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Lock } from 'lucide-react';
import { LogoMark } from '../../../components/Logo';
import { JoinForm } from './components/JoinForm';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { api, setGuestToken } from '../../../lib/api';

export default function GuestJoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setFetchLoading(false);
      setError('No event code provided');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    setFetchLoading(true);
    setError(null);

    api(`/api/events/${slug}`, { signal: controller.signal })
      .then((data: any) => {
        setEvent(data.event);
        setError(null);
      })
      .catch((err: any) => {
        if (err.name === 'AbortError') {
          setError('Connection timed out. Check your Wi-Fi or network connection.');
        } else {
          setError(err.message || 'Event not found or unreachable');
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setFetchLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    setLoading(true);

    try {
      const data = await api(`/api/events/${slug}/join`, {
        method: 'POST',
        body: JSON.stringify({ name, phone, password }),
      });

      if (data.token) {
        setGuestToken(data.token);
      }

      if (data.guest.status === 'pending') {
        navigate('/waiting');
      } else {
        window.location.href = '/cam';
      }
    } catch (err: any) {
      if (err.data?.alreadyJoined) {
        setError('This phone has already joined. Please log in.');
      } else {
        setError(err.message || 'Failed to join');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090b0e] flex flex-col items-center justify-center p-6 text-slate-500 dark:text-slate-400 space-y-3">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium tracking-tight">Connecting to event...</p>
      </div>
    );
  }

  if (!event && error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090b0e] flex flex-col items-center justify-center p-6 text-center transition-colors duration-200 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="max-w-sm w-full bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">Unable to Load Event</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {error}
          </p>
          <div className="space-y-2 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition cursor-pointer"
            >
              Retry Connection
            </button>
            <a
              href="/"
              className="block w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (event && !event.joinOpen) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090b0e] flex flex-col items-center justify-center p-6 text-center transition-colors duration-200 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="max-w-sm w-full bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">{event.name}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Joining is currently closed for this event. If you already joined, you can log in below.
          </p>
          <a
            href={`/e/${slug}/login`}
            className="block py-3 px-4 rounded-xl bg-brand-600 text-white font-semibold text-xs transition"
          >
            Log in with Phone & Password
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-brand-600 selection:text-white transition-colors duration-200 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-[390px] w-full bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
        {/* Header with Serif title */}
        <div className="text-center space-y-1.5">
          <LogoMark className="w-12 h-12 mx-auto mb-1" />
          <h1 className="text-2xl font-serif font-bold tracking-tight text-slate-900 dark:text-white">
            {event?.name || 'Private Event'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Join to share your photos and videos</p>
        </div>

        {error && (
          <div className="flex items-center space-x-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <JoinForm
          name={name}
          setName={setName}
          phone={phone}
          setPhone={setPhone}
          password={password}
          setPassword={setPassword}
          loading={loading}
          onSubmit={handleSubmit}
          slug={slug || ''}
        />
      </div>
    </div>
  );
}
