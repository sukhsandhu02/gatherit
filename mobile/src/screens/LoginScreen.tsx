import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/api';
import { storage } from '../services/storage';
import { LogoMark } from '../components/LogoMark';
import {
  KeyRound,
  ArrowLeft,
  UserPlus,
  AlertCircle,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  QrCode,
} from 'lucide-react-native';

export function LoginScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const [slug, setSlug] = useState(route.params?.slug || '');
  const [phone, setPhone] = useState(route.params?.phone || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eventName, setEventName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotRegistered, setIsNotRegistered] = useState(false);

  React.useEffect(() => {
    if (route.params?.slug) {
      setSlug(route.params.slug);
    } else {
      storage.getEventSlug().then((saved) => {
        if (saved) setSlug(saved);
      });
    }
    if (route.params?.phone) {
      setPhone(route.params.phone);
    }
  }, [route.params?.slug, route.params?.phone]);

  React.useEffect(() => {
    if (slug.trim()) {
      apiClient(`/api/events/${slug.trim()}`)
        .then((res) => {
          if (res.event?.name) setEventName(res.event.name);
        })
        .catch(() => setEventName(null));
    } else {
      setEventName(null);
    }
  }, [slug]);

  const handleLogin = async () => {
    if (!slug.trim()) {
      Alert.alert('Required', 'Please enter or scan an event code.');
      return;
    }
    if (!phone.trim() || !password) {
      Alert.alert('Required', 'Please enter your phone number and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setIsNotRegistered(false);

    try {
      const res = await apiClient(`/api/events/${slug.trim()}/login`, {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
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
      const msg = err.message || '';
      if (msg.includes('No account found') || err.data?.error?.includes('No account found')) {
        setIsNotRegistered(true);
        setErrorMessage('No account found for this phone number in this event.');
        Alert.alert(
          'Account Not Found',
          'No account was found with this phone number. Would you like to sign up for this event?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign Up',
              onPress: () => navigation.navigate('Join', { slug: slug.trim(), phone: phone.trim() }),
            },
          ]
        );
      } else {
        setErrorMessage(msg || 'Invalid phone or password');
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
          {/* Top navigation */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: colors.surfaceElevated }]}
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={18} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scanPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Scan')}
            >
              <QrCode size={14} color={colors.textSecondary} />
              <Text style={[styles.scanPillText, { color: colors.textSecondary }]}>Scan QR</Text>
            </TouchableOpacity>
          </View>

          {/* Login Card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.header}>
              <LogoMark size={44} />
              <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome back</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {eventName ? `Signed in to ${eventName}` : 'Sign in to access your event photos'}
              </Text>
            </View>

            {/* Error banner */}
            {errorMessage && (
              <View style={[styles.errorBanner, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]}>
                <AlertCircle size={16} color={colors.live} />
                <Text style={[styles.errorText, { color: colors.live }]}>{errorMessage}</Text>
              </View>
            )}

            {/* Event Code */}
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

            {/* Phone Number */}
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
              <Text style={[styles.label, { color: colors.textSecondary }]}>Password *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Lock size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="••••••••"
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
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.brand }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.brandText} />
              ) : (
                <Text style={[styles.submitButtonText, { color: colors.brandText }]}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Sign up prompt */}
            <View style={styles.signupRow}>
              <Text style={[styles.signupPrompt, { color: colors.textMuted }]}>New to this event?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Join', { slug: slug.trim(), phone: phone.trim() })}
                style={styles.signupLink}
              >
                <UserPlus size={13} color={colors.brand} />
                <Text style={[styles.signupLinkText, { color: colors.brand }]}>Join event</Text>
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
    marginBottom: 20,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  scanPillText: {
    fontSize: 12,
    fontWeight: '600',
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
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
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 18,
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
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  signupPrompt: {
    fontSize: 12,
  },
  signupLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  signupLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
