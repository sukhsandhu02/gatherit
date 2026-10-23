import { useState } from 'react';
import { User, Phone, Eye, EyeOff, ArrowRight } from 'lucide-react';

interface JoinFormProps {
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  slug: string;
}

export function JoinForm({
  name,
  setName,
  phone,
  setPhone,
  password,
  setPassword,
  loading,
  onSubmit,
  slug,
}: JoinFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Name Field */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Your Name *
        </label>
        <div className="relative">
          <input
            type="text"
            required
            placeholder="e.g. Alex Morgan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-brand-500 focus:bg-white dark:focus:bg-slate-800 text-sm transition"
          />
          <User className="w-4 h-4 text-slate-400 absolute right-4 top-4 pointer-events-none" />
        </div>
      </div>

      {/* Phone Field with +91 Chip */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Phone Number *
        </label>
        <div className="relative flex items-center">
          <div className="absolute left-3.5 flex items-center space-x-1 px-2 py-1 bg-slate-200/80 dark:bg-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
            <span>+91</span>
          </div>
          <input
            type="tel"
            required
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full pl-18 pr-11 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-brand-500 focus:bg-white dark:focus:bg-slate-800 text-sm transition"
          />
          <Phone className="w-4 h-4 text-slate-400 absolute right-4 top-4 pointer-events-none" />
        </div>
      </div>

      {/* Password Field with Eye Icon */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Create a Password *
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-4 pr-11 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-brand-500 focus:bg-white dark:focus:bg-slate-800 text-sm transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-3.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
          You'll use your phone number and this password to see photos shared with you.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition shadow-sm disabled:opacity-50 cursor-pointer mt-2"
      >
        <span>{loading ? 'Joining...' : 'Join the event'}</span>
        <ArrowRight className="w-4 h-4" />
      </button>

      <div className="text-center pt-2">
        <a
          href={`/e/${slug}/login`}
          className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
        >
          Already joined? Log in
        </a>
      </div>
    </form>
  );
}
