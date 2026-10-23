import { X, Search, Globe, Lock, Check } from 'lucide-react';
import { useState } from 'react';

interface SharePanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  guests: any[];
  onShare: (guestIds: string[], everyone: boolean) => void;
  onMakePrivate: () => void;
  sharing: boolean;
}

export function SharePanel({
  isOpen,
  onClose,
  selectedCount,
  guests,
  onShare,
  onMakePrivate,
  sharing,
}: SharePanelProps) {
  const [search, setSearch] = useState('');
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [everyone, setEveryone] = useState(false);

  if (!isOpen) return null;

  const filteredGuests = guests.filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return g.name.toLowerCase().includes(q) || g.phone.includes(q);
  });

  const toggleGuest = (id: string) => {
    setEveryone(false);
    setSelectedGuestIds((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  const handleShareSubmit = () => {
    onShare(selectedGuestIds, everyone);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white dark:bg-[#201c19] border-l border-[#e7dfd3] dark:border-[#332b25] h-full p-6 flex flex-col justify-between shadow-2xl">
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-[#e7dfd3] dark:border-[#332b25] pb-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#2b2621] dark:text-[#f5f2ec]">
                Share {selectedCount} items
              </h3>
              <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e]">Choose who can view these photos</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg text-[#8c7e6c] hover:text-[#2b2621] dark:hover:text-[#f5f2ec] cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Everyone Toggle */}
          <div
            onClick={() => {
              setEveryone(!everyone);
              if (!everyone) setSelectedGuestIds([]);
            }}
            className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
              everyone
                ? 'bg-[#a05e44] text-white border-[#a05e44]'
                : 'bg-[#faf7f2] dark:bg-[#161412] text-[#2b2621] dark:text-[#f5f2ec] border-[#e7dfd3] dark:border-[#38312a] hover:border-[#deb09d]'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5" />
              <div>
                <span className="text-xs font-bold block">Share with Everyone</span>
                <span className={`text-[11px] block ${everyone ? 'text-[#f5e6e0]' : 'text-[#8c7e6c] dark:text-[#a69c8e]'}`}>
                  All approved guests can see these in their gallery
                </span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                everyone ? 'bg-white text-[#a05e44] border-white' : 'border-[#d5cbbd] dark:border-[#4f4538]'
              }`}
            >
              {everyone && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>

          {/* Search guests */}
          <div>
            <label className="block text-xs uppercase font-semibold text-[#8c7e6c] dark:text-[#a69c8e] tracking-wider mb-1.5">
              Or pick specific guests
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3] dark:border-[#38312a] text-xs text-[#2b2621] dark:text-[#f5f2ec] placeholder-[#8c7e6c] focus:outline-none focus:border-[#a05e44] dark:focus:border-[#b46b4e]"
              />
              <Search className="w-3.5 h-3.5 text-[#8c7e6c] absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Guest list */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {filteredGuests.map((g) => {
              const isSelected = selectedGuestIds.includes(g.id);
              return (
                <div
                  key={g.id}
                  onClick={() => toggleGuest(g.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#faf3f0] dark:bg-[#2d1d17] border-[#deb09d] dark:border-[#583325] text-[#2b2621] dark:text-[#f5f2ec] font-semibold'
                      : 'bg-white dark:bg-[#161412] border-[#f0ebe1] dark:border-[#2d2520] hover:bg-[#faf6ef] dark:hover:bg-[#25201c] text-[#5c5246] dark:text-[#c7bfb4]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#f0ebe1] dark:bg-[#2b2520] flex items-center justify-center text-[11px] font-bold text-[#5c5246] dark:text-[#c7bfb4] shrink-0">
                      {g.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-xs block truncate">{g.name}</span>
                      <span className="text-[10px] text-[#8c7e6c] dark:text-[#78716c] font-mono block">
                        ...{g.phone.slice(-4)}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                      isSelected ? 'bg-[#a05e44] text-white border-[#a05e44]' : 'border-[#d5cbbd] dark:border-[#4f4538]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#f0ebe1] dark:border-[#2d2520]">
            <button
              onClick={onMakePrivate}
              className="w-full py-2.5 rounded-xl bg-[#faf7f2] dark:bg-[#161412] hover:bg-[#f0ebe1] dark:hover:bg-[#25201c] text-[#5c5246] dark:text-[#c7bfb4] font-semibold text-xs transition border border-[#e7dfd3] dark:border-[#38312a] flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#8c7e6c]" />
              <span>Make Private (Host Only)</span>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-[#e7dfd3] dark:border-[#332b25] flex items-center space-x-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-[#f0ebe1] dark:bg-[#25201c] text-[#5c5246] dark:text-[#c7bfb4] font-semibold text-xs hover:bg-[#e7dfd3] dark:hover:bg-[#2e2722] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleShareSubmit}
            disabled={sharing || (!everyone && selectedGuestIds.length === 0)}
            className="flex-1 py-3 rounded-xl bg-[#a05e44] text-white font-semibold text-xs hover:bg-[#8e5038] transition disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {sharing ? 'Saving...' : 'Apply Sharing'}
          </button>
        </div>
      </div>
    </div>
  );
}
