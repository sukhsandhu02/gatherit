interface JoiningControlsCardProps {
  joinOpen: boolean;
  onToggleJoinOpen: () => void;
  requireApproval: boolean;
  onToggleRequireApproval: () => void;
}

export function JoiningControlsCard({
  joinOpen,
  onToggleJoinOpen,
  requireApproval,
  onToggleRequireApproval,
}: JoiningControlsCardProps) {
  return (
    <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-6 space-y-6 shadow-xs">
      <div>
        <h3 className="text-base font-semibold text-[#2b2621] dark:text-[#f5f2ec]">Joining Controls</h3>
        <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] mt-0.5">Control who can register via the QR code</p>
      </div>

      <div className="space-y-4">
        {/* Toggle Joining Open */}
        <div className="p-4 rounded-2xl bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3]/80 dark:border-[#38312a]/80 flex items-start justify-between space-x-3">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-[#2b2621] dark:text-[#f5f2ec]">Joining Open</span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  joinOpen
                    ? 'bg-[#edf5f0] dark:bg-[#19271e] text-[#4d7c5f] dark:text-[#699777]'
                    : 'bg-[#faeeec] dark:bg-[#2a1716] text-[#a84b45] dark:text-[#d46d65]'
                }`}
              >
                {joinOpen ? 'Active' : 'Closed'}
              </span>
            </div>
            <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] leading-relaxed">
              Close joining once the ceremony begins to prevent strangers from registering.
            </p>
          </div>

          <button
            onClick={onToggleJoinOpen}
            type="button"
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition duration-200 shrink-0 ${
              joinOpen ? 'bg-[#53785e]' : 'bg-[#d5cbbd] dark:bg-[#3d342c]'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-200 ${
                joinOpen ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Toggle Require Approval */}
        <div className="p-4 rounded-2xl bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3]/80 dark:border-[#38312a]/80 flex items-start justify-between space-x-3">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-[#2b2621] dark:text-[#f5f2ec]">Require Host Approval</span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  requireApproval
                    ? 'bg-[#faf3f0] dark:bg-[#2d1d17] text-[#a05e44] dark:text-[#deb09d]'
                    : 'bg-[#f0ebe1] dark:bg-[#25201c] text-[#8c7e6c] dark:text-[#a69c8e]'
                }`}
              >
                {requireApproval ? 'Enabled' : 'Off'}
              </span>
            </div>
            <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] leading-relaxed">
              New guests will be held in "Pending" until you explicitly approve them in the Guests list.
            </p>
          </div>

          <button
            onClick={onToggleRequireApproval}
            type="button"
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition duration-200 shrink-0 ${
              requireApproval ? 'bg-[#a05e44]' : 'bg-[#d5cbbd] dark:bg-[#3d342c]'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-200 ${
                requireApproval ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
