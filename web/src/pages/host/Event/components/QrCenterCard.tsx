import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Download, Printer } from 'lucide-react';

interface QrCenterCardProps {
  joinUrl: string;
  slug: string;
}

export function QrCenterCard({ joinUrl, slug }: QrCenterCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    const svg = document.getElementById('event-qr-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1000, 1000);
        ctx.drawImage(img, 100, 100, 800, 800);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `gather-${slug}-qr.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-8 flex flex-col items-center text-center space-y-6 shadow-xs">
      <div>
        <h3 className="text-base font-semibold text-[#2b2621] dark:text-[#f5f2ec]">Official Event Join QR</h3>
        <p className="text-xs text-[#8c7e6c] dark:text-[#a69c8e] mt-0.5">Guests scan with their camera to enter</p>
      </div>

      <div className="p-6 bg-white border border-[#e7dfd3] dark:border-[#38312a] rounded-3xl shadow-sm inline-block">
        <QRCodeSVG id="event-qr-svg" value={joinUrl} size={240} level="H" />
      </div>

      <div className="w-full space-y-3">
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3] dark:border-[#38312a] text-xs">
          <span className="font-mono text-[#5c5246] dark:text-[#c7bfb4] truncate mr-2">{joinUrl}</span>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 font-semibold text-[#2b2621] dark:text-[#f5f2ec] hover:text-[#a05e44] dark:hover:text-[#deb09d] cursor-pointer shrink-0 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#53785e] dark:text-[#699777]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownloadQr}
            className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-[#a05e44] hover:bg-[#8e5038] text-white font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PNG</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-[#f0ebe1] dark:bg-[#25201c] hover:bg-[#e7dfd3] dark:hover:bg-[#2e2722] text-[#2b2621] dark:text-[#f5f2ec] font-semibold text-xs transition border border-[#e2d9cc] dark:border-[#38312a] cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print QR Card</span>
          </button>
        </div>
      </div>
    </div>
  );
}
