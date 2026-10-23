import { X, Copy, Check, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface QrShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  name: string;
  copied: boolean;
  onCopy: () => void;
}

export function QrShareModal({ isOpen, onClose, url, name, copied, onCopy }: QrShareModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="max-w-sm w-full bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-6 text-center space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-sand-900 dark:text-sand-100">{name}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-sand-400 hover:text-sand-900 dark:hover:text-sand-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-white border border-[#e2dcce] dark:border-[#332b25] rounded-2xl inline-block shadow-xs">
          <QRCodeSVG value={url} size={220} level="M" />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-sand-900 dark:text-sand-100">Scan with phone camera</p>
          <p className="text-[11px] text-sand-500 dark:text-sand-400">
            Scanning this code on any phone instantly joins the event. No app download needed.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={onCopy}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#f5f2ec] dark:bg-[#201c19] hover:bg-[#eae4d8] dark:hover:bg-[#28231f] border border-[#e2dcce] dark:border-[#332b25] text-xs font-semibold text-sand-800 dark:text-sand-200 transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-sage-600 dark:text-sage-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link Copied!' : 'Copy Event Pass Link'}</span>
          </button>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Scan or open this link to join our event: ${url}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-sage-700 hover:bg-sage-600 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <Share2 className="w-4 h-4" />
            <span>Share via WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
}
