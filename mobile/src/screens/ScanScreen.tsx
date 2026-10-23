import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';
import { storage } from '../services/storage';
import { QrCode, Zap, ZapOff, Keyboard, ArrowRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const SCAN_BOX_SIZE = width * 0.72;

export function ScanScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);

  const parseQr = (data: string) => {
    let slug = data.trim();
    let serverUrl: string | null = null;

    try {
      if (data.startsWith('http://') || data.startsWith('https://')) {
        const url = new URL(data);
        const match = url.pathname.match(/\/e\/([^/?#]+)/);
        if (match && match[1]) {
          slug = match[1];
          if (url.protocol === 'https:') {
            serverUrl = url.origin;
          } else {
            const host = (url.hostname === 'localhost' || url.hostname === '127.0.0.1') ? '127.0.0.1' : url.hostname;
            const port = url.port === '5173' ? '8080' : (url.port || '8080');
            serverUrl = `http://${host}:${port}`;
          }
        }
      } else if (data.startsWith('gather://e/')) {
        slug = data.replace('gather://e/', '').split('/')[0];
      }
    } catch {}

    return { slug, serverUrl };
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const { slug, serverUrl } = parseQr(data);

    if (serverUrl) {
      await storage.setServerUrl(serverUrl);
    }
    if (slug) {
      await storage.setEventSlug(slug);
    }

    navigation.navigate('Login', { slug });
    setTimeout(() => setScanned(false), 2000);
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.permissionContainer, { backgroundColor: colors.canvas }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceElevated }]}>
          <QrCode size={40} color={colors.brand} />
        </View>
        <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>Camera Access Needed</Text>
        <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>
          Gather uses your camera to scan event QR codes instantly and stream live previews.
        </Text>
        <TouchableOpacity
          style={[styles.enableButton, { backgroundColor: colors.brand }]}
          onPress={requestPermission}
        >
          <Text style={[styles.enableButtonText, { color: colors.brandText }]}>Enable Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manualFallback}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[styles.manualFallbackText, { color: colors.brand }]}>Or enter event code manually</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <SafeAreaView style={styles.overlay}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <View style={styles.badge}>
            <View style={styles.pulseDot} />
            <Text style={styles.badgeText}>SCAN GATHER QR</Text>
          </View>
          <TouchableOpacity
            style={styles.torchButton}
            onPress={() => setTorch(!torch)}
          >
            {torch ? (
              <Zap size={20} color="#f59e0b" />
            ) : (
              <ZapOff size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Reticle */}
        <View style={styles.scanTargetWrapper}>
          <View style={styles.scanTarget}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <QrCode size={44} color="rgba(255,255,255,0.3)" />
          </View>
          <Text style={styles.instructionTitle}>Scan Event QR</Text>
          <Text style={styles.instructionSub}>Point your camera at the event QR pass or screen</Text>
        </View>

        {/* Footer Actions */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.manualCodeButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Keyboard size={16} color="#ffffff" />
            <Text style={styles.manualCodeText}>Enter Event Code</Text>
            <ArrowRight size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  enableButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 18,
    width: '100%',
    alignItems: 'center',
  },
  enableButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  manualFallback: {
    marginTop: 18,
    padding: 8,
  },
  manualFallbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2447f0',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  torchButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTargetWrapper: {
    alignItems: 'center',
  },
  scanTarget: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#2447f0',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 24,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 24,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 24,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 24,
  },
  instructionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  instructionSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
  bottomBar: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  manualCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  manualCodeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
