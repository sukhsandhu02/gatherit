import { X, KeyRound, Check } from 'lucide-react';
import { useState } from 'react';

interface TempCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tempCode: string;
  guestName: string;
}

export function TempCodeModal({ isOpen, onClose, tempCode, guestName }: TempCodeModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(tempCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4">
      <div className="max-w-sm w-full bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-6 text-center space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-[#2b2621] dark:text-[#f5f2ec]">Password Reset</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8c7e6c] hover:text-[#2b2621] dark:hover:text-[#f5f2ec] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e]">
            One-time 6-digit login code generated for <strong className="text-[#2b2621] dark:text-[#f5f2ec]">{guestName}</strong>:
          </p>
        </div>

        <div className="p-4 bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3] dark:border-[#38312a] rounded-2xl">
          <span className="font-mono text-3xl font-extrabold tracking-widest text-[#a05e44] dark:text-[#deb09d]">
            {tempCode}
          </span>
        </div>

        <p className="text-[11px] text-[#8c7e6c] dark:text-[#a69c8e] leading-relaxed">
          Provide this code to the guest. When they log in with their phone and this code, they will be forced to choose a new password.
        </p>

        <div className="space-y-2">
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#a05e44] text-white text-xs font-semibold hover:bg-[#8e5038] transition cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-4 h-4 text-[#deb09d]" /> : <KeyRound className="w-4 h-4" />}
            <span>{copied ? 'Code Copied!' : 'Copy Temporary Code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
