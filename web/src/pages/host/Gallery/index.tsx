import { useState, useEffect } from 'react';
import { HostLayout } from '../../../layouts/HostLayout';
import { api, getMediaUrl } from '../../../lib/api';
import { MediaGrid, type HostMediaItem } from './components/MediaGrid';
import { SharePanel } from './components/SharePanel';
import {
  Share2,
  Trash2,
  Lock,
  CheckSquare,
  Square,
  X,
  ExternalLink,
  Folder,
  LayoutGrid,
} from 'lucide-react';
import { MeshStatusBadge } from '../../../components/p2p/MeshStatusBadge';

export default function HostGalleryPage() {
  const [media, setMedia] = useState<HostMediaItem[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [isGroupedByFolder, setIsGroupedByFolder] = useState(true);

  // Filters
  const [filterGuestId, setFilterGuestId] = useState<string>('all');
  const [filterKind, setFilterKind] = useState<'all' | 'photo' | 'video'>('all');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'host' | 'selected' | 'all-guests'>('all');

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Share Panel State
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<HostMediaItem | null>(null);

  const fetchMedia = async () => {
    try {
      let query = '';
      const params: string[] = [];
      if (filterGuestId !== 'all') params.push(`guestId=${filterGuestId}`);
      if (filterKind !== 'all') params.push(`kind=${filterKind}`);
      if (filterVisibility !== 'all') {
        params.push(`visibility=${filterVisibility === 'all-guests' ? 'all' : filterVisibility}`);
      }
      if (params.length > 0) query = `?${params.join('&')}`;

      const res: any = await api(`/api/host/media${query}`);
      setMedia(res.media || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGuests = async () => {
    try {
      const res: any = await api('/api/host/guests');
      setGuests(res.guests || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [filterGuestId, filterKind, filterVisibility]);

  // Real-time WebSocket updates for host gallery
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_media' || data.type === 'gallery_updated') {
          fetchMedia();
        }
      } catch {
        // binary or ping frame
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === media.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(media.map((m) => m.id));
    }
  };

  const handleShare = async (guestIds: string[], everyone: boolean) => {
    if (selectedIds.length === 0) return;
    setIsSharing(true);
    try {
      await api('/api/host/share', {
        method: 'POST',
        body: JSON.stringify({
          mediaIds: selectedIds,
          guestIds,
          everyone,
        }),
      });
      setIsShareOpen(false);
      setSelectedIds([]);
      await fetchMedia();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleMakePrivate = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Make ${selectedIds.length} items private (host-only)?`)) return;
    try {
      await api('/api/host/share', {
        method: 'POST',
        body: JSON.stringify({
          mediaIds: selectedIds,
          makePrivate: true,
        }),
      });
      setIsShareOpen(false);
      setSelectedIds([]);
      await fetchMedia();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.length} item(s)? This cannot be undone.`)) return;

    try {
      await api('/api/host/media/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      await fetchMedia();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete selected items');
    }
  };

  const handleDeleteOne = async (id: string) => {
    if (!confirm('Permanently delete this item?')) return;
    try {
      await api(`/api/host/media/${id}`, { method: 'DELETE' });
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      await fetchMedia();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete item');
    }
  };

  const handleDeleteFolder = async (guestId: string, folderName: string, count: number) => {
    if (!confirm(`Permanently delete all ${count} image(s) in "${folderName}'s folder"? This cannot be undone.`)) {
      return;
    }
    const folderItemIds = media.filter((m) => m.guestId === guestId).map((m) => m.id);
    if (folderItemIds.length === 0) return;

    try {
      await api('/api/host/media/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: folderItemIds }),
      });
      setSelectedIds((prev) => prev.filter((id) => !folderItemIds.includes(id)));
      await fetchMedia();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete folder');
    }
  };

  return (
    <HostLayout>
      <div className="space-y-6 pb-20">
        {/* Header and Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#201c19] p-5 rounded-3xl border border-[#e7dfd3] dark:border-[#332b25] shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Guest */}
            <select
              value={filterGuestId}
              onChange={(e) => setFilterGuestId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3] dark:border-[#38312a] text-xs font-semibold text-[#2b2621] dark:text-[#f5f2ec] focus:outline-none focus:border-[#a05e44] dark:focus:border-[#b46b4e] cursor-pointer"
            >
              <option value="all">All Guests ({guests.length})</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            {/* Filter by Kind */}
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3] dark:border-[#38312a] text-xs font-semibold text-[#2b2621] dark:text-[#f5f2ec] focus:outline-none focus:border-[#a05e44] dark:focus:border-[#b46b4e] cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="photo">Photos only</option>
              <option value="video">Videos only</option>
            </select>

            {/* Filter by Visibility */}
            <select
              value={filterVisibility}
              onChange={(e) => setFilterVisibility(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3] dark:border-[#38312a] text-xs font-semibold text-[#2b2621] dark:text-[#f5f2ec] focus:outline-none focus:border-[#a05e44] dark:focus:border-[#b46b4e] cursor-pointer"
            >
              <option value="all">All Sharing States</option>
              <option value="host">Private (Host only)</option>
              <option value="selected">Shared with Selected</option>
              <option value="all-guests">Shared with Everyone</option>
            </select>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* View Mode Toggle: Folders vs All Grid */}
            <div className="flex bg-[#f4efe6] dark:bg-[#161412] p-1 rounded-xl border border-[#e2d9cc] dark:border-[#38312a]">
              <button
                type="button"
                onClick={() => setIsGroupedByFolder(true)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                  isGroupedByFolder
                    ? 'bg-white dark:bg-[#25201c] text-[#2b2621] dark:text-[#f5f2ec] shadow-xs'
                    : 'text-[#8c7e6c] dark:text-[#a69c8e] hover:text-[#2b2621] dark:hover:text-[#f5f2ec]'
                }`}
                title="Group photos by guest folders"
              >
                <Folder className="w-3.5 h-3.5" />
                <span>Folders</span>
              </button>
              <button
                type="button"
                onClick={() => setIsGroupedByFolder(false)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                  !isGroupedByFolder
                    ? 'bg-white dark:bg-[#25201c] text-[#2b2621] dark:text-[#f5f2ec] shadow-xs'
                    : 'text-[#8c7e6c] dark:text-[#a69c8e] hover:text-[#2b2621] dark:hover:text-[#f5f2ec]'
                }`}
                title="View all photos in flat grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>All</span>
              </button>
            </div>

            <MeshStatusBadge />

            <button
              onClick={selectAll}
              className="px-3.5 py-2 rounded-xl bg-[#faf7f2] dark:bg-[#161412] hover:bg-[#f0ebe1] dark:hover:bg-[#25201c] border border-[#e7dfd3] dark:border-[#38312a] text-xs font-semibold text-[#5c5246] dark:text-[#c7bfb4] transition flex items-center space-x-2 cursor-pointer"
            >
              {selectedIds.length > 0 && selectedIds.length === media.length ? (
                <>
                  <CheckSquare className="w-4 h-4 text-[#a05e44]" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-[#8c7e6c]" />
                  <span>Select All ({media.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Media Grid */}
        <MediaGrid
          items={media}
          selectedIds={selectedIds}
          groupByFolder={isGroupedByFolder}
          onToggleSelect={toggleSelect}
          onPreview={(item) => setPreviewItem(item)}
          onDeleteOne={handleDeleteOne}
          onDeleteFolder={handleDeleteFolder}
        />

        {/* Sticky Bottom Multi-Select Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#201c19] text-[#f5f2ec] px-4 sm:px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 sm:space-x-5 border border-[#38312a] max-w-[95vw] overflow-x-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
            <span className="text-xs font-bold text-[#c7bfb4] shrink-0">
              {selectedIds.length} selected
            </span>
            <div className="h-4 w-px bg-[#38312a] shrink-0" />
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setIsShareOpen(true)}
                className="px-3 sm:px-4 py-2 rounded-xl bg-[#a05e44] text-white font-semibold text-xs hover:bg-[#8e5038] transition flex items-center space-x-1.5 cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                onClick={handleMakePrivate}
                className="px-3 py-2 rounded-xl bg-[#2e2722] hover:bg-[#383029] text-[#c7bfb4] font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Private</span>
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-2 rounded-xl bg-[#faeeec] dark:bg-[#2a1716] text-[#a84b45] dark:text-[#d46d65] font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer border border-[#f0c7c3] dark:border-[#4d2220] whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#a84b45]" />
                <span>Delete</span>
              </button>
            </div>
            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-[#8c7e6c] hover:text-[#f5f2ec] rounded-lg cursor-pointer shrink-0"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Share Panel Drawer */}
        <SharePanel
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          selectedCount={selectedIds.length}
          guests={guests}
          onShare={handleShare}
          onMakePrivate={handleMakePrivate}
          sharing={isSharing}
        />

        {/* Media Preview Modal */}
        {previewItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4"
            onClick={() => setPreviewItem(null)}
          >
            <div
              className="bg-white dark:bg-[#201c19] rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-[#e7dfd3] dark:border-[#332b25]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[#e7dfd3] dark:border-[#332b25] flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-[#2b2621] dark:text-[#f5f2ec]">
                    Uploaded by {previewItem.uploaderName}
                  </h4>
                  <p className="text-xs text-[#8c7e6c] font-mono">
                    {new Date(previewItem.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={previewItem.path}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Open raw file"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 flex items-center justify-center max-h-[70vh]">
                {previewItem.kind === 'photo' ? (
                  <img
                    src={getMediaUrl(previewItem.path)}
                    alt="Preview"
                    className="max-h-[70vh] w-auto object-contain"
                  />
                ) : (
                  <video
                    src={getMediaUrl(previewItem.path)}
                    controls
                    autoPlay
                    className="max-h-[70vh] w-auto object-contain"
                  />
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#090b0e] flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Sharing status: </span>
                  {previewItem.visibility === 'all' && 'Shared with Everyone'}
                  {previewItem.visibility === 'selected' &&
                    `Shared with ${previewItem.sharedGuestNames.join(', ')}`}
                  {previewItem.visibility === 'host' && 'Private (Host Only)'}
                </div>
                <button
                  onClick={() => {
                    setSelectedIds([previewItem.id]);
                    setIsShareOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 transition cursor-pointer"
                >
                  Change Sharing
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </HostLayout>
  );
}
