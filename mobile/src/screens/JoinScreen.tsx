import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/api';
import { storage } from '../services/storage';
import { LogoMark } from '../components/LogoMark';
import { ThemeSelector } from '../components/ThemeSelector';
import {
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  Settings,
  Sparkles,
  QrCode,
  LogIn,
} from 'lucide-react-native';

export function JoinScreen({ route, navigation }: any) {
  const { colors, isDark } = useTheme();
  const [slug, setSlug] = useState(route?.params?.slug || '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(route?.params?.phone || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  React.useEffect(() => {
    if (route?.params?.slug) {
      setSlug(route.params.slug);
    } else {
      storage.getEventSlug().then((saved) => {
        if (saved) setSlug(saved);
      });
    }
    if (route?.params?.phone) {
      setPhone(route.params.phone);
    }
  }, [route?.params?.slug, route?.params?.phone]);

  React.useEffect(() => {
    storage.getServerUrl().then(setServerUrl);
  }, []);

  const handleJoin = async () => {
    if (!slug.trim()) {
      Alert.alert('Required', 'Please enter an event code/slug');
      return;
    }
    if (!name.trim() || !phone.trim() || password.length < 6) {
      Alert.alert('Validation Error', 'Name, phone number, and password (at least 6 characters) are required.');
      return;
    }

    setLoading(true);
    try {
      if (serverUrl.trim()) {
        await storage.setServerUrl(serverUrl.trim());
      }

      const res = await apiClient(`/api/events/${slug.trim()}/join`, {
        method: 'POST',
        body: JSON.stringify({ name, phone, password }),
      });

      if (res.guest) {
        if (res.token) {
          await storage.setToken(res.token);
        }
        await storage.setGuest(res.guest);
        await storage.setEventSlug(slug.trim());

        if (res.guest.status === 'pending') {
          navigation.replace('Waiting');
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        }
      }
    } catch (err: any) {
      if (err.data?.alreadyJoined) {
        Alert.alert(
          'Already Joined',
          'This phone number is already registered for this event. Would you like to log in?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log In', onPress: () => navigation.navigate('Login', { slug, phone }) },
          ]
        );
      } else {
        Alert.alert('Join Failed', err.message || 'Could not join event. Please check the event code.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.canvas }]}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[styles.qrButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Scan')}
            >
              <QrCode size={16} color={colors.textSecondary} />
              <Text style={[styles.qrButtonText, { color: colors.textSecondary }]}>Scan QR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.configIcon, { backgroundColor: colors.surfaceElevated }]}
              onPress={() => setShowConfig(!showConfig)}
            >
              <Settings size={18} color={showConfig ? colors.brand : colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Config server overlay if toggled */}
          {showConfig && (
            <View style={[styles.configCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.configTitle, { color: colors.textSecondary }]}>Server Address / Hotspot</Text>
              <TextInput
                style={[styles.configInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.textPrimary }]}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://127.0.0.1:8080"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <View style={{ marginTop: 8 }}>
                <ThemeSelector />
              </View>
            </View>
          )}

          {/* Main Card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Branding */}
            <View style={styles.brandHeader}>
              <LogoMark size={48} />
              <Text style={[styles.title, { color: colors.textPrimary }]}>Join Event</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Capture, stream, and keep every moment in full quality
              </Text>
            </View>

            {/* Event Slug Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Event Code *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Sparkles size={16} color={colors.brand} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="e.g. wedding-2026"
                  placeholderTextColor={colors.textMuted}
                  value={slug}
                  onChangeText={setSlug}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Guest Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Your Name *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <User size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="e.g. Alex Morgan"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            {/* Phone with +91 indicator */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={[styles.phonePrefix, { backgroundColor: colors.borderMuted }]}>
                  <Text style={[styles.phonePrefixText, { color: colors.textSecondary }]}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="98765 43210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
                <Phone size={16} color={colors.textMuted} />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Create a Password *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Lock size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={16} color={colors.textMuted} />
                  ) : (
                    <Eye size={16} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Used with your phone number to access photos shared with you
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.brand }]}
              onPress={handleJoin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.brandText} />
              ) : (
                <>
                  <Text style={[styles.submitButtonText, { color: colors.brandText }]}>Join Event Space</Text>
                  <ArrowRight size={18} color={colors.brandText} />
                </>
              )}
            </TouchableOpacity>

            {/* Link to Login */}
            <View style={styles.loginRow}>
              <Text style={[styles.loginPrompt, { color: colors.textMuted }]}>Already joined this event?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login', { slug, phone })}
                style={styles.loginLink}
              >
                <LogIn size={13} color={colors.brand} />
                <Text style={[styles.loginLinkText, { color: colors.brand }]}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  qrButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  configIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  configCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  configTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  configInput: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
  },
  card: {
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    height: 52,
    gap: 10,
  },
  phonePrefix: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  phonePrefixText: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  helperText: {
    fontSize: 11,
    marginTop: 4,
    paddingLeft: 2,
    lineHeight: 15,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 18,
    gap: 8,
    marginTop: 8,
    shadowColor: '#2447f0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  loginPrompt: {
    fontSize: 12,
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  loginLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
