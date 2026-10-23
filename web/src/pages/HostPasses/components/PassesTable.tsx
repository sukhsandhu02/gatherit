import { Camera, Eye, Layers, Smartphone, ShieldAlert, Ban, Trash2 } from 'lucide-react';
import type { Pass } from '../types';

interface PassesTableProps {
  passes: Pass[];
  onToggleDownload: (id: string, current: boolean) => void;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PassesTable({ passes, onToggleDownload, onRevoke, onDelete }: PassesTableProps) {
  return (
    <div className="bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl overflow-hidden shadow-xs">
      <div className="p-5 border-b border-[#e2dcce] dark:border-[#332b25] flex items-center justify-between">
        <h2 className="font-serif text-base text-sand-900 dark:text-sand-100 font-semibold">Active Passes & Access Tokens</h2>
        <span className="text-xs text-sand-500 dark:text-sand-400 font-medium">{passes.length} registered</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-sand-900 dark:text-sand-100">
          <thead className="bg-[#f5f2ec] dark:bg-[#141210] text-sand-500 dark:text-sand-400 text-xs uppercase tracking-wider border-b border-[#e2dcce] dark:border-[#332b25] font-semibold">
            <tr>
              <th className="py-3.5 px-5">Pass / QR Name</th>
              <th className="py-3.5 px-4">Role</th>
              <th className="py-3.5 px-4">Device Bound</th>
              <th className="py-3.5 px-4">Groups</th>
              <th className="py-3.5 px-4">Downloads</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2dcce]/70 dark:divide-[#332b25]/70">
            {passes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sand-400 dark:text-sand-500">
                  No passes or QR codes created yet. Click "Issue Pass / QR" above to create one.
                </td>
              </tr>
            ) : (
              passes.map((pass) => (
                <tr key={pass.id} className="hover:bg-[#f5f2ec]/60 dark:hover:bg-[#201c19]/60 transition">
                  <td className="py-4 px-5 font-medium flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#e7e1d7] dark:bg-[#25201c] border border-[#d5cdbf] dark:border-[#382f28] flex items-center justify-center text-sand-700 dark:text-sand-200 text-xs font-bold">
                      {pass.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sand-900 dark:text-sand-100 font-semibold">{pass.name}</span>
                      <span className="block text-[11px] text-sand-400 dark:text-sand-500 font-mono">
                        {pass.id.slice(0, 8)}...
                      </span>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        pass.role === 'camera'
                          ? 'bg-[#f0eae0] dark:bg-[#201c19] text-sand-800 dark:text-sand-200 border border-[#e2dcce] dark:border-[#332b25]'
                          : pass.role === 'viewer'
                          ? 'bg-ochre-50 dark:bg-ochre-950/60 text-ochre-800 dark:text-ochre-300 border border-ochre-200 dark:border-ochre-800/60'
                          : 'bg-sage-50 dark:bg-sage-950/60 text-sage-800 dark:text-sage-300 border border-sage-200 dark:border-sage-800/60'
                      }`}
                    >
                      {pass.role === 'camera' && <Camera className="w-3 h-3 text-sand-700 dark:text-sand-300" />}
                      {pass.role === 'viewer' && <Eye className="w-3 h-3 text-ochre-700 dark:text-ochre-400" />}
                      {pass.role === 'both' && <Layers className="w-3 h-3 text-sage-700 dark:text-sage-400" />}
                      <span className="capitalize">{pass.role}</span>
                    </span>
                  </td>

                  <td className="py-4 px-4 text-xs">
                    {pass.deviceId ? (
                      <span className="inline-flex items-center space-x-1 text-sage-700 dark:text-sage-400 font-semibold">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Bound</span>
                      </span>
                    ) : (
                      <span className="text-sand-400 dark:text-sand-500 italic">Not yet bound</span>
                    )}
                  </td>

                  <td className="py-4 px-4 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {pass.groups && pass.groups.length > 0 ? (
                        pass.groups.map((g) => (
                          <span
                            key={g.id}
                            className="px-2 py-0.5 rounded-md bg-[#f0eae0] dark:bg-[#201c19] text-sand-700 dark:text-sand-300 border border-[#e2dcce] dark:border-[#332b25] text-[11px] font-medium"
                          >
                            {g.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-sand-300 dark:text-sand-600">—</span>
                      )}
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <button
                      onClick={() => onToggleDownload(pass.id, pass.canDownload)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition border ${
                        pass.canDownload
                          ? 'bg-sage-50 dark:bg-sage-950/60 text-sage-700 dark:text-sage-300 border-sage-200 dark:border-sage-800/60'
                          : 'bg-[#f0eae0] dark:bg-[#201c19] text-sand-500 dark:text-sand-400 border-[#e2dcce] dark:border-[#332b25]'
                      }`}
                    >
                      {pass.canDownload ? 'Allowed' : 'Disabled'}
                    </button>
                  </td>

                  <td className="py-4 px-4">
                    {pass.revoked ? (
                      <span className="inline-flex items-center space-x-1 text-coral-700 dark:text-coral-400 text-xs font-bold">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Revoked</span>
                      </span>
                    ) : (
                      <span className="text-sage-700 dark:text-sage-400 text-xs font-semibold">Active</span>
                    )}
                  </td>

                  <td className="py-4 px-5 text-right space-x-2">
                    {!pass.revoked && (
                      <button
                        title="Revoke pass (blocks access)"
                        onClick={() => onRevoke(pass.id)}
                        className="p-1.5 rounded-lg bg-ochre-50 dark:bg-ochre-950/40 hover:bg-ochre-100 dark:hover:bg-ochre-900/50 text-ochre-700 dark:text-ochre-300 border border-ochre-200 dark:border-ochre-800/50 transition cursor-pointer"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      title="Delete pass permanently"
                      onClick={() => onDelete(pass.id)}
                      className="p-1.5 rounded-lg bg-coral-50 dark:bg-coral-950/40 hover:bg-coral-100 dark:hover:bg-coral-900/50 text-coral-700 dark:text-coral-300 border border-coral-200 dark:border-coral-800/50 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
