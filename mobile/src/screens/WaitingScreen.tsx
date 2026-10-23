import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/api';
import { storage } from '../services/storage';
import { LogoMark } from '../components/LogoMark';
import { Clock, RefreshCw, LogOut } from 'lucide-react-native';

export function WaitingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [checking, setChecking] = useState(false);
  const [guestName, setGuestName] = useState('');

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await apiClient('/api/me');
      if (res.guest) {
        setGuestName(res.guest.name);
        await storage.setGuest(res.guest);

        if (res.guest.status === 'active') {
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        }
      }
    } catch (err) {
      // offline or pending
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Auto-poll every 4 seconds
    const interval = setInterval(checkStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient('/api/logout', { method: 'POST' });
    } catch {}
    await storage.clearToken();
    await storage.clearGuest();
    navigation.reset({ index: 0, routes: [{ name: 'Scan' }] });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.logoRow}>
          <LogoMark size={40} />
        </View>

        <View style={[styles.iconCircle, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
          <Clock size={32} color={colors.warning} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Waiting for the host</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Hi {guestName || 'there'}! The host requires approval before guests can enter the live event space. You'll get in as soon as they approve.
        </Text>

        <View style={[styles.statusBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={[styles.pulseDot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>Join Request Submitted • Checking...</Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: colors.brand }]}
          onPress={checkStatus}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator size="small" color={colors.brandText} />
          ) : (
            <>
              <RefreshCw size={16} color={colors.brandText} />
              <Text style={[styles.refreshButtonText, { color: colors.brandText }]}>Check Status Now</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={handleLogout}
        >
          <LogOut size={16} color={colors.textSecondary} />
          <Text style={[styles.logoutButtonText, { color: colors.textSecondary }]}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  logoRow: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 48,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#2447f0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
