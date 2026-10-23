import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestLayout } from '../../../layouts/GuestLayout';
import { api } from '../../../lib/api';
import { Phone, KeyRound, LogOut, ShieldCheck, CheckCircle2, Moon, Share2, Trash2, Copy, Plus } from 'lucide-react';
import { ThemeToggle } from '../../../components/ThemeToggle';

let cachedGuestProfile: any = null;

export default function GuestMePage() {
  const [guest, setGuest] = useState<any>(() => cachedGuestProfile);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const navigate = useNavigate();

  // Guest share links state
  const [shares, setShares] = useState<any[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [creatingAllShare, setCreatingAllShare] = useState(false);

  const fetchShares = async () => {
    setLoadingShares(true);
    try {
      const res: any = await api('/api/me/shares');
      setShares(res.shares || []);
    } catch {
      // ignore
    } finally {
      setLoadingShares(false);
    }
  };

  useEffect(() => {
    api('/api/me')
      .then((res: any) => {
        cachedGuestProfile = res.guest;
        setGuest(res.guest);
        fetchShares();
      })
      .catch(() => navigate('/'));
  }, [navigate]);

  const handleCopyLink = (shareItem: any) => {
    const slug = typeof shareItem === 'string' ? shareItem : shareItem?.slug;
    const url = (typeof shareItem === 'object' && shareItem?.shareUrl)
      ? shareItem.shareUrl
      : `${window.location.origin}/s/${slug}`;

    if (navigator.share) {
      navigator.share({
        title: typeof shareItem === 'object' ? shareItem.title || 'My Event Captures' : 'My Event Captures',
        url,
      }).catch(() => {
        navigator.clipboard.writeText(url).then(() => {
          setCopiedSlug(slug);
          setTimeout(() => setCopiedSlug(null), 2000);
        });
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 2000);
      });
    }
  };

  const handleCreateAllUploadsShare = async () => {
    setCreatingAllShare(true);
    try {
      const res: any = await api('/api/me/shares', {
        method: 'POST',
        body: JSON.stringify({
          title: `${guest?.name || 'My'} Event Captures`,
          isAllMyUploads: true,
        }),
      });
      if (res.share) {
        setShares((prev) => [res.share, ...prev]);
        handleCopyLink(res.share);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate share link');
    } finally {
      setCreatingAllShare(false);
    }
  };

  const handleDeleteShare = async (id: string) => {
    if (!confirm('Revoke this share link? Anyone with this link will no longer be able to view these photos.')) return;
    try {
      await api(`/api/me/shares/${id}`, { method: 'DELETE' });
      setShares((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to revoke share link');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }

    setSavingPw(true);
    try {
      await api('/api/me/password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: guest.mustChangePassword ? undefined : oldPassword,
          newPassword,
        }),
      });
      setPwSuccess(true);
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api('/api/logout', { method: 'POST' });
    } finally {
      navigate('/');
    }
  };

  return (
    <GuestLayout>
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 flex flex-col p-4 transition-colors duration-200">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs mb-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-xl mb-4 shadow-sm">
            {guest?.name ? guest.name.slice(0, 2).toUpperCase() : 'G'}
          </div>

          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">{guest?.name || 'Guest'}</h2>
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>+{guest?.phone}</span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Active Guest Account</span>
          </div>
        </div>

        {/* Appearance & Theme Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white block">Appearance</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Switch theme appearance</span>
            </div>
          </div>
          <ThemeToggle showLabel />
        </div>

        {/* My Share Links Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Share2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white">
                My Share Links
              </h3>
            </div>
            <button
              onClick={handleCreateAllUploadsShare}
              disabled={creatingAllShare}
              className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center space-x-1 transition cursor-pointer shadow-xs disabled:opacity-50"
              title="Generate a public share link for all your captures"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{creatingAllShare ? 'Creating…' : 'Share My Uploads'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
            Create web links to send your photos and videos to friends or family without needing them to download the app or join the event.
          </p>

          {loadingShares ? (
            <div className="py-4 text-center text-xs text-slate-400">Loading links…</div>
          ) : shares.length === 0 ? (
            <div className="py-5 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              You haven't created any share links yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {shares.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {s.title}
                      </span>
                      {s.hasPassword && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Passcode
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>/s/{s.slug}</span>
                      {s.itemCount !== undefined && <span>• {s.itemCount} items</span>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => handleCopyLink(s)}
                      className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                      title="Share / copy public link"
                    >
                      {copiedSlug === s.slug ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteShare(s.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                      title="Revoke link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Change Password Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs mb-4">
          <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center space-x-2">
            <KeyRound className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Change Password</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
            Your password keeps your shared photos private on any device.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-3">
            {!guest?.mustChangePassword && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-brand-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                New Password (min 6 characters)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-brand-500"
                required
                minLength={6}
              />
            </div>

            {pwError && <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{pwError}</p>}
            {pwSuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Password updated successfully</span>
              </p>
            )}

            <button
              type="submit"
              disabled={savingPw}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-xs hover:bg-brand-500 transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {savingPw ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Logout Button */}
        <div className="mt-auto pt-4">
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-850 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400 font-bold text-xs transition border border-slate-200 dark:border-slate-800 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </GuestLayout>
  );
}
