import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useIsFocused } from '@react-navigation/native';
import { apiClient } from '../services/api';
import { storage } from '../services/storage';
import { MediaItem, OfflineQueueItem } from '../types';
import { uploadQueue } from '../services/uploadQueue';
import { MediaModalViewer } from '../components/MediaModalViewer';
import {
  Download,
  Image as ImageIcon,
  Folder,
  FolderOpen,
  LayoutGrid,
  Check,
  ChevronDown,
  Radio,
  Sparkles,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SPACING = 8;
const ITEM_SIZE = (width - 32 - (COLUMN_COUNT - 1) * ITEM_SPACING) / COLUMN_COUNT;

export function GalleryScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'shared' | 'mine' | 'offline'>('shared');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [offlineItems, setOfflineItems] = useState<OfflineQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [isGroupedByFolder, setIsGroupedByFolder] = useState(true);
  const [activeFolderGuestId, setActiveFolderGuestId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const isFocused = useIsFocused();

  useEffect(() => {
    storage.getServerUrl().then(setServerUrl);
    const unsubscribe = uploadQueue.subscribe((items) => {
      setOfflineItems(items);
      // If an upload recently finished (e.g. pending items dropped), silently re-fetch gallery
      fetchGallery(true);
    });
    return () => unsubscribe();
  }, []);

  const fetchGallery = async (silent = false) => {
    if (tab === 'offline') {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const res = await apiClient(`/api/gallery?tab=${tab}`);
      setMedia(res.media || []);
    } catch (err: any) {
      console.log('Error fetching gallery:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Re-fetch whenever tab changes OR whenever screen comes into focus
  useEffect(() => {
    if (isFocused) {
      fetchGallery();
    }
  }, [tab, isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGallery();
  };

  // Group media by uploader for the file manager folder view
  const folderList = useMemo(() => {
    const map = new Map<string, { guestId: string; uploaderName: string; items: MediaItem[] }>();
    for (const item of media) {
      const key = item.guestId || 'host';
      if (!map.has(key)) {
        map.set(key, {
          guestId: key,
          uploaderName: item.uploaderName || (tab === 'mine' ? 'My Folder' : 'Event Host'),
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values());
  }, [media, tab]);

  const activeFolder = folderList.find((f) => f.guestId === activeFolderGuestId);

  const renderPhotoCard = (item: MediaItem) => {
    const cleanServer = serverUrl.replace(/\/+$/, '');
    const thumbUrl = `${cleanServer}${item.thumbPath || item.path}`;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.gridItem, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => setSelectedItem(item)}
      >
        <Image
          source={{ uri: thumbUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        {item.uploaderName && (
          <View style={styles.uploaderBadge}>
            <Text style={styles.uploaderText} numberOfLines={1}>
              {item.uploaderName}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Top Controls: Tabs and View Switcher */}
      <View style={[styles.headerStrip, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* Tab pill switcher */}
        <View style={[styles.tabBar, { backgroundColor: colors.surfaceElevated }]}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'shared' && { backgroundColor: colors.surface }]}
            onPress={() => {
              setTab('shared');
              setActiveFolderGuestId(null);
            }}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === 'shared' ? colors.textPrimary : colors.textMuted },
                tab === 'shared' && { fontWeight: '700' },
              ]}
            >
              Shared
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'mine' && { backgroundColor: colors.surface }]}
            onPress={() => {
              setTab('mine');
              setActiveFolderGuestId(null);
            }}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === 'mine' ? colors.textPrimary : colors.textMuted },
                tab === 'mine' && { fontWeight: '700' },
              ]}
            >
              My Shots
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              tab === 'offline' && { backgroundColor: colors.brand },
            ]}
            onPress={() => {
              setTab('offline');
              setActiveFolderGuestId(null);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Radio size={12} color={tab === 'offline' ? colors.brandText : colors.textMuted} />
              <Text
                style={[
                  styles.tabText,
                  { color: tab === 'offline' ? colors.brandText : colors.textMuted },
                  tab === 'offline' && { fontWeight: '700' },
                ]}
              >
                Offline ({offlineItems.length})
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* View Mode Switcher (Folders vs Flat Grid) */}
        {tab !== 'offline' && (
          <View style={[styles.viewSwitchGroup, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.viewSwitchBtn, isGroupedByFolder && { backgroundColor: colors.surface }]}
              onPress={() => setIsGroupedByFolder(true)}
            >
              <Folder size={14} color={isGroupedByFolder ? colors.textPrimary : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewSwitchBtn, !isGroupedByFolder && { backgroundColor: colors.surface }]}
              onPress={() => setIsGroupedByFolder(false)}
            >
              <LayoutGrid size={14} color={!isGroupedByFolder ? colors.textPrimary : colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main Content Area */}
      <FlatList
        data={tab === 'offline' ? [] : (isGroupedByFolder ? [] : media)}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
        ListHeaderComponent={
          tab === 'offline' ? (
            offlineItems.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceElevated }]}>
                  <Radio size={28} color={colors.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Offline Captures</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Photos captured while disconnected queue locally and sync automatically when network returns.
                </Text>
              </View>
            ) : (
              <View style={styles.gridRow}>
                {offlineItems.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.gridItem, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  >
                    <Image source={{ uri: item.localUri }} style={styles.thumbnail} />
                    <View style={styles.offlineStatusOverlay}>
                      <Text style={styles.offlineStatusText}>
                        {item.status === 'uploading' ? 'Syncing...' : 'Pending Sync'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : isGroupedByFolder ? (
            <View style={styles.folderSection}>
              {/* Folder list cards */}
              <View style={styles.folderHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  Folders ({folderList.length})
                </Text>
                {activeFolderGuestId && (
                  <TouchableOpacity onPress={() => setActiveFolderGuestId(null)}>
                    <Text style={[styles.closeFolderText, { color: colors.brand }]}>Close folder</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.folderGrid}>
                {folderList.map((folder) => {
                  const isOpen = activeFolderGuestId === folder.guestId;
                  return (
                    <TouchableOpacity
                      key={folder.guestId}
                      style={[
                        styles.folderCard,
                        { backgroundColor: colors.surface, borderColor: isOpen ? colors.warning : colors.border },
                        isOpen && { borderWidth: 2, backgroundColor: 'rgba(245,158,11,0.06)' },
                      ]}
                      onPress={() => setActiveFolderGuestId(isOpen ? null : folder.guestId)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.folderIconWrapper, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                        {isOpen ? (
                          <FolderOpen size={20} color={colors.warning} />
                        ) : (
                          <Folder size={20} color={colors.warning} />
                        )}
                      </View>
                      <View style={styles.folderInfo}>
                        <Text style={[styles.folderName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {folder.uploaderName}
                        </Text>
                        <Text style={[styles.folderCount, { color: colors.textMuted }]}>
                          {folder.items.length} {folder.items.length === 1 ? 'item' : 'items'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Opened folder photos inspector */}
              {activeFolder ? (
                <View style={[styles.activeFolderBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.activeFolderTitleRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <FolderOpen size={16} color={colors.warning} />
                      <Text style={[styles.activeFolderName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {activeFolder.uploaderName}&apos;s Memories
                      </Text>
                      <View style={[styles.countBadge, { backgroundColor: colors.surfaceElevated }]}>
                        <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
                          {activeFolder.items.length}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setActiveFolderGuestId(null)}>
                      <ChevronDown size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.gridRow}>
                    {activeFolder.items.map(renderPhotoCard)}
                  </View>
                </View>
              ) : (
                <View style={[styles.folderEmptyPrompt, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                  <Folder size={24} color={colors.warning} style={{ marginBottom: 4 }} />
                  <Text style={[styles.folderEmptyTitle, { color: colors.textSecondary }]}>
                    Tap any folder above to open
                  </Text>
                  <Text style={[styles.folderEmptySub, { color: colors.textMuted }]}>
                    Organized automatically by guest and host
                  </Text>
                </View>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => renderPhotoCard(item)}
        ListEmptyComponent={
          !loading && tab !== 'offline' && !isGroupedByFolder ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceElevated }]}>
                <ImageIcon size={28} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {tab === 'shared' ? 'No Shared Photos Yet' : 'No Photos Taken Yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {tab === 'shared'
                  ? 'Photos shared with you will appear here.'
                  : 'Open the Camera tab to capture the moment!'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Media Detail & Fullscreen Share Modal */}
      <MediaModalViewer
        item={selectedItem}
        serverUrl={serverUrl}
        onClose={() => setSelectedItem(null)}
        onDeleted={(id) => {
          setMedia((prev) => prev.filter((m) => m.id !== id));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 3,
    flex: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewSwitchGroup: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 2,
  },
  viewSwitchBtn: {
    padding: 6,
    borderRadius: 8,
  },
  listContent: {
    padding: 16,
    gap: ITEM_SPACING,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ITEM_SPACING,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  uploaderBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: '85%',
  },
  uploaderText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
  },
  offlineStatusOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  offlineStatusText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
  },
  folderSection: {
    gap: 14,
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeFolderText: {
    fontSize: 11,
    fontWeight: '600',
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  folderCard: {
    width: (width - 40) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  folderIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 12,
    fontWeight: '700',
  },
  folderCount: {
    fontSize: 10,
    marginTop: 2,
  },
  activeFolderBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  activeFolderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  activeFolderName: {
    fontSize: 13,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  folderEmptyPrompt: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderEmptyTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  folderEmptySub: {
    fontSize: 10,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
