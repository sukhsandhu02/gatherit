import { X, Camera, Eye, Layers } from 'lucide-react';
import type { Group } from '../types';

interface CreatePassDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  role: 'camera' | 'viewer' | 'both';
  setRole: (r: 'camera' | 'viewer' | 'both') => void;
  canDownload: boolean;
  setCanDownload: (v: boolean) => void;
  groups: Group[];
  selectedGroupIds: string[];
  onToggleGroup: (id: string) => void;
  newGroupName: string;
  setNewGroupName: (v: string) => void;
  onCreateGroup: (e: React.FormEvent) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreatePassDrawer({
  isOpen,
  onClose,
  name,
  setName,
  role,
  setRole,
  canDownload,
  setCanDownload,
  groups,
  selectedGroupIds,
  onToggleGroup,
  newGroupName,
  setNewGroupName,
  onCreateGroup,
  onSubmit,
}: CreatePassDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#fbf9f5] dark:bg-[#1a1715] border-l border-[#e2dcce] dark:border-[#332b25] h-full p-6 flex flex-col justify-between overflow-y-auto shadow-2xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#e2dcce] dark:border-[#332b25] pb-4">
            <h2 className="text-xl font-serif font-bold text-sand-900 dark:text-sand-100">Issue Pass / QR Code</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#f5f2ec] dark:hover:bg-[#201c19] text-sand-500 hover:text-sand-900 dark:hover:text-sand-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form id="pass-form" onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-sand-500 dark:text-sand-400 font-semibold mb-1.5">
                Pass / QR Label *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Table 4 QR, Guests, Photographers"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sand-900 dark:text-sand-100 placeholder-sand-400 dark:placeholder-sand-500 focus:outline-none focus:border-terracotta-500 focus:bg-white dark:focus:bg-[#161412] text-sm transition"
              />
              <p className="text-[11px] text-sand-500 dark:text-sand-400 mt-1.5">
                Anyone who scans this QR code on their phone will instantly join with this role.
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-sand-500 dark:text-sand-400 font-semibold mb-1.5">
                Pass Role *
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['camera', 'viewer', 'both'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-3 px-2 rounded-xl border text-xs font-semibold capitalize flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                      role === r
                        ? 'bg-terracotta-600 border-terracotta-600 text-white'
                        : 'bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-sand-700 dark:text-sand-300 hover:border-[#cfc6b5] dark:hover:border-[#44382f]'
                    }`}
                  >
                    {r === 'camera' && <Camera className="w-4 h-4" />}
                    {r === 'viewer' && <Eye className="w-4 h-4" />}
                    {r === 'both' && <Layers className="w-4 h-4" />}
                    <span>{r}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822]">
              <div>
                <span className="text-sm font-semibold text-sand-900 dark:text-sand-100 block">Allow Media Downloads</span>
                <span className="text-xs text-sand-500 dark:text-sand-400">Can save photos/videos to phone</span>
              </div>
              <input
                type="checkbox"
                checked={canDownload}
                onChange={(e) => setCanDownload(e.target.checked)}
                className="w-5 h-5 accent-terracotta-600 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs uppercase tracking-wider text-sand-500 dark:text-sand-400 font-semibold">
                  Assign Groups (Optional)
                </label>
              </div>

              {groups.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {groups.map((group) => {
                    const isSelected = selectedGroupIds.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => onToggleGroup(group.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                          isSelected
                            ? 'bg-terracotta-600 text-white border-terracotta-600'
                            : 'bg-[#f5f2ec] dark:bg-[#141210] text-sand-700 dark:text-sand-300 border-[#e2dcce] dark:border-[#2f2822] hover:border-[#cfc6b5] dark:hover:border-[#44382f]'
                        }`}
                      >
                        {group.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="New group (e.g. VIP, Bridal Party)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#f5f2ec] dark:bg-[#141210] border border-[#e2dcce] dark:border-[#2f2822] text-xs text-sand-900 dark:text-sand-100 placeholder-sand-400 dark:placeholder-sand-500 focus:outline-none focus:border-terracotta-500 focus:bg-white dark:focus:bg-[#161412] transition"
                />
                <button
                  type="button"
                  onClick={onCreateGroup}
                  className="px-3.5 py-2 rounded-xl bg-[#f5f2ec] dark:bg-[#201c19] text-xs font-semibold text-sand-700 dark:text-sand-300 hover:bg-[#eae4d8] dark:hover:bg-[#28231f] border border-[#e2dcce] dark:border-[#332b25] transition cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="pt-6 border-t border-[#e2dcce] dark:border-[#332b25] flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-[#f5f2ec] dark:bg-[#201c19] border border-[#e2dcce] dark:border-[#332b25] text-xs font-semibold text-sand-700 dark:text-sand-300 hover:bg-[#eae4d8] dark:hover:bg-[#28231f] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pass-form"
            className="flex-1 py-3 px-4 rounded-xl bg-terracotta-600 text-white font-semibold text-xs hover:bg-terracotta-500 transition shadow-xs cursor-pointer"
          >
            Create & View QR
          </button>
        </div>
      </div>
    </div>
  );
}
