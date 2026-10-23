import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestLayout } from '../../../layouts/GuestLayout';
import { api } from '../../../lib/api';
import { Archive, Video, Image as ImageIcon, Folder, FolderOpen, LayoutGrid, ChevronDown, Trash2, Radio } from 'lucide-react';
import { useMesh } from '../../../lib/p2p/MeshContext';
import { MeshStatusBadge } from '../../../components/p2p/MeshStatusBadge';

// In-memory client cache so navigating between Camera, Album, and Me is instantaneous without reload lag
let galleryCache: { shared?: any[]; mine?: any[]; offline?: any[]; guestInfo?: any; timestamp?: number } = {};

export default function GuestGalleryPage() {
  const [tab, setTab] = useState<'shared' | 'mine' | 'offline'>('shared');
  const { offlinePhotos } = useMesh();
  const [media, setMedia] = useState<any[]>(() => (tab === 'offline' ? [] : galleryCache[tab] || []));
  const [loading, setLoading] = useState(() => (tab === 'offline' ? false : !galleryCache[tab]));
  const [guestInfo, setGuestInfo] = useState<any>(() => galleryCache.guestInfo || null);
  const [isGroupedByFolder, setIsGroupedByFolder] = useState(true);
  const navigate = useNavigate();

  const fetchGallery = async (silent = false) => {
    if (tab === 'offline') return;
    if (!silent && !galleryCache[tab]) setLoading(true);
    try {
      const res: any = await api(`/api/gallery?tab=${tab}`);
      const fresh = res.media || [];
      galleryCache[tab] = fresh;
      setMedia(fresh);
    } catch (err: any) {
      if (err.status === 401 || err.data?.pending) {
        navigate('/waiting');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMe = async () => {
    try {
      const res: any = await api('/api/me');
      galleryCache.guestInfo = res.guest;
      setGuestInfo(res.guest);
    } catch {
      // not logged in
    }
  };

  useEffect(() => {
    if (!guestInfo) fetchMe();
  }, [guestInfo]);

  useEffect(() => {
    if (tab === 'offline') {
      setLoading(false);
      return;
    }
    // If we have cached items for this tab, show immediately and refresh in background
    if (galleryCache[tab]) {
      setMedia(galleryCache[tab]!);
      setLoading(false);
      fetchGallery(true);
    } else {
      fetchGallery(false);
    }
  }, [tab]);

  // Listen for real-time gallery updates from Host
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'gallery_updated') {
          fetchGallery(true);
        }
      } catch {
        // binary or ping
      }
    };

    return () => {
      ws.close();
    };
  }, [tab]);

  const handleDownloadZip = () => {
    if (!media || media.length === 0) {
      alert('No photos available to download yet.');
      return;
    }
    const link = document.createElement('a');
    link.href = `/api/zip?tab=${tab}`;
    link.download = `gather-${tab}-photos.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Permanently delete this photo?')) return;
    try {
      await api(`/api/media/${id}`, { method: 'DELETE' });
      await fetchGallery();
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo');
    }
  };

  const renderMediaCard = (item: any) => {
    const isMyPhoto = guestInfo && item.guestId === guestInfo.id;

    return (
      <div
        key={item.id}
        onClick={() => navigate(`/album/${item.id}`)}
        className="aspect-square relative rounded-2xl overflow-hidden bg-slate-200 border border-slate-200/80 cursor-pointer group active:scale-98 transition shadow-xs"
      >
        {item.kind === 'photo' ? (
          <img
            src={`/api/media/${item.id}/thumb`}
            alt="Thumbnail"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.triedFallback) {
                target.dataset.triedFallback = 'true';
                target.src = `/api/media/${item.id}`;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white relative">
            {item.thumbPath && !item.thumbPath.endsWith('.mp4') && !item.thumbPath.endsWith('.webm') && !item.thumbPath.endsWith('.mov') ? (
              <img
                src={`/api/media/${item.id}/thumb`}
                alt="Thumbnail"
                className="w-full h-full object-cover opacity-85"
                loading="lazy"
              />
            ) : (
              <video
                src={`/api/media/${item.id}`}
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

        {/* Delete button for user's own photos */}
        {isMyPhoto && (
          <button
            type="button"
            onClick={(e) => handleDeleteOne(e, item.id)}
            className="absolute top-1.5 right-1.5 z-10 w-7 h-7 rounded-lg bg-black/60 hover:bg-red-600 text-white flex items-center justify-center backdrop-blur-xs transition cursor-pointer shadow-xs"
            title="Delete photo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Uploader badge if in shared view or flat view */}
        {item.uploaderName && (
          <div className="absolute top-1.5 left-1.5 bg-black/50 backdrop-blur-xs text-[10px] text-white px-1.5 py-0.5 rounded-md font-medium max-w-[80%] truncate">
            {item.uploaderName}
          </div>
        )}

        <div className="absolute bottom-1.5 right-1.5 bg-black/40 backdrop-blur-xs text-[10px] text-white px-1.5 py-0.5 rounded-md font-mono">
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  };

  // Memoize folders grouping to avoid redundant O(N) grouping calculations on every re-render
  const folderList = useMemo(() => {
    const foldersMap = new Map<string, { guestId: string; uploaderName: string; items: any[] }>();
    for (const item of media) {
      const key = item.guestId || 'unknown';
      if (!foldersMap.has(key)) {
        foldersMap.set(key, {
          guestId: item.guestId,
          uploaderName: item.uploaderName || (tab === 'mine' ? 'My Folder' : 'Guest'),
          items: [],
        });
      }
      foldersMap.get(key)!.items.push(item);
    }
    return Array.from(foldersMap.values());
  }, [media, tab]);

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const activeFolder = folderList.find((f) => f.guestId === activeFolderId);

  return (
    <GuestLayout>
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24 flex flex-col">
        {/* Header */}
        <header className="p-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-lg font-bold text-slate-900">Event Gallery</h1>
            <p className="text-xs text-slate-500">
              {guestInfo ? `Logged in as ${guestInfo.name}` : 'Captures'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Folder / Grid view switcher */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setIsGroupedByFolder(true)}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center transition cursor-pointer ${
                  isGroupedByFolder ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
                title="View in folders"
              >
                <Folder className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsGroupedByFolder(false)}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center transition cursor-pointer ${
                  !isGroupedByFolder ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
                title="View flat grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            {guestInfo?.canDownload && (
              <button
                onClick={handleDownloadZip}
                className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition"
                title="Download all shared photos as ZIP"
              >
                <Archive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download ZIP</span>
              </button>
            )}
          </div>
        </header>

        {/* Tab Controls */}
        <div className="p-3 bg-white border-b border-slate-100 flex items-center justify-center">
          <div className="w-full max-w-sm flex bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => {
                setTab('shared');
                setActiveFolderId(null);
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                tab === 'shared' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              Shared
            </button>
            <button
              onClick={() => {
                setTab('mine');
                setActiveFolderId(null);
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                tab === 'mine' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              My shots
            </button>
            <button
              onClick={() => {
                setTab('offline');
                setActiveFolderId(null);
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                tab === 'offline' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>Offline ({offlinePhotos.length})</span>
            </button>
          </div>
        </div>

        {/* In-feed P2P Network Strip */}
        <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200/60 flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-600 font-medium">Local P2P Mesh</span>
          </div>
          <MeshStatusBadge />
        </div>

        {/* Grid Content */}
        <div className="p-3 flex-1">
          {tab === 'offline' ? (
            offlinePhotos.length === 0 ? (
              <div className="py-20 text-center max-w-xs mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Radio className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-slate-800 mb-1">No offline photos</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Take photos in Camera or connect to peers via P2P mesh to receive photos without internet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {offlinePhotos.map((photo) => {
                  const url = URL.createObjectURL(photo.blob);
                  return (
                    <div
                      key={photo.hash}
                      className="aspect-square relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xs"
                    >
                      <img src={url} alt="Offline" className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full text-[9px] font-semibold text-emerald-400 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>P2P Saved</span>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[9px] font-mono text-slate-300 bg-black/50 px-2 py-0.5 rounded-md">
                        <span>#{photo.hash.substring(0, 6)}</span>
                        <span>{new Date(photo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : loading && media.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : media.length === 0 ? (
            <div className="py-20 text-center max-w-xs mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-800 mb-1">
                {tab === 'shared' ? 'No shared photos yet' : 'No photos taken yet'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {tab === 'shared'
                  ? 'When the host curates and shares photos with you or everyone, they will appear here.'
                  : 'Open the Camera tab to start capturing memories from the event!'}
              </p>
            </div>
          ) : isGroupedByFolder ? (
            /* File Manager Folder Row and Inspector */
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2.5 px-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Folders ({folderList.length})
                  </span>
                  {activeFolderId && (
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(null)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Close folder
                    </button>
                  )}
                </div>

                {/* Horizontal row of file manager folders */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {folderList.map((folder) => {
                    const isOpen = activeFolderId === folder.guestId;
                    return (
                      <div
                        key={folder.guestId}
                        onClick={() => setActiveFolderId(isOpen ? null : folder.guestId)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center space-x-3 ${
                          isOpen
                            ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/80 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-amber-100/90 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
                          {isOpen ? (
                            <FolderOpen className="w-5 h-5 fill-amber-500/30" />
                          ) : (
                            <Folder className="w-5 h-5 fill-amber-500/20" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {folder.uploaderName}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {folder.items.length} {folder.items.length === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Folder Inspector */}
              {activeFolder ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900 truncate">
                      <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                      <span>{activeFolder.uploaderName}&apos;s Folder</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {activeFolder.items.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(null)}
                      className="text-xs text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {activeFolder.items.map(renderMediaCard)}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                  <Folder className="w-6 h-6 text-amber-500/70 fill-amber-500/20 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-600 font-medium">Tap any folder above to open</p>
                  <p className="text-[10px] text-slate-400">Photos are organized by uploader</p>
                </div>
              )}
            </div>
          ) : (
            /* Plain Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {media.map(renderMediaCard)}
            </div>
          )}
        </div>
      </div>
    </GuestLayout>
  );
}
