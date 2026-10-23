import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useMesh } from '../../lib/p2p/MeshContext';
import { 
  Wifi, 
  Bluetooth, 
  QrCode, 
  Radio, 
  X, 
  Check, 
  Copy, 
  Smartphone, 
  HardDrive
} from 'lucide-react';

export const MeshModal: React.FC = () => {
  const { 
    isMeshModalOpen, 
    setIsMeshModalOpen, 
    connectedCount, 
    localId, 
    offlinePhotos,
    createManualOffer,
    acceptManualOffer,
    finalizeManualAnswer,
    scanBluetoothPeers 
  } = useMesh();

  const [tab, setTab] = useState<'lan' | 'qr' | 'bluetooth' | 'storage'>('lan');
  const [offerCode, setOfferCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [btDevice, setBtDevice] = useState<string | null>(null);

  if (!isMeshModalOpen) return null;

  const handleGenerateOffer = async () => {
    setStatusMsg('Generating WebRTC offer & gathering candidates...');
    try {
      const code = await createManualOffer();
      setOfferCode(code);
      setStatusMsg('Offer generated! Have peer scan or paste this code.');
    } catch (err: any) {
      setStatusMsg('Failed: ' + err.message);
    }
  };

  const handleAcceptOfferOrAnswer = async () => {
    if (!inputCode.trim()) return;
    setStatusMsg('Processing code...');
    try {
      const parsed = JSON.parse(inputCode.trim());
      if (parsed.sdp?.type === 'offer') {
        const answer = await acceptManualOffer(inputCode.trim());
        setOfferCode(answer);
        setStatusMsg('Offer accepted! Show this answer code to Phone A.');
      } else if (parsed.sdp?.type === 'answer') {
        await finalizeManualAnswer(parsed.peerId, inputCode.trim());
        setStatusMsg('Answer applied! Direct P2P mesh data channel is open.');
      }
    } catch (err: any) {
      setStatusMsg('Error: ' + err.message);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBtScan = async () => {
    setStatusMsg('Opening Bluetooth device selector...');
    try {
      const device = await scanBluetoothPeers();
      if (device) {
        setBtDevice(device);
        setStatusMsg('Bluetooth device linked: ' + device);
      } else {
        setStatusMsg('Bluetooth scan cancelled.');
      }
    } catch (err: any) {
      setStatusMsg('Bluetooth: ' + err.message);
    }
  };

  const lanHost = window.location.host;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full text-slate-100 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <h2 className="text-base font-semibold text-white">Offline Mesh & Direct P2P</h2>
              <p className="text-[11px] text-slate-400">Zero-internet local sync • {connectedCount} peer{connectedCount === 1 ? '' : 's'} connected</p>
            </div>
          </div>
          <button 
            onClick={() => setIsMeshModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-4 p-2 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <button 
            onClick={() => setTab('lan')}
            className={`py-2 px-1 flex flex-col items-center justify-center space-y-1 rounded-xl transition cursor-pointer ${
              tab === 'lan' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-4 h-4" />
            <span className="text-[11px]">Wi-Fi / LAN</span>
          </button>

          <button 
            onClick={() => setTab('qr')}
            className={`py-2 px-1 flex flex-col items-center justify-center space-y-1 rounded-xl transition cursor-pointer ${
              tab === 'qr' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span className="text-[11px]">Optical QR</span>
          </button>

          <button 
            onClick={() => setTab('bluetooth')}
            className={`py-2 px-1 flex flex-col items-center justify-center space-y-1 rounded-xl transition cursor-pointer ${
              tab === 'bluetooth' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bluetooth className="w-4 h-4" />
            <span className="text-[11px]">Bluetooth</span>
          </button>

          <button 
            onClick={() => setTab('storage')}
            className={`py-2 px-1 flex flex-col items-center justify-center space-y-1 rounded-xl transition cursor-pointer ${
              tab === 'storage' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span className="text-[11px]">Offline Box</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          
          {tab === 'lan' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-medium">
                  <Radio className="w-4 h-4" />
                  <span>Host Wi-Fi Hotspot (Zero Internet)</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Turn on your mobile hotspot (no mobile data / cellular required). Guests connect to your hotspot Wi-Fi and open this address:
                </p>
                <div className="bg-black/50 p-3 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-emerald-300 text-xs">
                  <span>http://{lanHost}</span>
                  <button 
                    onClick={() => handleCopy(`http://${lanHost}`)} 
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-800/30 rounded-2xl border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Your Node ID</div>
                  <div className="text-[11px] text-slate-400 font-mono">{localId}</div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-semibold">
                  Broadcasting
                </span>
              </div>
            </div>
          )}

          {tab === 'qr' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-3">
                <div className="flex items-center space-x-2 text-brand-400 font-medium">
                  <QrCode className="w-4 h-4" />
                  <span>Optical Air-Gapped WebRTC Pairing</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Establish a direct phone-to-phone WebRTC DataChannel without needing any router or Wi-Fi hotspot.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateOffer}
                    className="flex-1 py-2.5 px-3 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl text-xs transition cursor-pointer"
                  >
                    1. Generate Offer QR
                  </button>
                </div>

                {offerCode && (
                  <div className="space-y-3 bg-black/60 p-4 rounded-2xl border border-slate-800 flex flex-col items-center">
                    <div className="bg-white p-3 rounded-xl shadow-md">
                      <QRCodeSVG value={offerCode.substring(0, 800)} size={180} />
                    </div>
                    <div className="w-full flex items-center justify-between gap-2">
                      <div className="truncate font-mono text-[10px] text-slate-400 flex-1">
                        {offerCode.substring(0, 40)}...
                      </div>
                      <button 
                        onClick={() => handleCopy(offerCode)}
                        className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-medium text-[11px] flex items-center space-x-1"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Paste peer response */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-slate-300">2. Scan / Paste Peer Code (Offer or Answer):</label>
                <textarea
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Paste JSON Offer/Answer here..."
                  className="w-full h-20 bg-black/50 border border-slate-800 rounded-xl p-2.5 text-[11px] font-mono text-slate-200 placeholder-slate-600 focus:outline-hidden focus:border-brand-500"
                />
                <button
                  onClick={handleAcceptOfferOrAnswer}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-xs transition cursor-pointer"
                >
                  Connect Peer
                </button>
              </div>
            </div>
          )}

          {tab === 'bluetooth' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-3">
                <div className="flex items-center space-x-2 text-indigo-400 font-medium">
                  <Bluetooth className="w-4 h-4" />
                  <span>Web Bluetooth LE Scanner</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Connect to nearby Gather devices over Bluetooth Low Energy directly from your mobile browser.
                </p>

                <button
                  onClick={handleBtScan}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>Scan for Bluetooth Devices</span>
                </button>

                {btDevice && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-emerald-400 text-xs">
                    <Check className="w-4 h-4 shrink-0" />
                    <span className="truncate">{btDevice}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'storage' && (
            <div className="space-y-3">
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Local Device Storage (IndexedDB)</span>
                  <span className="text-brand-400 font-mono text-xs">{offlinePhotos.length} photo{offlinePhotos.length === 1 ? '' : 's'}</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  All photos taken while offline are saved permanently in your phone's sandbox and automatically synchronized to other phones whenever they connect.
                </p>
              </div>

              {offlinePhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 pt-2 max-h-48 overflow-y-auto">
                  {offlinePhotos.map((photo) => {
                    const src = URL.createObjectURL(photo.blob);
                    return (
                      <div key={photo.hash} className="aspect-square bg-black rounded-xl overflow-hidden border border-slate-800 relative group">
                        <img src={src} alt="Offline" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded-sm text-[8px] font-mono text-slate-300">
                          {photo.hash.substring(0, 4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No offline photos saved on this device yet.
                </div>
              )}
            </div>
          )}

          {statusMsg && (
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 text-[11px]">
              {statusMsg}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <span>P2P Swarm Active</span>
          </div>
          <button 
            onClick={() => setIsMeshModalOpen(false)}
            className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
