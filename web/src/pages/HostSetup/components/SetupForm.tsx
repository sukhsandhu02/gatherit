import React from 'react';
import { Calendar, Lock, ArrowRight, ChevronDown } from 'lucide-react';

interface SetupFormProps {
  isLoginMode: boolean;
  events?: Array<{
    id: string;
    name: string;
    slug: string;
    date?: string | null;
  }>;
  selectedEventId?: string;
  setSelectedEventId?: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function SetupForm({
  isLoginMode,
  events = [],
  selectedEventId,
  setSelectedEventId,
  name,
  setName,
  date,
  setDate,
  password,
  setPassword,
  loading,
  onSubmit,
}: SetupFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isLoginMode && events.length > 0 && (
        <div>
          <label className="block text-xs uppercase tracking-wider text-sand-500 dark:text-sand-400 font-semibold mb-1.5 flex items-center justify-between">
            <span>Select Event to Open</span>
            {events.length > 1 && (
              <span className="text-[10px] text-sand-400 dark:text-sand-500 font-normal">{events.length} available</span>
            )}
          </label>
          <div className="relative">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId?.(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sand-900 dark:text-sand-100 focus:outline-none focus:border-terracotta-500 focus:bg-[#fbf9f5] dark:focus:bg-[#161412] text-sm transition appearance-none cursor-pointer pr-10"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-[#fbf9f5] dark:bg-[#1a1715] text-sand-900 dark:text-sand-100">
                  {ev.name} ({ev.slug}){ev.date ? ` • ${ev.date}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-sand-400 absolute right-3.5 top-3.5 pointer-events-none" />
          </div>
        </div>
      )}
      {!isLoginMode && (
        <>
          <div>
            <label className="block text-xs uppercase tracking-wider text-sand-500 dark:text-sand-400 font-semibold mb-1.5">
              Couple or Event Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sarah & Michael"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sand-900 dark:text-sand-100 placeholder-sand-400 dark:placeholder-sand-500 focus:outline-none focus:border-terracotta-500 focus:bg-[#fbf9f5] dark:focus:bg-[#161412] text-sm transition"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-sand-500 dark:text-sand-400 font-semibold mb-1.5 flex items-center justify-between">
              <span>Event Date</span>
              <span className="text-[10px] text-sand-400 dark:text-sand-500">Optional</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sand-900 dark:text-sand-100 focus:outline-none focus:border-terracotta-500 focus:bg-[#fbf9f5] dark:focus:bg-[#161412] text-sm transition"
              />
              <Calendar className="w-4 h-4 text-sand-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-xs uppercase tracking-wider text-sand-500 dark:text-sand-400 font-semibold mb-1.5">
          Host Master Password *
        </label>
        <div className="relative">
          <input
            type="password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sand-900 dark:text-sand-100 placeholder-sand-400 dark:placeholder-sand-500 focus:outline-none focus:border-terracotta-500 focus:bg-[#fbf9f5] dark:focus:bg-[#161412] text-sm transition"
          />
          <Lock className="w-4 h-4 text-sand-400 absolute right-3.5 top-3.5 pointer-events-none" />
        </div>
        {!isLoginMode && (
          <p className="text-[11px] text-sand-500 dark:text-sand-400 mt-1.5">
            Keep this safe. Used to manage event QR passes, gallery sharing, and downloads.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-terracotta-600 hover:bg-terracotta-500 text-white font-semibold text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
      >
        <span>{loading ? 'Authenticating...' : isLoginMode ? 'Unlock Host Portal' : 'Create Event'}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
