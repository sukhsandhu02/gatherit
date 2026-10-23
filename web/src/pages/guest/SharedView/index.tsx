import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import {
  Download,
  Lock,
  ArrowLeft,
  Image as ImageIcon,
  Video,
  X,
} from 'lucide-react';
import { LogoMark } from '../../../components/Logo';

export default function GuestSharedViewPage() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [savedPassword, setSavedPassword] = useState<string>('');

  // Selected item modal viewer
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const fetchShare = async (pw?: string) => {
    if (!shareSlug) return;
    setLoading(true);
    setError(null);
    try {
      const url = pw
        ? `/api/guest-shares/${shareSlug}?pw=${encodeURIComponent(pw)}`
        : `/api/guest-shares/${shareSlug}`;
      const res: any = await api(url);

      if (res.requiresPassword) {
        setRequiresPassword(true);
        setShareData({ title: res.title, slug: res.slug });
      } else {
        setRequiresPassword(false);
        setShareData(res.share);
        setMedia(res.media || []);
        if (pw) setSavedPassword(pw);
      }
    } catch (err: any) {
      if (err.data?.requiresPassword) {
        setRequiresPassword(true);
        setPasswordError(err.message || 'Incorrect password');
      } else {
        setError(err.message || 'Share link not found or expired');
      }
    } finally {
      setLoading(false);
      setUnlocking(false);
    }
  };

  useEffect(() => {
    fetchShare();
  }, [shareSlug]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setPasswordError(null);
    setUnlocking(true);
    fetchShare(passwordInput.trim());
  };

  const handleDownloadZip = () => {
    if (!shareSlug) return;
    const url = savedPassword
      ? `/api/guest-shares/${shareSlug}/zip?pw=${encodeURIComponent(savedPassword)}`
      : `/api/guest-shares/${shareSlug}/zip`;
    window.location.href = url;
  };

  const getMediaUrl = (mediaId: string, thumb = false, download = false) => {
    let url = `/api/guest-shares/${shareSlug}/media/${mediaId}?`;
    const params: string[] = [];
    if (thumb) params.push('thumb=1');
    if (download) params.push('download=1');
    if (savedPassword) params.push(`pw=${encodeURIComponent(savedPassword)}`);
    return url + params.join('&');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f4ee] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading shared memories…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f4ee] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-serif font-bold text-slate-900 dark:text-slate-100">Unavailable</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-[#f6f4ee] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#12151c] rounded-3xl border border-slate-200 dark:border-slate-800 p-7 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-serif font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {shareData?.title || 'Protected Album'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">
            This collection is protected by a password. Please enter it below to view the photos.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter album password"
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {passwordError && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">{passwordError}</p>
            )}

            <button
              type="submit"
              disabled={unlocking}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {unlocking ? 'Verifying…' : 'Unlock Collection'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f4ee] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 selection:bg-brand-600 selection:text-white transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-slate-200/60 dark:border-slate-800/60 backdrop-blur-md bg-[#f6f4ee]/80 dark:bg-[#090b0e]/80 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark className="w-7 h-7" />
            <span className="font-serif font-black text-lg tracking-tight text-slate-900 dark:text-white">gather</span>
          </Link>

          {media.length > 0 && (
            <button
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-2 text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-full transition shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download All ({media.length})</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-5 py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300">
              Shared by {shareData?.authorName || 'Guest'}
            </span>
            {shareData?.eventName && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                from <span className="font-medium">{shareData.eventName}</span>
              </span>
            )}
          </div>

          <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {shareData?.title || 'Shared Memories'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {media.length} {media.length === 1 ? 'item' : 'items'} in this collection
          </p>
        </div>

        {/* Media Grid */}
        {media.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-white dark:bg-[#12151c] rounded-3xl border border-slate-200 dark:border-slate-800">
            <ImageIcon className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No media in this album</p>
            <p className="text-xs text-slate-400">Items may have been removed or deleted by the author.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {media.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="aspect-square relative rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 cursor-pointer group active:scale-98 transition shadow-xs"
              >
                {item.kind === 'photo' ? (
                  <img
                    src={getMediaUrl(item.id, true)}
                    alt="Thumbnail"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.triedFallback) {
                        target.dataset.triedFallback = 'true';
                        target.src = getMediaUrl(item.id, false);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white relative">
                    {item.thumbPath && !item.thumbPath.endsWith('.mp4') && !item.thumbPath.endsWith('.webm') && !item.thumbPath.endsWith('.mov') ? (
                      <img
                        src={getMediaUrl(item.id, true)}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover opacity-85"
                        loading="lazy"
                      />
                    ) : (
                      <video
                        src={getMediaUrl(item.id, false)}
                        className="w-full h-full object-cover opacity-75 pointer-events-none"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Video className="w-7 h-7 text-white drop-shadow-md" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Item Viewer Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between text-white select-none animate-fadeIn">
          {/* Top Bar */}
          <header className="p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
            <button
              onClick={() => setSelectedItem(null)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <a
              href={getMediaUrl(selectedItem.id, false, true)}
              className="px-4 py-2 rounded-full bg-white text-slate-900 font-semibold text-xs flex items-center space-x-1.5 shadow-md active:scale-95 transition cursor-pointer"
              download
            >
              <Download className="w-4 h-4" />
              <span>Save</span>
            </a>
          </header>

          {/* Media Container */}
          <div className="flex-1 flex items-center justify-center p-2 relative overflow-hidden">
            <div className="max-w-full max-h-[80vh] flex items-center justify-center">
              {selectedItem.kind === 'photo' ? (
                <img
                  src={getMediaUrl(selectedItem.id, false)}
                  alt="Viewing capture"
                  className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
                />
              ) : (
                <video
                  src={getMediaUrl(selectedItem.id, false)}
                  controls
                  playsInline
                  autoPlay
                  className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="p-4 bg-gradient-to-t from-black/80 to-transparent text-center z-20">
            <p className="text-xs text-slate-400">
              Shared with Gather. Tap Save to download to your device.
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
