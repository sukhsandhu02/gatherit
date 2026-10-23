import { ShieldCheck, Wifi, KeyRound, QrCode } from 'lucide-react';

interface SystemCardsProps {
  health: { status: string; db: string } | null;
  wsStatus: 'connecting' | 'connected' | 'disconnected';
  echoMessage: string;
}

export function SystemCards({ health, wsStatus, echoMessage }: SystemCardsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#e7e1d7] dark:bg-[#201c19] flex items-center justify-center text-terracotta-700 dark:text-terracotta-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-sand-900 dark:text-sand-100 block">PostgreSQL Database</span>
              <span className="text-xs text-sand-500 dark:text-sand-400">Container pg-db (keepsake)</span>
            </div>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-mono font-medium ${
              health?.db === 'connected'
                ? 'bg-sage-50 dark:bg-sage-950/40 text-sage-700 dark:text-sage-400 border border-sage-200 dark:border-sage-800'
                : 'bg-coral-50 dark:bg-coral-950/40 text-coral-700 dark:text-coral-400 border border-coral-200 dark:border-coral-800'
            }`}
          >
            {health ? health.db : 'Checking...'}
          </span>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#e7e1d7] dark:bg-[#201c19] flex items-center justify-center text-terracotta-700 dark:text-terracotta-400">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-sand-900 dark:text-sand-100 block">WebSocket Bridge</span>
              <span className="text-xs text-sand-500 dark:text-sand-400">Real-time socket echo</span>
            </div>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-mono font-medium ${
              wsStatus === 'connected'
                ? 'bg-sage-50 dark:bg-sage-950/40 text-sage-700 dark:text-sage-400 border border-sage-200 dark:border-sage-800'
                : 'bg-[#e7e1d7] dark:bg-[#201c19] text-sand-600 dark:text-sand-400 border border-[#e2dcce] dark:border-[#332b25]'
            }`}
          >
            {wsStatus}
          </span>
        </div>
      </div>

      {echoMessage && (
        <p className="text-xs text-center text-sage-800 dark:text-sage-300 font-mono bg-sage-50 dark:bg-sage-950/30 border border-sage-200 dark:border-sage-800/60 rounded-xl py-2.5">
          ✓ {echoMessage}
        </p>
      )}

      <div className="pt-2 grid grid-cols-2 gap-3">
        <a
          href="/host/setup"
          className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#f5f2ec] dark:bg-[#201c19] hover:bg-[#eae4d8] dark:hover:bg-[#28231f] border border-[#e2dcce] dark:border-[#332b25] text-xs font-semibold text-sand-800 dark:text-sand-200 transition cursor-pointer"
        >
          <KeyRound className="w-4 h-4" />
          <span>Host Portal</span>
        </a>
        <a
          href="/host/event"
          className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-terracotta-600 hover:bg-terracotta-500 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
        >
          <QrCode className="w-4 h-4" />
          <span>Event & QR</span>
        </a>
      </div>
    </div>
  );
}
