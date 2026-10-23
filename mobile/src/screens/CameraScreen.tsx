import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useTheme } from '../theme/ThemeContext';
import { uploadQueue } from '../services/uploadQueue';
import { LivePreviewStreamer } from '../services/cameraStream';
import { apiClient } from '../services/api';
import { OfflineQueueItem } from '../types';
import {
  Camera as CameraIcon,
  SwitchCamera,
  Zap,
  ZapOff,
  CloudUpload,
  Radio,
  CheckCircle,
  FlipHorizontal,
  Video as VideoIcon,
  Globe,
  Users,
  EyeOff,
  X,
  Check,
  Search,
  ChevronDown,
  Shield,
} from 'lucide-react-native';

export function CameraScreen() {
  useKeepAwake();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [isMirrored, setIsMirrored] = useState(false);
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [streamStatus, setStreamStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [capturing, setCapturing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Live Camera Sharing states
  const [shareMode, setShareMode] = useState<'off' | 'host' | 'all' | 'selected'>('host');
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [fellowGuests, setFellowGuests] = useState<Array<{ id: string; name: string }>>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const guestNameRef = useRef('Guest');

  const cameraRef = useRef<any>(null);
  const streamerRef = useRef<LivePreviewStreamer | null>(null);
  const streamingBusyRef = useRef(false);
  const syncToastTimerRef = useRef<any>(null);
  const prevQueueLengthRef = useRef(0);

  // Subscribe to upload queue updates and trigger ephemeral 1-second badge
  useEffect(() => {
    const unsubscribe = uploadQueue.subscribe((items) => {
      setQueue(items);
      const activeCount = items.filter((i) => i.status === 'uploading' || i.status === 'pending').length;
      
      // When new items start syncing or an item finishes
      if (activeCount > 0 && activeCount !== prevQueueLengthRef.current) {
        if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
        setSyncToast(`Syncing ${activeCount} ${activeCount === 1 ? 'item' : 'items'} in background...`);
        syncToastTimerRef.current = setTimeout(() => {
          setSyncToast(null);
        }, 1200);
      }
      prevQueueLengthRef.current = activeCount;
    });
    return () => {
      unsubscribe();
      if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
    };
  }, []);

  // Fetch fellow guests and profile name for live sharing
  useEffect(() => {
    apiClient('/api/me')
      .then((res: any) => {
        if (res?.guest?.name) guestNameRef.current = res.guest.name;
      })
      .catch(() => {});

    apiClient('/api/me/event-guests')
      .then((res: any) => {
        if (Array.isArray(res?.guests)) setFellowGuests(res.guests);
      })
      .catch(() => {});
  }, []);

  const handleSelectShareMode = (newMode: 'off' | 'host' | 'all' | 'selected', selectedIds = selectedGuestIds) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareMode(newMode);
    setSelectedGuestIds(selectedIds);
    streamerRef.current?.sendShareConfig(newMode, selectedIds, guestNameRef.current);
  };

  // Initialize live preview streamer
  useEffect(() => {
    const streamer = new LivePreviewStreamer((status) => {
      setStreamStatus(status);
      if (status === 'connected') {
        streamer.sendShareConfig('host', [], guestNameRef.current);
      }
    });
    streamerRef.current = streamer;
    streamer.start();

    return () => {
      streamer.stop();
    };
  }, []);

  // Live wall camera preview frame capture loop (~4-5 fps low res when sharing is active)
  useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    const streamTick = async () => {
      if (cancelled) return;

      const streamer = streamerRef.current;
      if (
        streamer &&
        streamer.isConnected() &&
        cameraRef.current &&
        !capturing &&
        !isRecording &&
        !streamingBusyRef.current &&
        shareMode !== 'off'
      ) {
        streamingBusyRef.current = true;
        try {
          const frame = await cameraRef.current.takePictureAsync({
            quality: 0.08,
            base64: true,
            skipProcessing: true,
            shutterSound: false,
          });

          if (frame?.base64 && !cancelled) {
            streamer.sendBase64Frame(frame.base64);
          }
        } catch {
          // Frame drop during mode switch or native focus
        } finally {
          streamingBusyRef.current = false;
        }
      }

      if (!cancelled) {
        const delay = streamer?.getBoosted() ? 150 : 280;
        timer = setTimeout(streamTick, delay);
      }
    };

    timer = setTimeout(streamTick, 1000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [capturing, isRecording, shareMode]);

  // Video recording timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const toggleFacing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing((prev) => {
      const nextFacing = prev === 'back' ? 'front' : 'back';
      // Auto-mirror on front camera by default, non-mirrored on rear camera
      setIsMirrored(nextFacing === 'front');
      return nextFacing;
    });
  };

  const toggleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const toggleMirror = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMirrored((prev) => !prev);
  };

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;

    try {
      setCapturing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (photo?.uri) {
        // Enqueue immediately so camera does not block
        await uploadQueue.enqueuePhoto(photo.uri);
      }
    } catch (err) {
      console.error('Error capturing photo:', err);
    } finally {
      setCapturing(false);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      setIsRecording(true);
      setRecordDuration(0);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const videoPromise = cameraRef.current.recordAsync({
        maxDuration: 60,
      });

      // Handle video promise completion asynchronously
      videoPromise.then(async (video: any) => {
        if (video?.uri) {
          await uploadQueue.enqueueVideo(video.uri);
        }
      }).catch((err: any) => {
        console.error('Video record error:', err);
      }).finally(() => {
        setIsRecording(false);
      });
    } catch (err) {
      console.error('Error starting video recording:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!cameraRef.current || !isRecording) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      cameraRef.current.stopRecording();
    } catch (err) {
      console.error('Error stopping recording:', err);
    }
    setIsRecording(false);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!permission) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.canvas }]}>
        <CameraIcon size={48} color={colors.textSecondary} />
        <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>Camera Access Required</Text>
        <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>
          Gather needs camera access so you can capture photos and stream live previews to the event host.
        </Text>
        <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.brand }]} onPress={requestPermission}>
          <Text style={[styles.permissionButtonText, { color: colors.brandText }]}>Enable Camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={mode}
        mirror={isMirrored}
        responsiveOrientationWhenOrientationLocked={true}
        enableTorch={flash === 'on'}
      />
      <SafeAreaView style={[styles.overlay, StyleSheet.absoluteFill]} pointerEvents="box-none">
        {/* Top Controls Bar */}
        <View style={styles.topBar}>
          {/* Live Feed Toggle: Compact sleek pill */}
          <TouchableOpacity
            style={[
              styles.feedPill,
              shareMode === 'all'
                ? styles.feedPillAll
                : shareMode === 'selected'
                ? styles.feedPillSelected
                : styles.feedPillOff,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowShareModal(true);
            }}
          >
            <View
              style={[
                styles.feedDot,
                shareMode === 'all'
                  ? { backgroundColor: '#ef4444' }
                  : shareMode === 'selected'
                  ? { backgroundColor: '#3b82f6' }
                  : shareMode === 'host'
                  ? { backgroundColor: '#10b981' }
                  : { backgroundColor: '#94a3b8' },
              ]}
            />
            <Text
              style={[
                styles.feedText,
                shareMode === 'all'
                  ? { color: '#fca5a5' }
                  : shareMode === 'selected'
                  ? { color: '#93c5fd' }
                  : shareMode === 'host'
                  ? { color: '#6ee7b7' }
                  : { color: '#cbd5e1' },
              ]}
            >
              {shareMode === 'all'
                ? 'Live'
                : shareMode === 'selected'
                ? `Live ${selectedGuestIds.length}`
                : shareMode === 'host'
                ? 'Host'
                : 'Off'}
            </Text>
            <ChevronDown size={11} color="#ffffff" style={{ opacity: 0.7 }} />
          </TouchableOpacity>

          {/* Mode Switcher (Photo / Video) */}
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'picture' && styles.modeTabActive]}
              onPress={() => {
                if (!isRecording) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMode('picture');
                }
              }}
            >
              <Text style={[styles.modeTabText, mode === 'picture' && styles.modeTabTextActive]}>
                Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'video' && styles.modeTabActive]}
              onPress={() => {
                if (!isRecording) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMode('video');
                }
              }}
            >
              <Text style={[styles.modeTabText, mode === 'video' && styles.modeTabTextActive]}>
                Video
              </Text>
            </TouchableOpacity>
          </View>

          {/* Flash, Invert/Mirror & Flip Buttons */}
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
              {flash === 'on' ? (
                <Zap size={20} color={colors.warning} />
              ) : (
                <ZapOff size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, isMirrored && { borderColor: colors.brand, backgroundColor: 'rgba(0,0,0,0.8)' }]}
              onPress={toggleMirror}
            >
              <FlipHorizontal size={20} color={isMirrored ? colors.brand : '#ffffff'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={toggleFacing}>
              <SwitchCamera size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Video Recording Timer */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>{formatSeconds(recordDuration)}</Text>
          </View>
        )}

        {/* Bottom Shutter Controls with Ephemeral Sync Badge Just Above */}
        <View style={styles.bottomBar}>
          {/* Ephemeral Upload Status: Shown only for 1 sec just above shutter */}
          {syncToast && (
            <View style={styles.ephemeralPill}>
              <CloudUpload size={13} color={colors.brand} />
              <Text style={styles.ephemeralPillText}>{syncToast}</Text>
            </View>
          )}

          <View style={styles.shutterContainer}>
            {mode === 'picture' ? (
              <TouchableOpacity
                style={[styles.shutterButton, capturing && styles.shutterCapturing]}
                onPress={takePicture}
                disabled={capturing}
                activeOpacity={0.8}
              >
                <View style={[styles.shutterInner, { backgroundColor: colors.white }]} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.videoShutterButton, isRecording && styles.videoShutterRecording]}
                onPress={isRecording ? stopRecording : startRecording}
                activeOpacity={0.8}
              >
                <View style={[styles.videoShutterInner, isRecording && styles.videoShutterInnerRecording]} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Live Share Audience Floating Popover Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <SafeAreaView style={styles.shareModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowShareModal(false)}
          />

          <View style={[styles.shareModalCard, { backgroundColor: '#0f172a', borderColor: '#334155' }]}>
            <View style={styles.shareModalHeader}>
              <View>
                <Text style={styles.shareModalTitle}>LIVE CAMERA SHARING</Text>
                <Text style={styles.shareModalSub}>Choose who can watch your feed</Text>
              </View>
              <TouchableOpacity
                style={styles.shareModalClose}
                onPress={() => setShowShareModal(false)}
              >
                <X size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View style={styles.shareOptionsList}>
              {/* Host Only (Default) */}
              <TouchableOpacity
                style={[
                  styles.shareOptionItem,
                  shareMode === 'host' && styles.shareOptionItemActiveHost,
                ]}
                onPress={() => {
                  handleSelectShareMode('host');
                  setShowShareModal(false);
                }}
              >
                <View style={styles.shareOptionLeft}>
                  <View style={[styles.shareOptionIconBox, { backgroundColor: '#10b98120' }]}>
                    <Shield size={16} color="#10b981" />
                  </View>
                  <View>
                    <Text style={styles.shareOptionName}>Host Only (Default)</Text>
                    <Text style={styles.shareOptionDesc}>Stream live preview only to event host</Text>
                  </View>
                </View>
                {shareMode === 'host' && <Check size={16} color="#10b981" />}
              </TouchableOpacity>

              {/* Private (Off) */}
              <TouchableOpacity
                style={[
                  styles.shareOptionItem,
                  shareMode === 'off' && styles.shareOptionItemActiveOff,
                ]}
                onPress={() => {
                  handleSelectShareMode('off');
                  setShowShareModal(false);
                }}
              >
                <View style={styles.shareOptionLeft}>
                  <View style={[styles.shareOptionIconBox, { backgroundColor: '#1e293b' }]}>
                    <EyeOff size={16} color="#94a3b8" />
                  </View>
                  <View>
                    <Text style={styles.shareOptionName}>Private (Off)</Text>
                    <Text style={styles.shareOptionDesc}>Stop streaming your live camera</Text>
                  </View>
                </View>
                {shareMode === 'off' && <Check size={16} color="#10b981" />}
              </TouchableOpacity>

              {/* All Guests (Public) */}
              <TouchableOpacity
                style={[
                  styles.shareOptionItem,
                  shareMode === 'all' && styles.shareOptionItemActiveAll,
                ]}
                onPress={() => {
                  handleSelectShareMode('all');
                  setShowShareModal(false);
                }}
              >
                <View style={styles.shareOptionLeft}>
                  <View style={[styles.shareOptionIconBox, { backgroundColor: '#ef444420' }]}>
                    <Globe size={16} color="#ef4444" />
                  </View>
                  <View>
                    <Text style={styles.shareOptionName}>All Guests (Public)</Text>
                    <Text style={styles.shareOptionDesc}>Anyone in this event can watch</Text>
                  </View>
                </View>
                {shareMode === 'all' && <Check size={16} color="#ef4444" />}
              </TouchableOpacity>

              {/* Specific Guests */}
              <TouchableOpacity
                style={[
                  styles.shareOptionItem,
                  shareMode === 'selected' && styles.shareOptionItemActiveSelected,
                ]}
                onPress={() => {
                  setShareMode('selected');
                }}
              >
                <View style={styles.shareOptionLeft}>
                  <View style={[styles.shareOptionIconBox, { backgroundColor: '#3b82f620' }]}>
                    <Users size={16} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={styles.shareOptionName}>
                      Specific Guests {selectedGuestIds.length > 0 ? `(${selectedGuestIds.length})` : ''}
                    </Text>
                    <Text style={styles.shareOptionDesc}>Stream live only to selected guests</Text>
                  </View>
                </View>
                {shareMode === 'selected' && <Check size={16} color="#3b82f6" />}
              </TouchableOpacity>
            </View>

            {/* Checkboxes List if 'selected' */}
            {shareMode === 'selected' && (
              <View style={styles.specificGuestsContainer}>
                <View style={styles.searchBox}>
                  <Search size={14} color="#64748b" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search fellow guests..."
                    placeholderTextColor="#64748b"
                    value={guestSearch}
                    onChangeText={setGuestSearch}
                  />
                </View>

                <View style={styles.selectionMetaRow}>
                  <Text style={styles.selectionMetaText}>
                    {selectedGuestIds.length} of {fellowGuests.length} chosen
                  </Text>
                  <View style={styles.selectionActions}>
                    <TouchableOpacity
                      onPress={() => setSelectedGuestIds(fellowGuests.map((g) => g.id))}
                    >
                      <Text style={styles.actionLinkText}>All</Text>
                    </TouchableOpacity>
                    <Text style={styles.actionDivider}>•</Text>
                    <TouchableOpacity onPress={() => setSelectedGuestIds([])}>
                      <Text style={styles.actionLinkTextMuted}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={styles.guestsScrollList} nestedScrollEnabled={true}>
                  {fellowGuests.length === 0 ? (
                    <Text style={styles.noGuestsText}>No other active guests in event</Text>
                  ) : (
                    fellowGuests
                      .filter((g) => g.name.toLowerCase().includes(guestSearch.toLowerCase()))
                      .map((guest) => {
                        const isSel = selectedGuestIds.includes(guest.id);
                        return (
                          <TouchableOpacity
                            key={guest.id}
                            style={[
                              styles.guestCheckItem,
                              isSel && styles.guestCheckItemActive,
                            ]}
                            onPress={() => {
                              setSelectedGuestIds((prev) =>
                                isSel ? prev.filter((id) => id !== guest.id) : [...prev, guest.id]
                              );
                            }}
                          >
                            <Text style={styles.guestCheckName} numberOfLines={1}>
                              {guest.name}
                            </Text>
                            <View
                              style={[
                                styles.checkboxSquare,
                                isSel && styles.checkboxSquareActive,
                              ]}
                            >
                              {isSel && <Check size={12} color="#ffffff" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => {
                    handleSelectShareMode('selected', selectedGuestIds);
                    setShowShareModal(false);
                  }}
                >
                  <Text style={styles.applyButtonText}>
                    Apply & Stream ({selectedGuestIds.length} Guests)
                  </Text>
                </TouchableOpacity>
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
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  permissionDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  liveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  uploadPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  shutterContainer: {
    alignItems: 'center',
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  shutterCapturing: {
    opacity: 0.5,
    transform: [{ scale: 0.95 }],
  },
  shutterInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modeTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  modeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modeTabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#ffffff',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  recordingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ephemeralPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  ephemeralPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  videoShutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  videoShutterRecording: {
    borderColor: '#ef4444',
  },
  videoShutterInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: '#ef4444',
  },
  videoShutterInnerRecording: {
    width: '50%',
    height: '50%',
    borderRadius: 8,
  },
  feedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  feedPillOff: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  feedPillAll: {
    backgroundColor: 'rgba(136, 19, 55, 0.85)',
    borderColor: 'rgba(244, 63, 94, 0.8)',
  },
  feedPillSelected: {
    backgroundColor: 'rgba(30, 58, 138, 0.85)',
    borderColor: 'rgba(59, 130, 246, 0.8)',
  },
  feedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  feedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  shareModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  shareModalTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#cbd5e1',
    letterSpacing: 0.5,
  },
  shareModalSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  shareModalClose: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  shareOptionsList: {
    marginTop: 10,
    gap: 8,
  },
  shareOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  shareOptionItemActiveHost: {
    borderColor: 'rgba(16, 185, 129, 0.8)',
    backgroundColor: 'rgba(6, 78, 59, 0.4)',
  },
  shareOptionItemActiveOff: {
    borderColor: '#475569',
    backgroundColor: '#1e293b',
  },
  shareOptionItemActiveAll: {
    borderColor: 'rgba(244, 63, 94, 0.8)',
    backgroundColor: 'rgba(136, 19, 55, 0.4)',
  },
  shareOptionItemActiveSelected: {
    borderColor: 'rgba(59, 130, 246, 0.8)',
    backgroundColor: 'rgba(30, 58, 138, 0.4)',
  },
  shareOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  shareOptionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareOptionName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  shareOptionDesc: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  specificGuestsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#334155',
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    height: 34,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: '#ffffff',
    padding: 0,
  },
  selectionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionMetaText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionLinkText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
  },
  actionDivider: {
    fontSize: 10,
    color: '#64748b',
  },
  actionLinkTextMuted: {
    fontSize: 10,
    color: '#94a3b8',
  },
  guestsScrollList: {
    maxHeight: 120,
  },
  noGuestsText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 12,
  },
  guestCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 4,
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
  },
  guestCheckItemActive: {
    borderColor: 'rgba(59, 130, 246, 0.6)',
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
  },
  guestCheckName: {
    fontSize: 11,
    color: '#e2e8f0',
    flex: 1,
    marginRight: 8,
  },
  checkboxSquare: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSquareActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  applyButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
