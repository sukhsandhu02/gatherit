import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Radio, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { storage } from '../services/storage';

interface EmergencyState {
  active: boolean;
  ended: boolean;
  sender: string;
  title: string;
  isDirect: boolean;
}

export function EmergencyBanner() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<EmergencyState>({
    active: false,
    ended: false,
    sender: 'Host Console',
    title: 'Emergency Announcement',
    isDirect: false,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const dismissTimerRef = useRef<any>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    let isMounted = true;

    async function initSocket() {
      try {
        const baseUrl = await storage.getServerUrl();
        const token = await storage.getToken();
        const guest = await storage.getGuest();
        let wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
        if (token) {
          wsUrl += `?token=${encodeURIComponent(token)}`;
        }

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (guest?.id) {
            socket.send(JSON.stringify({ type: 'join_mesh', guestId: guest.id }));
          }
        };

        socket.onmessage = (event) => {
          if (!isMounted || typeof event.data !== 'string') return;
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'pa_start') {
              clearTimeout(dismissTimerRef.current);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

              setState({
                active: true,
                ended: false,
                sender: msg.sender || 'Host Console',
                title: msg.alertTitle || 'Emergency Announcement',
                isDirect: Boolean(msg.targetGuestId),
              });

              Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
              }).start();
            } else if (msg.type === 'pa_stop') {
              setState((prev) => ({ ...prev, ended: true }));
              dismissTimerRef.current = setTimeout(() => {
                if (isMounted) {
                  Animated.timing(slideAnim, {
                    toValue: -150,
                    duration: 250,
                    useNativeDriver: true,
                  }).start(() => {
                    setState((prev) => ({ ...prev, active: false, ended: false }));
                  });
                }
              }, 3200);
            }
          } catch {}
        };

        socket.onclose = () => {
          if (isMounted) {
            reconnectTimerRef.current = setTimeout(initSocket, 3500);
          }
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch {
        if (isMounted) {
          reconnectTimerRef.current = setTimeout(initSocket, 4000);
        }
      }
    }

    initSocket();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimerRef.current);
      clearTimeout(dismissTimerRef.current);
      socketRef.current?.close();
    };
  }, [slideAnim]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setState((prev) => ({ ...prev, active: false }));
    });
  };

  if (!state.active) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View
        style={[
          styles.bannerCard,
          state.ended
            ? styles.endedCard
            : state.isDirect
            ? styles.directCard
            : styles.broadcastCard,
        ]}
      >
        <View style={styles.iconBox}>
          {state.ended ? (
            <Radio size={16} color="#d6cdc4" />
          ) : (
            <AlertTriangle size={16} color="#fde047" />
          )}
        </View>

        <View style={styles.contentCol}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.badge,
                state.isDirect ? styles.directBadge : styles.normalBadge,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  state.isDirect ? styles.directBadgeText : styles.normalBadgeText,
                ]}
              >
                {state.ended
                  ? 'ENDED'
                  : state.isDirect
                  ? 'DIRECT TO YOU'
                  : 'LIVE HOST PA'}
              </Text>
            </View>

            <Text style={styles.senderText} numberOfLines={1}>
              {state.sender}
            </Text>
          </View>

          <Text style={styles.titleText} numberOfLines={2} ellipsizeMode="tail">
            {state.ended ? 'Host announcement has concluded' : state.title}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.closeBtn}
        >
          <X size={15} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  broadcastCard: {
    backgroundColor: '#b43e33',
    borderColor: '#e05345',
  },
  directCard: {
    backgroundColor: '#8c4618',
    borderColor: '#d97706',
  },
  endedCard: {
    backgroundColor: '#231e1a',
    borderColor: '#423932',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 99,
    marginRight: 6,
  },
  normalBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  directBadge: {
    backgroundColor: '#fbbf24',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  normalBadgeText: {
    color: '#ffffff',
  },
  directBadgeText: {
    color: '#1c1917',
  },
  senderText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    flexShrink: 1,
  },
  titleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 16.5,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginLeft: 8,
  },
});
