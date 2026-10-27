import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, AlertCircle } from 'lucide-react';
import { SetupForm } from './components/SetupForm';
import { ThemeToggle } from '../../components/ThemeToggle';
import { api } from '../../lib/api';

export default function HostSetup() {
  const navigate = useNavigate();
  const [hasEvent, setHasEvent] = useState<boolean | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isLoginMode, setIsLoginMode] = useState<boolean>(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api('/api/host/status')
      .then((data) => {
        setHasEvent(data.hasEvent);
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
          setSelectedEventId(data.events[0].id);
        }
        if (data.hasEvent) {
          setIsLoginMode(true);
        }
      })
      .catch(() => setHasEvent(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isLoginMode ? '/api/host/login' : '/api/host/setup';
      const payload = isLoginMode
        ? { password, eventId: selectedEventId || undefined }
        : { name, date, password };

      await api(endpoint, {
     method: 'POST',
     body: JSON.stringify(payload),
    });

      navigate('/host/event');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf9f5] dark:bg-[#161412] text-sand-900 dark:text-sand-100 flex flex-col items-center justify-center p-6 selection:bg-terracotta-600 selection:text-white transition-colors duration-200 relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-8 shadow-xl shadow-[#201a15]/5 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#f5f2ec] dark:bg-[#201c19] text-terracotta-700 dark:text-terracotta-400 mb-2 border border-[#e2dcce] dark:border-[#332b25]">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-sand-900 dark:text-sand-100">
            {isLoginMode ? 'Host Access' : 'Create New Event'}
          </h1>
          <p className="text-xs text-sand-500 dark:text-sand-400">
            {isLoginMode
              ? 'Enter your host master password to manage your event'
              : 'Setup a new private wedding or event lens'}
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#f5f2ec] dark:bg-[#141210] rounded-xl border border-[#e2dcce] dark:border-[#2f2822] text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(true);
              setError(null);
            }}
            className={`py-2 rounded-lg transition cursor-pointer ${
              isLoginMode ? 'bg-[#fbf9f5] dark:bg-[#201c19] text-sand-900 dark:text-sand-100 shadow-2xs' : 'text-sand-500 dark:text-sand-400 hover:text-sand-900 dark:hover:text-sand-100'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(false);
              setError(null);
            }}
            className={`py-2 rounded-lg transition cursor-pointer ${
              !isLoginMode ? 'bg-[#fbf9f5] dark:bg-[#201c19] text-sand-900 dark:text-sand-100 shadow-2xs' : 'text-sand-500 dark:text-sand-400 hover:text-sand-900 dark:hover:text-sand-100'
            }`}
          >
            Create New Event
          </button>
        </div>

        {error && (
          <div className="flex items-center space-x-2 p-3.5 rounded-2xl bg-coral-50 dark:bg-coral-950/40 border border-coral-200 dark:border-coral-800 text-coral-800 dark:text-coral-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <SetupForm
          isLoginMode={isLoginMode}
          events={events}
          selectedEventId={selectedEventId}
          setSelectedEventId={setSelectedEventId}
          name={name}
          setName={setName}
          date={date}
          setDate={setDate}
          password={password}
          setPassword={setPassword}
          loading={loading}
          onSubmit={handleSubmit}
        />

        {hasEvent && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError(null);
              }}
              className="text-xs text-sand-500 hover:text-sand-800 dark:hover:text-sand-200 transition underline cursor-pointer"
            >
              {isLoginMode ? 'Need to run setup again?' : 'Already have an event? Log in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
