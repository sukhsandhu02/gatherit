import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

export function LandingHero() {
  return (
    <div className="text-center max-w-xl mx-auto space-y-6 px-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white shadow-xs mx-auto">
        <Sparkles className="w-7 h-7" />
      </div>

      <div className="space-y-2">
        <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">
          Gather
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          Private wedding & event lens where guests capture raw candid moments and the host curates who sees what.
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href="/host/setup"
          className="w-full sm:w-auto flex items-center justify-center space-x-2 py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
        >
          <span>Host Portal</span>
          <ArrowRight className="w-4 h-4" />
        </a>
        <a
          href="/dash"
          className="w-full sm:w-auto flex items-center justify-center space-x-2 py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition border border-slate-200 cursor-pointer shadow-2xs"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>System Console</span>
        </a>
      </div>

      <p className="text-[11px] text-slate-400 pt-4">
        Guests join by scanning the couple's private event QR code.
      </p>
    </div>
  );
}
