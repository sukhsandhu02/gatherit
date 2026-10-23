import { Check, Ban, KeyRound, Share2, Trash2 } from 'lucide-react';
import type { Guest } from '../types';

interface GuestTableProps {
  guests: Guest[];
  onApprove: (id: string) => void;
  onBlock: (id: string) => void;
  onActivate: (id: string) => void;
  onToggleDownload: (id: string, current: boolean) => void;
  onResetPassword: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectGuest: (guest: Guest) => void;
  loginUrl: string;
}

export function GuestTable({
  guests,
  onApprove,
  onBlock,
  onActivate,
  onToggleDownload,
  onResetPassword,
  onDelete,
  onSelectGuest,
  loginUrl,
}: GuestTableProps) {
  const formatDisplayPhone = (p: string) => {
    if (p.length === 12 && p.startsWith('91')) {
      return `+91 ${p.slice(2, 7)} ${p.slice(7)}`;
    }
    return `+${p}`;
  };

  return (
    <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-[#2b2621] dark:text-[#f5f2ec]">
          <thead className="bg-[#faf7f2] dark:bg-[#161412] text-[#8c7e6c] dark:text-[#a69c8e] text-xs uppercase tracking-wider border-b border-[#e7dfd3] dark:border-[#332b25] font-semibold">
            <tr>
              <th className="py-3.5 px-5">Guest</th>
              <th className="py-3.5 px-4">Phone</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Shots</th>
              <th className="py-3.5 px-4">Shared with them</th>
              <th className="py-3.5 px-4">Downloads</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ebe1] dark:divide-[#2d2520]">
            {guests.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#8c7e6c] dark:text-[#78716c]">
                  No guests found matching this view.
                </td>
              </tr>
            ) : (
              guests.map((g) => (
                <tr key={g.id} className="hover:bg-[#faf6ef] dark:hover:bg-[#27211c] transition">
                  <td className="py-4 px-5 font-medium flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-[#f0ebe1] dark:bg-[#2b2520] border border-[#e2d9cc] dark:border-[#38312a] flex items-center justify-center text-[#5c5246] dark:text-[#c7bfb4] text-xs font-bold">
                      {g.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <button
                        onClick={() => onSelectGuest(g)}
                        className="text-[#2b2621] dark:text-[#f5f2ec] font-semibold hover:text-[#a05e44] dark:hover:text-[#deb09d] text-left cursor-pointer transition"
                      >
                        {g.name}
                      </button>
                      <span className="block text-[11px] text-[#8c7e6c] dark:text-[#78716c] font-mono">
                        {g.id.slice(0, 8)}...
                      </span>
                    </div>
                  </td>

                  <td className="py-4 px-4 text-xs font-mono text-[#6e6459] dark:text-[#a69c8e]">
                    {formatDisplayPhone(g.phone)}
                  </td>

                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        g.status === 'active'
                          ? 'bg-[#edf5f0] dark:bg-[#19271e] text-[#4d7c5f] dark:text-[#699777] border border-[#c6dfcd] dark:border-[#263e2e]'
                          : g.status === 'pending'
                          ? 'bg-[#fdf6ec] dark:bg-[#2b2014] text-[#b3732c] dark:text-[#d48d3b] border border-[#f5dfb8] dark:border-[#4d361c]'
                          : 'bg-[#faeeec] dark:bg-[#2a1716] text-[#a84b45] dark:text-[#d46d65] border border-[#f0c7c3] dark:border-[#4d2220]'
                      }`}
                    >
                      <span className="capitalize">{g.status}</span>
                    </span>
                  </td>

                  <td className="py-4 px-4 text-xs font-semibold text-[#5c5246] dark:text-[#c7bfb4]">
                    {g.shotsCount}
                  </td>

                  <td className="py-4 px-4 text-xs font-semibold text-[#5c5246] dark:text-[#c7bfb4]">
                    {g.sharedWithThemCount}
                  </td>

                  <td className="py-4 px-4">
                    <button
                      onClick={() => onToggleDownload(g.id, g.canDownload)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition border ${
                        g.canDownload
                          ? 'bg-[#edf5f0] dark:bg-[#19271e] text-[#4d7c5f] dark:text-[#699777] border border-[#c6dfcd] dark:border-[#263e2e]'
                          : 'bg-[#f0ebe1] dark:bg-[#25201c] text-[#8c7e6c] dark:text-[#a69c8e] border border-[#e2d9cc] dark:border-[#38312a]'
                      }`}
                    >
                      {g.canDownload ? 'Allowed' : 'Disabled'}
                    </button>
                  </td>

                  <td className="py-4 px-5 text-right">
                    <div className="inline-flex items-center justify-end space-x-1.5">
                      {g.status === 'pending' && (
                        <button
                          title="Approve guest"
                          onClick={() => onApprove(g.id)}
                          className="w-8 h-8 rounded-lg bg-[#edf5f0] hover:bg-[#dfeee3] dark:bg-[#19271e] dark:hover:bg-[#223629] text-[#4d7c5f] dark:text-[#699777] border border-[#c6dfcd] dark:border-[#263e2e] transition cursor-pointer inline-flex items-center justify-center"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}

                      {g.status === 'active' && (
                        <button
                          title="Block guest"
                          onClick={() => onBlock(g.id)}
                          className="w-8 h-8 rounded-lg bg-[#fdf6ec] hover:bg-[#fbedd6] dark:bg-[#2b2014] dark:hover:bg-[#3d2c1b] text-[#b3732c] dark:text-[#d48d3b] border border-[#f5dfb8] dark:border-[#4d361c] transition cursor-pointer inline-flex items-center justify-center"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}

                      {g.status === 'blocked' && (
                        <button
                          title="Unblock guest"
                          onClick={() => onActivate(g.id)}
                          className="w-8 h-8 rounded-lg bg-[#edf5f0] hover:bg-[#dfeee3] dark:bg-[#19271e] dark:hover:bg-[#223629] text-[#4d7c5f] dark:text-[#699777] border border-[#c6dfcd] dark:border-[#263e2e] transition cursor-pointer inline-flex items-center justify-center"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}

                      <a
                        href={`https://wa.me/${g.phone}?text=${encodeURIComponent(
                          `Hi ${g.name}, here is your link to view photos from the event: ${loginUrl}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Notify on WhatsApp"
                        className="w-8 h-8 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 transition cursor-pointer inline-flex items-center justify-center"
                      >
                        <Share2 className="w-4 h-4" />
                      </a>

                      <button
                        title="Reset Password (generate temp code)"
                        onClick={() => onResetPassword(g.id)}
                        className="w-8 h-8 rounded-lg bg-[#f0ebe1] hover:bg-[#e7dfd3] dark:bg-[#25201c] dark:hover:bg-[#2e2722] text-[#5c5246] dark:text-[#c7bfb4] border border-[#e2d9cc] dark:border-[#38312a] transition cursor-pointer inline-flex items-center justify-center"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      <button
                        title="Delete guest"
                        onClick={() => onDelete(g.id)}
                        className="w-8 h-8 rounded-lg bg-[#faeeec] hover:bg-[#f6dfdc] dark:bg-[#2a1716] dark:hover:bg-[#3d1f1e] text-[#a84b45] dark:text-[#d46d65] border border-[#f0c7c3] dark:border-[#4d2220] transition cursor-pointer inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
