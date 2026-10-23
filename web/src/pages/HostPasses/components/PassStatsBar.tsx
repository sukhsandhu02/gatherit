import type { Pass } from '../types';

interface PassStatsBarProps {
  passes: Pass[];
}

export function PassStatsBar({ passes }: PassStatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-2xl p-4 shadow-xs">
        <span className="text-xs text-sand-500 dark:text-sand-400 uppercase tracking-wider block font-semibold">Total Passes</span>
        <span className="text-2xl font-serif text-sand-900 dark:text-sand-100 font-bold">{passes.length}</span>
      </div>
      <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-2xl p-4 shadow-xs">
        <span className="text-xs text-sand-500 dark:text-sand-400 uppercase tracking-wider block font-semibold">Active Devices</span>
        <span className="text-2xl font-serif text-sand-900 dark:text-sand-100 font-bold">
          {passes.filter((p) => p.deviceId && !p.revoked).length}
        </span>
      </div>
      <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-2xl p-4 shadow-xs">
        <span className="text-xs text-sand-500 dark:text-sand-400 uppercase tracking-wider block font-semibold">Cameras</span>
        <span className="text-2xl font-serif text-sage-700 dark:text-sage-400 font-bold">
          {passes.filter((p) => (p.role === 'camera' || p.role === 'both') && !p.revoked).length}
        </span>
      </div>
      <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-2xl p-4 shadow-xs">
        <span className="text-xs text-sand-500 dark:text-sand-400 uppercase tracking-wider block font-semibold">Revoked</span>
        <span className="text-2xl font-serif text-coral-700 dark:text-coral-400 font-bold">
          {passes.filter((p) => p.revoked).length}
        </span>
      </div>
    </div>
  );
}
