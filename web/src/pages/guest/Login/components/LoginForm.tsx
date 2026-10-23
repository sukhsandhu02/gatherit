import { useState } from 'react';
import { Phone, Eye, EyeOff, ArrowRight } from 'lucide-react';

interface LoginFormProps {
  phone: string;
  setPhone: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  slug: string;
}

export function LoginForm({
  phone,
  setPhone,
  password,
  setPassword,
  loading,
  onSubmit,
  slug,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Phone Field */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
          Phone Number *
        </label>
        <div className="relative flex items-center">
          <div className="absolute left-3.5 flex items-center space-x-1 px-2 py-1 bg-slate-200/80 rounded-lg text-xs font-bold text-slate-700">
            <span>+91</span>
          </div>
          <input
            type="tel"
            required
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full pl-18 pr-11 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white text-sm transition"
          />
          <Phone className="w-4 h-4 text-slate-400 absolute right-4 top-4 pointer-events-none" />
        </div>
      </div>

      {/* Password Field */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
          Password *
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-4 pr-11 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white text-sm transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-3.5 p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
          Forgot your password? Ask the host to reset it.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition shadow-sm disabled:opacity-50 cursor-pointer mt-2"
      >
        <span>{loading ? 'Logging in...' : 'Log in'}</span>
        <ArrowRight className="w-4 h-4" />
      </button>

      <div className="text-center pt-2">
        <a
          href={`/e/${slug}/join`}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          New here? Join the event
        </a>
      </div>
    </form>
  );
}
