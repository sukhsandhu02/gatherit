import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  Dimensions,
  ActivityIndicator,
  ImageStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/api';
import { storage } from '../services/storage';
import { fromByteArray } from 'base64-js';
import * as Haptics from 'expo-haptics';
import {
  Radio,
  Maximize2,
  X,
  Globe,
  UserCheck,
  AlertCircle,
  Camera,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LiveStreamItem {
  guestId: string;
  guestName: string;
  shareMode: 'off' | 'all' | 'selected';
  isSharedToAll: boolean;
  lastFrameTime: number;
}

export function LiveScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const [guestMe, setGuestMe] = useState<{ id: string; name: string } | null>(null);
  const [activeStreams, setActiveStreams] = useState<LiveStreamItem[]>([]);
  const [streamFrames, setStreamFrames] = useState<Record<string, string>>({});
  const [fullscreenStream, setFullscreenStream] = useState<LiveStreamItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const fellowGuestsRef = useRef<Array<{ id: string; name: string }>>([]);
  const streamsMapRef = useRef<Map<string, LiveStreamItem>>(new Map());

  // 1. Fetch current guest info, fellow guests, and initial streams list
  const loadData = async () => {
    try {
      const meRes = await apiClient<any>('/api/me').catch(() => null);
      if (meRes?.guest) {
        setGuestMe(meRes.guest);
      }

      const guestsRes = await apiClient<any>('/api/me/event-guests').catch(() => null);
      if (Array.isArray(guestsRes?.guests)) {
        fellowGuestsRef.current = guestsRes.guests;
      }

      const streamsRes = await apiClient<any>('/api/guest/live-streams').catch(() => null);
      if (Array.isArray(streamsRes?.streams)) {
        const list: LiveStreamItem[] = streamsRes.streams.map((s: any) => ({
          guestId: s.guestId,
          guestName: s.guestName || 'Guest Cam',
          shareMode: s.shareMode,
          isSharedToAll: s.shareMode === 'all',
          lastFrameTime: s.lastFrameTime || Date.now(),
        }));
        setActiveStreams(list);
        const map = new Map<string, LiveStreamItem>();
        list.forEach((st) => map.set(st.guestId, st));
        streamsMapRef.current = map;
      }
    } catch {
      // silent fail in offline mode
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 2. Connect WebSocket to subscribe to live feeds
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isMounted = true;

    const connect = async () => {
      if (!isMounted) return;
      try {
        const baseUrl = await storage.getServerUrl();
        const token = await storage.getToken();
        let wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
        if (token) {
          wsUrl += `?token=${encodeURIComponent(token)}`;
        }

        socket = new WebSocket(wsUrl);
        socket.binaryType = 'arraybuffer';
        socketRef.current = socket;

        socket.onopen = () => {
          if (!isMounted) return;
          setWsConnected(true);
          socket?.send(JSON.stringify({ type: 'watch_live_start' }));
        };

        socket.onclose = () => {
          if (!isMounted) return;
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 2500);
        };

        socket.onerror = () => {
          socket?.close();
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;

          // Binary live camera frame
          if (event.data instanceof ArrayBuffer) {
            const buffer = event.data;
            if (buffer.byteLength <= 16) return;

            const hexBytes = new Uint8Array(buffer, 0, 16);
            let hexStr = '';
            for (let i = 0; i < 16; i++) {
              hexStr += hexBytes[i].toString(16).padStart(2, '0');
            }
            const streamerId = `${hexStr.slice(0, 8)}-${hexStr.slice(8, 12)}-${hexStr.slice(12, 16)}-${hexStr.slice(16, 20)}-${hexStr.slice(20, 32)}`;

            if (guestMe && streamerId === guestMe.id) return;

            const jpegBytes = new Uint8Array(buffer, 16);
            const base64Jpeg = fromByteArray(jpegBytes);
            const now = Date.now();

            setStreamFrames((prev) => ({
              ...prev,
              [streamerId]: base64Jpeg,
            }));

            // Auto-register stream in active streams list if not present
            if (!streamsMapRef.current.has(streamerId)) {
              const matchedGuest = fellowGuestsRef.current.find((g) => g.id === streamerId);
              const newItem: LiveStreamItem = {
                guestId: streamerId,
                guestName: matchedGuest?.name || 'Guest Cam',
                shareMode: 'all',
                isSharedToAll: true,
                lastFrameTime: now,
              };
              streamsMapRef.current.set(streamerId, newItem);
              setActiveStreams(Array.from(streamsMapRef.current.values()));
            } else {
              const item = streamsMapRef.current.get(streamerId)!;
              item.lastFrameTime = now;
            }
            return;
          }

          // JSON stream catalog updates
          if (typeof event.data === 'string') {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'live_streams_update' && Array.isArray(msg.activeStreams)) {
                const list: LiveStreamItem[] = msg.activeStreams
                  .filter((s: any) => !guestMe || s.guestId !== guestMe.id)
                  .map((s: any) => ({
                    guestId: s.guestId,
                    guestName: s.guestName || 'Guest Cam',
                    shareMode: s.shareMode,
                    isSharedToAll: s.shareMode === 'all',
                    lastFrameTime: s.lastFrameTime || Date.now(),
                  }));
                setActiveStreams(list);
                const map = new Map<string, LiveStreamItem>();
                list.forEach((st) => map.set(st.guestId, st));
                streamsMapRef.current = map;
              }
            } catch {
              // ignore
            }
          }
        };
      } catch {
        // ignore connection failure
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socketRef.current) {
        try {
          socketRef.current.send(JSON.stringify({ type: 'watch_live_stop' }));
        } catch {}
        socketRef.current.close();
      }
    };
  }, [guestMe]);

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Header bar */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Live Streams</Text>
          <View style={styles.liveTag}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveTagText}>
              {activeStreams.length} {activeStreams.length === 1 ? 'Stream' : 'Streams'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: wsConnected ? '#10b981' : '#f59e0b' },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {activeStreams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Radio size={36} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Active Live Streams</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              When fellow guests share their live camera stream with you, it will show up here in real time.
            </Text>
            <TouchableOpacity
              style={[styles.cameraButton, { backgroundColor: colors.brand }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('CameraTab');
              }}
            >
              <Camera size={16} color={colors.brandText} />
              <Text style={[styles.cameraButtonText, { color: colors.brandText }]}>Share Your Live Feed</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.streamsGrid}>
            {activeStreams.map((stream) => {
              const frameBase64 = streamFrames[stream.guestId];
              const isStale = Date.now() - stream.lastFrameTime > 5000;

              return (
                <View
                  key={stream.guestId}
                  style={[styles.streamCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  {/* Stream Card Header */}
                  <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                    <View style={styles.guestInfo}>
                      <View style={[styles.avatar, { backgroundColor: colors.brand + '20' }]}>
                        <Text style={[styles.avatarText, { color: colors.brand }]}>
                          {stream.guestName.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <View style={styles.nameRow}>
                          <Text style={[styles.guestName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {stream.guestName}
                          </Text>
                          <View style={styles.pulsingRedDot} />
                        </View>
                        <Text style={[styles.liveStatusText, { color: colors.textMuted }]}>Broadcasting live</Text>
                      </View>
                    </View>

                    <View style={styles.cardActions}>
                      <View
                        style={[
                          styles.audienceBadge,
                          {
                            backgroundColor: stream.isSharedToAll ? '#3b82f620' : '#10b98120',
                          },
                        ]}
                      >
                        {stream.isSharedToAll ? (
                          <Globe size={11} color="#3b82f6" />
                        ) : (
                          <UserCheck size={11} color="#10b981" />
                        )}
                        <Text
                          style={[
                            styles.audienceText,
                            { color: stream.isSharedToAll ? '#3b82f6' : '#10b981' },
                          ]}
                        >
                          {stream.isSharedToAll ? 'All' : 'Direct'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.maximizeButton}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setFullscreenStream(stream);
                        }}
                      >
                        <Maximize2 size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Video Viewport */}
                  <View style={styles.viewport}>
                    {frameBase64 ? (
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${frameBase64}` }}
                        style={styles.frameImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.loadingViewport}>
                        <ActivityIndicator size="small" color={colors.brand} />
                        <Text style={styles.loadingText}>Connecting to stream...</Text>
                      </View>
                    )}

                    {isStale && (
                      <View style={styles.staleOverlay}>
                        <AlertCircle size={18} color="#f59e0b" />
                        <Text style={styles.staleText}>Buffering...</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Fullscreen Expansion Modal */}
      <Modal
        visible={!!fullscreenStream}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullscreenStream(null)}
      >
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modalHeader}>
            <View style={styles.modalGuestInfo}>
              <View style={styles.pulsingRedDot} />
              <Text style={styles.modalGuestName}>{fullscreenStream?.guestName}</Text>
              <Text style={styles.modalLiveBadge}>LIVE</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setFullscreenStream(null)}
            >
              <X size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalViewport}>
            {fullscreenStream && streamFrames[fullscreenStream.guestId] ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${streamFrames[fullscreenStream.guestId]}` }}
                style={styles.modalFrameImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.loadingViewport}>
                <ActivityIndicator size="large" color="#ffffff" />
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef444420',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  cameraButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  streamsGrid: {
    gap: 16,
  },
  streamCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  guestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guestName: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 140,
  },
  pulsingRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveStatusText: {
    fontSize: 10,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  audienceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  maximizeButton: {
    padding: 6,
  },
  viewport: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#000000',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameImage: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  loadingViewport: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  staleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  staleText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#090b0e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalGuestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalGuestName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalLiveBadge: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalCloseButton: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
  },
  modalViewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFrameImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  } as ImageStyle,
});
