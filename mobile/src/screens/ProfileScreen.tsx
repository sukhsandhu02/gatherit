import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/api';
import { storage } from '../services/storage';
import { GuestProfile } from '../types';
import { ThemeSelector } from '../components/ThemeSelector';
import {
  User,
  Phone,
  ShieldCheck,
  KeyRound,
  LogOut,
  Server,
  Share2,
  Trash2,
  Plus,
  Copy,
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react-native';

export function ProfileScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [guest, setGuest] = useState<GuestProfile | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [savingServer, setSavingServer] = useState(false);

  // Shares list state matching web GuestMePage
  const [shares, setShares] = useState<any[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const fetchShares = async () => {
    setLoadingShares(true);
    try {
      const res = await apiClient('/api/me/shares');
      setShares(res.shares || []);
    } catch {
      // offline or not found
    } finally {
      setLoadingShares(false);
    }
  };

  useEffect(() => {
    storage.getGuest().then(setGuest);
    storage.getServerUrl().then(setServerUrl);

    // Refresh profile and share links from server
    apiClient('/api/me')
      .then((res) => {
        if (res.guest) {
          setGuest(res.guest);
          storage.setGuest(res.guest);
        }
        fetchShares();
      })
      .catch(() => {});
  }, []);

  const handleShareLink = async (shareItem: any) => {
    const slug = shareItem.slug;
    const cleanServer = serverUrl.replace(/\/+$/, '');
    const url = shareItem.shareUrl || `${cleanServer}/s/${slug}`;

    try {
      await Share.share({
        title: shareItem.title || 'My Event Captures',
        message: `View my photos from the event: ${url}`,
        url,
      });
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {}
  };

  const handleCreateAllShare = async () => {
    setCreatingShare(true);
    try {
      const res = await apiClient('/api/me/shares', {
        method: 'POST',
        body: JSON.stringify({
          title: `${guest?.name || 'My'} Event Captures`,
          isAllMyUploads: true,
        }),
      });
      if (res.share) {
        setShares((prev) => [res.share, ...prev]);
        handleShareLink(res.share);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create share link');
    } finally {
      setCreatingShare(false);
    }
  };

  const handleDeleteShare = (id: string) => {
    Alert.alert(
      'Revoke Link',
      'Anyone with this link will no longer be able to view these photos. Revoke now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient(`/api/me/shares/${id}`, { method: 'DELETE' });
              setShares((prev) => prev.filter((s) => s.id !== id));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to revoke link');
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters.');
      return;
    }

    setSavingPw(true);
    try {
      await apiClient('/api/me/password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: guest?.mustChangePassword ? undefined : oldPassword,
          newPassword,
        }),
      });

      Alert.alert('Success', 'Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleSaveServerUrl = async () => {
    if (!serverUrl.trim()) return;
    setSavingServer(true);
    try {
      await storage.setServerUrl(serverUrl.trim());
      Alert.alert('Saved', 'Server address updated.');
    } finally {
      setSavingServer(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient('/api/logout', { method: 'POST' });
          } catch {}
          await storage.clearToken();
          await storage.clearGuest();
          navigation.reset({ index: 0, routes: [{ name: 'Scan' }] });
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.canvas }]} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
          <Text style={[styles.avatarText, { color: colors.brandText }]}>
            {guest?.name ? guest.name.substring(0, 2).toUpperCase() : 'G'}
          </Text>
        </View>

        <Text style={[styles.name, { color: colors.textPrimary }]}>{guest?.name || 'Guest User'}</Text>
        <View style={styles.phoneRow}>
          <Phone size={14} color={colors.textSecondary} />
          <Text style={[styles.phoneText, { color: colors.textSecondary }]}>+{guest?.phone}</Text>
        </View>

        <View style={[styles.badge, { borderTopColor: colors.border }]}>
          <ShieldCheck size={14} color={colors.success} />
          <Text style={[styles.badgeText, { color: colors.success }]}>Active Event Participant</Text>
        </View>
      </View>

      {/* Theme Appearance Selector */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Moon size={18} color={colors.brand} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Appearance</Text>
        </View>
        <ThemeSelector />
      </View>

      {/* Share Links Card (matching web GuestMePage) */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.shareHeaderRow}>
          <View style={styles.cardHeader}>
            <Share2 size={18} color={colors.brand} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>My Share Links</Text>
          </View>
          <TouchableOpacity
            style={[styles.createShareBtn, { backgroundColor: colors.brand }]}
            onPress={handleCreateAllShare}
            disabled={creatingShare}
          >
            {creatingShare ? (
              <ActivityIndicator size="small" color={colors.brandText} />
            ) : (
              <>
                <Plus size={14} color={colors.brandText} />
                <Text style={[styles.createShareBtnText, { color: colors.brandText }]}>Share My Uploads</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Create web links to send photos to family or friends without needing them to download the app.
        </Text>

        {loadingShares ? (
          <ActivityIndicator size="small" color={colors.brand} style={{ paddingVertical: 12 }} />
        ) : shares.length === 0 ? (
          <View style={[styles.emptySharesBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.emptySharesText, { color: colors.textMuted }]}>
              You haven't generated any share links yet.
            </Text>
          </View>
        ) : (
          <View style={styles.sharesList}>
            {shares.map((s) => (
              <View
                key={s.id}
                style={[styles.shareItem, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <View style={styles.shareItemLeft}>
                  <Text style={[styles.shareTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {s.title}
                  </Text>
                  <Text style={[styles.shareSlug, { color: colors.textMuted }]}>
                    /s/{s.slug} {s.itemCount !== undefined ? `• ${s.itemCount} items` : ''}
                  </Text>
                </View>

                <View style={styles.shareItemActions}>
                  <TouchableOpacity
                    style={[styles.shareBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleShareLink(s)}
                  >
                    {copiedSlug === s.slug ? (
                      <CheckCircle2 size={14} color={colors.success} />
                    ) : (
                      <Share2 size={14} color={colors.textPrimary} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deleteShareBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
                    onPress={() => handleDeleteShare(s.id)}
                  >
                    <Trash2 size={14} color={colors.live} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Change Password Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <KeyRound size={18} color={colors.brand} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Change Password</Text>
        </View>

        {!guest?.mustChangePassword && (
          <>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Current Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.textPrimary }]}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
          </>
        )}

        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>New Password (min 6 chars)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.textPrimary }]}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.brand }]}
          onPress={handleChangePassword}
          disabled={savingPw}
        >
          {savingPw ? (
            <ActivityIndicator size="small" color={colors.brandText} />
          ) : (
            <Text style={[styles.saveButtonText, { color: colors.brandText }]}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Server & Network Hotspot Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Server size={18} color={colors.textSecondary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Server & Hotspot URL</Text>
        </View>

        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.textPrimary }]}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://127.0.0.1:8080"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={handleSaveServerUrl}
          disabled={savingServer}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Save Server Address</Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: 'rgba(239,68,68,0.25)' }]}
        onPress={handleLogout}
      >
        <LogOut size={18} color={colors.live} />
        <Text style={[styles.logoutButtonText, { color: colors.live }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  phoneText: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  shareHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  createShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  createShareBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 12,
  },
  emptySharesBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptySharesText: {
    fontSize: 12,
  },
  sharesList: {
    gap: 8,
  },
  shareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  shareItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  shareTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  shareSlug: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  shareItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteShareBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
  },
  saveButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
