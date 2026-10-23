import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Wifi, Server, HardDrive, AlertCircle, CheckCircle, RefreshCw, Database } from 'lucide-react';

export default function StatusPage() {
  const [health, setHealth] = useState<any>(null);
  const [hostStatus, setHostStatus] = useState<any>(null);
  const [now, setNow] = useState<string>('');

  const refresh = async () => {
    try {
      const [h, hs] = await Promise.all([
        api('/api/health'),
        api('/api/host/status'),
      ]);
      setHealth(h);
      setHostStatus(hs);
    } catch (err: any) {
      setHealth({ status: 'error', db: 'unreachable', error: err.message });
      setHostStatus(null);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const update = () => setNow(new Date().toISOString());
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  const hostOk = hostStatus?.hasEvent;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6 selection:bg-brand-600 selection:text-white transition-colors duration-200">
      <div className="max-w-xl w-full space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold tracking-tight">System status</h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{now}</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card
            icon={<Database className="w-5 h-5" />}
            label="Database"
            ok={health?.db === 'connected'}
            detail={health?.db || 'unknown'}
          />
          <Card
            icon={<Server className="w-5 h-5" />}
            label="API server"
            ok={health?.status === 'ok'}
            detail={health?.status || 'unknown'}
          />
          <Card
            icon={<Wifi className="w-5 h-5" />}
            label="Host session"
            ok={hostOk}
            detail={hostOk ? 'active event exists' : 'no active event'}
          />
          <Card
            icon={<HardDrive className="w-5 h-5" />}
            label="Media storage"
            ok={true}
            detail="writable"
          />
        </div>

        <div className="bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Live check</span>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Health endpoint</span>
              <span className={health?.status === 'ok' ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                {health?.status === 'ok' ? 'ok' : health?.status || 'error'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Database</span>
              <span className={health?.db === 'connected' ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                {health?.db}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Host status</span>
              <span className={hostOk ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                {hostStatus?.hasEvent ? 'event exists' : 'no event'}
              </span>
            </div>
          </div>

          {health?.error && (
            <div className="mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {String(health.error) || 'Request failed'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
          <a
            href="/dash"
            className="inline-flex items-center gap-1.5 font-semibold hover:text-slate-900 dark:hover:text-white transition"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Console
          </a>
          <span className="font-mono">/status</span>
        </div>
      </div>
    </div>
  );
}

function Card({ icon, label, ok, detail }: { icon: React.ReactNode; label: string; ok: boolean; detail: string }) {
  return (
    <div className="bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${ok ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'}`}>
            {icon}
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span>
        </div>
        {ok ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}
