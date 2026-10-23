import { Camera, RefreshCw, Zap } from 'lucide-react';

const SHOT =
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80';

export function PhoneMockup() {
  return (
    <div className="relative w-[250px] sm:w-[280px] aspect-[9/18.5] rounded-[2.8rem] bg-slate-950 p-2.5 shadow-[0_40px_80px_-20px_rgba(15,23,42,0.45)] ring-1 ring-slate-800">
      <div className="relative w-full h-full rounded-[2.2rem] overflow-hidden bg-slate-900">
        <img src={SHOT} alt="Guest camera viewfinder at a wedding reception" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

        {/* notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 rounded-full bg-black" />

        {/* top bar */}
        <div className="absolute top-10 inset-x-4 flex items-center justify-between text-white text-[10px] font-semibold">
          <span className="px-2 py-1 rounded-full bg-black/45 backdrop-blur-sm">Priya &amp; Arjun</span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/45 backdrop-blur-sm">
            <Zap className="w-3 h-3 text-brand-300" /> Auto
          </span>
        </div>

        {/* focus square */}
        <div className="absolute top-[38%] left-[30%] w-16 h-16 border border-brand-300 rounded-lg" />

        {/* shutter row */}
        <div className="absolute bottom-6 inset-x-6 flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white/80">
            <img src={SHOT} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
            <RefreshCw className="w-4 h-4" />
          </div>
        </div>

        <Camera className="absolute top-[16%] right-4 w-4 h-4 text-white/70" aria-hidden />
      </div>
    </div>
  );
}
