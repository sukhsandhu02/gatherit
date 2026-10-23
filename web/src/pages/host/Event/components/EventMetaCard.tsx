import { Calendar } from 'lucide-react';

interface EventMetaCardProps {
  name: string;
  setName: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  slug: string;
  onSave: () => void;
  saving: boolean;
}

export function EventMetaCard({
  name,
  setName,
  date,
  setDate,
  slug,
  onSave,
  saving,
}: EventMetaCardProps) {
  return (
    <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-6 space-y-5 shadow-xs">
      <div>
        <h3 className="text-base font-semibold text-[#2b2621] dark:text-[#f5f2ec]">Event Details</h3>
        <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] mt-0.5">Title and date shown to guests</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#8c7e6c] dark:text-[#a69c8e] font-semibold mb-1.5">
            Event Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3] dark:border-[#38312a] text-[#2b2621] dark:text-[#f5f2ec] text-sm focus:outline-none focus:border-[#a05e44] dark:focus:border-[#b46b4e] focus:bg-white dark:focus:bg-[#201c19] transition"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-[#8c7e6c] dark:text-[#a69c8e] font-semibold mb-1.5">
            Event Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3] dark:border-[#38312a] text-[#2b2621] dark:text-[#f5f2ec] text-sm focus:outline-none focus:border-[#a05e44] dark:focus:border-[#b46b4e] focus:bg-white dark:focus:bg-[#201c19] transition"
            />
            <Calendar className="w-4 h-4 text-[#8c7e6c] absolute right-3.5 top-3 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-[#8c7e6c] dark:text-[#a69c8e] font-semibold mb-1.5">
            Event URL Slug
          </label>
          <input
            type="text"
            disabled
            value={slug}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0ebe1] dark:bg-[#1b1714] border border-[#e2d9cc] dark:border-[#332b25] text-[#8c7e6c] dark:text-[#887c70] font-mono text-xs cursor-not-allowed"
          />
          <p className="text-[11px] text-[#8c7e6c] dark:text-[#a69c8e] mt-1">Unique public identifier</p>
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="w-full py-2.5 px-4 rounded-xl bg-[#a05e44] hover:bg-[#8e5038] text-white font-semibold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Details'}
        </button>
      </div>
    </div>
  );
}
